// routes/mobile.js
// Router de endpoints móviles (login NFC, heartbeat, perfil, ventas, recargas)
// Exporta una función que recibe dependencias del index.js:
//   module.exports = ({ pool, requireAuth, signToken }) => Router

const express = require('express');
const jwt = require('jsonwebtoken');

/**
 * @param {object} deps
 * @param {import('pg').Pool} deps.pool
 * @param {(req,res,next)=>void} deps.requireAuth
 * @param {(payload: any)=>string} [deps.signToken]
 */
module.exports = function mobileRouter({ pool, requireAuth, signToken }) {
  if (!pool) throw new Error('mobile.js: falta pool de PostgreSQL');

  const router = express.Router();

  // --- Helpers de token ---
  const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_change_me';
  const localSignToken = (payload) =>
    jwt.sign(payload, JWT_SECRET, { expiresIn: '12h' });
  const makeToken = (payload) =>
    typeof signToken === 'function' ? signToken(payload) : localSignToken(payload);

  // Si por alguna razón no llega requireAuth, no rompemos: inyecta auth vacío
  const auth = typeof requireAuth === 'function'
    ? requireAuth
    : (req, _res, next) => { req.auth = req.auth || {}; next(); };

  const isManager = (role) => ['ADMINISTRADOR', 'ENCARGADO'].includes(String(role || '').toUpperCase());

  // --- Busca el evento "actual" de forma tolerante a distintos esquemas/idiomas ---
  async function getCurrentEventId(client) {
    const candidates = [
      "SELECT id FROM events WHERE is_current = TRUE ORDER BY updated_at DESC LIMIT 1",
      "SELECT id FROM events WHERE status IN ('ACTIVO', 'EN_CURSO') ORDER BY updated_at DESC LIMIT 1",
      "SELECT id FROM events WHERE status IN ('ACTIVE','IN_PROGRESS') ORDER BY updated_at DESC LIMIT 1",
      "SELECT id FROM events ORDER BY created_at DESC LIMIT 1",
    ];
    for (const q of candidates) {
      try {
        const r = await client.query(q);
        if (r.rows.length) return r.rows[0].id;
      } catch (_) { /* ignore y probamos siguiente */ }
    }
    return null;
  }

  // =================================================================================
  // POST /api/mobile/login   { cardUid }
  //   - Busca staff por UID (normal o invertido) y emite JWT: { userId, role, eventId }
  // =================================================================================
  router.post('/login', async (req, res) => {
    let { cardUid } = req.body || {};
    if (!cardUid) return res.status(400).json({ error: 'Falta cardUid' });

    cardUid = String(cardUid).trim().toUpperCase();
    const reversed = (cardUid.match(/.{1,2}/g) || []).reverse().join('');

    const client = await pool.connect();
    try {
      const staffRes = await client.query(
        `
        SELECT s.id, s.name, s.role, s.event_id AS "eventId",
               e.name AS "eventName", e.status::text AS "eventStatus", e.created_at
          FROM staff s
          JOIN events e ON e.id = s.event_id
         WHERE (s.is_active IS NULL OR s.is_active = TRUE)
           AND s.card_uid IN ($1, $2)
         ORDER BY
           (LOWER(e.status::text) IN ('activo','active','en_curso','in_progress')) DESC,
           e.created_at DESC
         LIMIT 1
        `,
        [cardUid, reversed]
      );

      if (staffRes.rows.length === 0) {
        return res.status(401).json({
          error: 'Usuario no autorizado',
          debug: { tried: [cardUid, reversed] }
        });
      }

      const user = staffRes.rows[0];
      let eventId = user.eventId;

      if (!eventId) {
        eventId = await getCurrentEventId(client);
      }

      const token = makeToken({
        userId: user.id,
        role: user.role,
        eventId: eventId || null,
      });

      return res.json({
        token,
        user: { id: user.id, name: user.name, role: user.role, eventId },
        event: eventId ? { id: eventId, name: user.eventName } : null
      });
    } catch (err) {
      console.error('mobile/login error:', err);
      return res.status(500).json({ error: 'Error interno' });
    } finally {
      client.release();
    }
  });

  // =================================================================================
  // GET /api/mobile/me   (autenticado)
  // =================================================================================
  router.get('/me', auth, async (req, res) => {
    try {
      const { userId, eventId } = req.auth || {};
      if (!userId) return res.status(401).json({ error: 'Token inválido' });

      const client = await pool.connect();
      try {
        const variants = [
          { sql: 'SELECT id, name, role, event_id FROM staff WHERE id = $1 LIMIT 1', args: [userId] },
          { sql: 'SELECT id, name, role, event_id FROM users WHERE id = $1 LIMIT 1', args: [userId] },
        ];
        let row = null;
        for (const { sql, args } of variants) {
          try {
            const r = await client.query(sql, args);
            if (r.rows.length) { row = r.rows[0]; break; }
          } catch (_) {}
        }
        if (!row) return res.status(404).json({ error: 'Usuario no encontrado' });

        return res.json({
          user: {
            id: row.id,
            name: row.name,
            role: row.role,
            eventId: row.event_id || eventId || null
          }
        });
      } finally {
        client.release();
      }
    } catch (e) {
      console.error('mobile/me', e);
      res.status(500).json({ error: 'Error interno' });
    }
  });

  // =================================================================================
  // POST /api/mobile/heartbeat   (autenticado)
  // body: { deviceId, batteryLevel?, signalStrength? }
  //   - UPDATE primero; si no existe, INSERT
  // =================================================================================
  router.post('/heartbeat', auth, async (req, res) => {
    const { deviceId, batteryLevel = null, signalStrength = null } = req.body || {};
    const { userId, eventId = null } = req.auth || {};
    if (!deviceId) return res.status(400).json({ error: 'Falta deviceId' });
    if (!userId)  return res.status(401).json({ error: 'Token inválido' });

    const client = await pool.connect();
    try {
      // nombre del staff (para dashboard)
      let staffName = null;
      try {
        const r = await client.query('SELECT name FROM staff WHERE id = $1 LIMIT 1', [userId]);
        if (r.rows.length) staffName = r.rows[0].name;
      } catch (_) {}

      const now = new Date();

      await client.query('BEGIN');

      const upd = await client.query(
        `UPDATE device_status
            SET staff_name     = COALESCE($2, staff_name),
                battery_level  = COALESCE($3, battery_level),
                signal_strength= COALESCE($4, signal_strength),
                last_seen      = $5,
                event_id       = COALESCE($6, event_id)
          WHERE device_id = $1`,
        [deviceId, staffName, parseInt(batteryLevel), parseInt(signalStrength), now, eventId]
      );

      if (upd.rowCount === 0) {
        await client.query(
          `INSERT INTO device_status (device_id, staff_name, battery_level, signal_strength, last_seen, event_id)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [deviceId, staffName, parseInt(batteryLevel), parseInt(signalStrength), now, eventId]
        );
      }

      await client.query('COMMIT');
      return res.json({ ok: true, message: 'Estado del dispositivo actualizado.' });
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('heartbeat error:', err);
      return res.status(500).json({ error: 'Error interno (heartbeat).' });
    } finally {
      client.release();
    }
  });

  // =================================================================================
  // GET /api/mobile/products   (autenticado)
  // =================================================================================
  router.get('/products', auth, async (req, res) => {
    const { eventId = null } = req.auth || {};
    const client = await pool.connect();
    try {
      if (!eventId) {
        const r = await client.query('SELECT id, name, price FROM products ORDER BY name ASC');
        return res.json({ products: r.rows });
      } else {
        const r = await client.query(
          'SELECT id, name, price FROM products WHERE event_id = $1 AND (is_active IS NULL OR is_active = TRUE) ORDER BY name ASC',
          [eventId]
        );
        return res.json({ products: r.rows });
      }
    } catch (err) {
      console.error('/products error:', err);
      return res.status(500).json({ error: 'Error interno' });
    } finally {
      client.release();
    }
  });

  // =================================================================================
  // GET /api/mobile/customer/:customerUid   (autenticado)
  // =================================================================================
  router.get('/customer/:customerUid', auth, async (req, res) => {
    const { customerUid } = req.params || {};
    const { eventId } = req.auth || {};
    if (!eventId) return res.status(401).json({ error: 'Token inválido' });

    const client = await pool.connect();
    try {
      const ev = await client.query('SELECT id, name FROM events WHERE id = $1 LIMIT 1', [eventId]);
      const event = ev.rows[0] || null;

      const q = await client.query(
        `SELECT uid, customer_number AS "customerNumber", balance, is_active AS "isActive"
           FROM customers
          WHERE uid = $1 AND event_id = $2`,
        [String(customerUid || '').toUpperCase(), eventId]
      );
      if (q.rows.length === 0) return res.status(404).json({ error: 'Tarjeta no encontrada' });

      return res.json({ ...q.rows[0], eventName: event?.name || null });
    } catch (err) {
      console.error('mobile/customer', err);
      res.status(500).json({ error: 'Error interno' });
    } finally {
      client.release();
    }
  });

  // =================================================================================
  // POST /api/mobile/balance   (autenticado)  { cardUid }
  // =================================================================================
  router.post('/balance', auth, async (req, res) => {
    const { cardUid } = req.body || {};
    const { eventId } = req.auth || {};
    if (!eventId) return res.status(401).json({ error: 'Token inválido' });
    if (!cardUid) return res.status(400).json({ error: 'cardUid requerido' });

    try {
      const { rows } = await pool.query(
        `SELECT balance
           FROM customers
          WHERE event_id = $1 AND uid = UPPER($2)`,
        [eventId, cardUid]
      );
      if (!rows.length) return res.json({ balance: 0, exists: false });
      res.json({ balance: Number(rows[0].balance), exists: true });
    } catch (e) {
      console.error('balance error:', e);
      res.status(500).json({ error: 'Error interno' });
    }
  });

  // =================================================================================
  // POST /api/mobile/recharge   (autenticado)
  //   { customerUid, amount }  — Auto-alta si no existe
  //   * Restringido a CAJERO / ADMINISTRADOR / ENCARGADO
  // =================================================================================
  router.post('/recharge', auth, async (req, res) => {
    const { customerUid, amount } = req.body || {};
    const role = String(req.auth?.role || '').toUpperCase();
    const staffId = req.auth?.userId;
    const eventId = req.auth?.eventId;

    if (!staffId || !eventId) return res.status(401).json({ error: 'Token inválido' });
    if (!['CAJERO', 'ADMINISTRADOR', 'ENCARGADO'].includes(role)) {
      return res.status(403).json({ error: 'No autorizado' });
    }
    if (!customerUid || !Number.isFinite(Number(amount)) || Number(amount) <= 0) {
      return res.status(400).json({ error: 'Datos de recarga inválidos' });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Auto-alta si no existe
      await client.query(
        `INSERT INTO customers (uid, event_id, balance, is_active)
         SELECT UPPER($1), $2, 0, TRUE
         WHERE NOT EXISTS (
           SELECT 1 FROM customers WHERE uid = UPPER($1) AND event_id = $2
         )`,
        [customerUid, eventId]
      );

      // Bloquea la fila y actualiza saldo
      const cust = await client.query(
        `SELECT uid, balance, is_active
           FROM customers
          WHERE uid = UPPER($1) AND event_id = $2
          FOR UPDATE`,
        [customerUid, eventId]
      );
      if (!cust.rowCount) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Cliente no encontrado' });
      }
      if (cust.rows[0].is_active === false) {
        await client.query('ROLLBACK');
        return res.status(403).json({ error: 'Tarjeta bloqueada' });
      }

      const rec = Number(amount);
      const newBalance = Number(cust.rows[0].balance) + rec;

      await client.query(
        `UPDATE customers SET balance = $1 WHERE uid = UPPER($2) AND event_id = $3`,
        [newBalance, customerUid, eventId]
      );

      await client.query(
        `INSERT INTO transactions
           (event_id, type, amount, staff_id, customer_uid, customer_event_id, details, timestamp)
         VALUES
           ($1, 'Recarga', $2, $3, UPPER($4), $1, 'Recarga móvil', NOW())`,
        [eventId, rec, staffId, customerUid]
      );

      await client.query('COMMIT');
      res.status(201).json({ newBalance: newBalance.toFixed(2), message: 'Recarga exitosa' });
    } catch (e) {
      await client.query('ROLLBACK');
      console.error('mobile/recharge', e);
      res.status(500).json({ error: 'Error interno' });
    } finally {
      client.release();
    }
  });

  // =================================================================================
  // POST /api/mobile/sale   (autenticado)
  //   { customerUid, items: [{productId, quantity}] }
  //   - Descuenta saldo, registra transacción con detalle JSON
  // =================================================================================
  router.post('/sale', auth, async (req, res) => {
    const { customerUid, items } = req.body || {};
    const staffId = req.auth?.userId;
    const eventId = req.auth?.eventId;

    if (!staffId || !eventId) return res.status(401).json({ error: 'Token inválido' });
    if (!customerUid || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Datos de venta incompletos' });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Trae precios de productos
      const productIds = items.map(i => i.productId);
      const productsRes = await client.query(
        'SELECT id, name, price FROM products WHERE event_id = $1 AND id = ANY($2::uuid[])',
        [eventId, productIds]
      );
      if (productsRes.rows.length !== productIds.length) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Producto inválido' });
      }
      const productMap = new Map(productsRes.rows.map(p => [String(p.id), p]));

      // Calcula total y arma details JSON
      let total = 0;
      const detailItems = [];
      for (const it of items) {
        const p = productMap.get(String(it.productId));
        const qty = Number(it.quantity || 0);
        if (!p || qty <= 0) {
          await client.query('ROLLBACK');
          return res.status(400).json({ error: 'Ítems inválidos' });
        }
        const price = Number(p.price);
        total += price * qty;
        detailItems.push({ productId: p.id, name: p.name, qty, price });
      }

      // Bloquea cliente y verifica saldo
      const custRes = await client.query(
        'SELECT uid, balance, is_active FROM customers WHERE uid = UPPER($1) AND event_id = $2 FOR UPDATE',
        [customerUid, eventId]
      );
      if (!custRes.rowCount) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Cliente no encontrado' }); }
      const customer = custRes.rows[0];
      if (customer.is_active === false) { await client.query('ROLLBACK'); return res.status(403).json({ error: 'Tarjeta bloqueada' }); }

      const balance = Number(customer.balance);
      if (balance < total) {
        await client.query('ROLLBACK');
        return res.status(409).json({ error: `Saldo insuficiente. Saldo: ${balance.toFixed(2)}` });
      }

      // Actualiza saldo
      const newBalance = balance - total;
      await client.query(
        'UPDATE customers SET balance = $1 WHERE uid = UPPER($2) AND event_id = $3',
        [newBalance, customerUid, eventId]
      );

      // Asiento de venta (monto NEGATIVO para ventas, acorde a tu práctica previa)
      await client.query(
        `INSERT INTO transactions
           (event_id, type, amount, staff_id, customer_uid, customer_event_id, details, timestamp)
         VALUES
           ($1, 'Venta', $2, $3, UPPER($4), $1, $5, NOW())`,
        [eventId, -total, staffId, customerUid, JSON.stringify({ items: detailItems })]
      );

      await client.query('COMMIT');
      res.status(201).json({ newBalance: newBalance.toFixed(2), message: 'Venta exitosa' });
    } catch (e) {
      await client.query('ROLLBACK');
      console.error('mobile/sale', e);
      res.status(500).json({ error: 'Error interno' });
    } finally {
      client.release();
    }
  });

  // =================================================================================
  // GET /api/mobile/sales/summary   (autenticado)
  //   - Resumen del vendedor por producto en el día
  // =================================================================================
  router.get('/sales/summary', auth, async (req, res) => {
    const eventId = req.auth?.eventId;
    const staffId = req.auth?.userId;
    if (!eventId || !staffId) return res.status(401).json({ error: 'Token inválido' });

    try {
      const { rows } = await pool.query(
        `WITH s AS (
           SELECT (details::jsonb)->'items' AS items
             FROM transactions
            WHERE event_id=$1 AND staff_id=$2 AND type='Venta'
              AND timestamp::date = now()::date
         )
         SELECT
           COALESCE(p.name, i->>'name') AS product_name,
           SUM( (i->>'qty')::int ) AS qty,
           SUM( (i->>'qty')::int * (i->>'price')::numeric ) AS amount
         FROM s, LATERAL jsonb_array_elements(items) i
         LEFT JOIN products p ON (p.id::text = i->>'productId')
         GROUP BY COALESCE(p.name, i->>'name')
         ORDER BY product_name ASC`,
        [eventId, staffId]
      );
      res.json({ rows });
    } catch (e) {
      console.error('summary error:', e);
      res.status(500).json({ error: 'Error interno' });
    }
  });

  // =================================================================================
  // POST /api/mobile/sales/:id/cancel   (autenticado, requiere ADMINISTRADOR/ENCARGADO)
  //   { buyerCardUid, reason? }
  //   - Devuelve saldo al comprador y registra transacción de cancelación
  // =================================================================================
  router.post('/sales/:id/cancel', auth, async (req, res) => {
    const eventId = req.auth?.eventId;
    const staffId = req.auth?.userId;
    const role = req.auth?.role;

    if (!eventId || !staffId) return res.status(401).json({ error: 'Token inválido' });
    if (!isManager(role)) return res.status(403).json({ error: 'Rol no autorizado' });

    const saleId = req.params.id;
    const { buyerCardUid, reason = 'cancel' } = req.body || {};
    if (!buyerCardUid) return res.status(400).json({ error: 'buyerCardUid requerido' });

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const saleRows = await client.query(
        `SELECT id, amount, customer_uid
           FROM transactions
          WHERE id=$1 AND event_id=$2 AND type='Venta'
          FOR UPDATE`,
        [saleId, eventId]
      );
      if (!saleRows.rowCount) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Venta no encontrada' });
      }
      const sale = saleRows.rows[0];
      if (String(sale.customer_uid || '').toUpperCase() !== String(buyerCardUid).toUpperCase()) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Tarjeta del comprador no coincide' });
      }

      // Devuelve saldo (amount en ventas lo guardamos NEGATIVO, así que devolvemos -amount)
      const refund = -Number(sale.amount);
      await client.query(
        `UPDATE customers
            SET balance = balance + $1
          WHERE event_id=$2 AND uid=UPPER($3)`,
        [refund, eventId, buyerCardUid]
      );

      await client.query(
        `INSERT INTO transactions
           (event_id, type, amount, staff_id, customer_uid, customer_event_id, details, timestamp)
         VALUES
           ($1, 'Cancelación', $2, $3, UPPER($4), $1, $5, NOW())`,
        [eventId, refund, staffId, buyerCardUid, JSON.stringify({ reason, original_sale_id: sale.id })]
      );

      await client.query('COMMIT');
      res.json({ ok: true });
    } catch (e) {
      await client.query('ROLLBACK');
      console.error('cancel error:', e);
      res.status(500).json({ error: 'Error interno' });
    } finally {
      client.release();
    }
  });

  // Salud del router
  router.get('/ping', (_req, res) => res.json({ pong: true }));

  return router;
};
