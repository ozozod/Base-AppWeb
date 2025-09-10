// routes/mobile.js
const express = require('express');
const jwt = require('jsonwebtoken');

/**
 * Enchufá tus dependencias actuales acá para NO duplicar nada.
 * @param {object} deps
 * @param {import('pg').Pool} deps.pool          // tu pool actual
 * @param {function} [deps.requireAuth]          // tu middleware actual (opcional)
 * @param {function} [deps.signToken]            // tu helper actual (opcional)
 * @returns {express.Router}
 */
module.exports = function mobileRouter({ pool, requireAuth, signToken }) {
  const router = express.Router();

  // helper local solo si NO nos pasás signToken
  function localSignToken(user, eventId) {
    const secret = process.env.JWT_SECRET || 'dev-secret';
    return jwt.sign(
      { userId: user.id, role: user.role, eventId },
      secret,
      { expiresIn: '12h' }
    );
  }

  // Si no nos pasás requireAuth, dejamos pasar (útil para probar rápido)
  const auth = requireAuth || ((req, _res, next) => { req.auth = req.auth || {}; next(); });

  // === POST /api/mobile/login  (login por tarjeta del STAFF) ===
  router.post('/login', async (req, res) => {
    let { cardUid } = req.body || {};
    if (!cardUid) return res.status(400).json({ error: 'cardUid requerido' });
  
    // Normalizar UID (mayúsculas, sin espacios)
    cardUid = String(cardUid).trim().toUpperCase();
  
    // También probamos con el UID "reverso" (Android suele darlo LSB->MSB)
    const reversed = (cardUid.match(/.{1,2}/g) || []).reverse().join('');
  
    try {
      // Buscar staff en cualquier evento activo (soporta 'activo' o 'active')
      const staffRes = await pool.query(
        `
        SELECT s.id, s.name, s.role, s.event_id AS "eventId", e.name AS "eventName"
        FROM staff s
        JOIN events e ON e.id = s.event_id
        WHERE s.is_active = true
          AND e.status IN ('activo','active')
          AND s.card_uid IN ($1, $2)
        LIMIT 1
        `,
        [cardUid, reversed]
      );
  
      if (staffRes.rows.length === 0) {
        return res.status(401).json({
          error: 'Credenciales inválidas o usuario inactivo/no asignado a un evento activo',
          debug: { tried: [cardUid, reversed] } // podés quitar esto en prod
        });
      }
  
      const user = staffRes.rows[0];
      const token = signToken ? signToken(user, user.eventId) : localSignToken(user, user.eventId);
      return res.json({ token, user, event: { id: user.eventId, name: user.eventName } });
    } catch (e) {
      console.error('mobile/login', e);
      return res.status(500).json({ error: 'Error interno' });
    }
  });

  // === POST /api/mobile/heartbeat (Reporte de estado del dispositivo) ===
  router.post('/heartbeat', auth, async (req, res) => {
    const { deviceId, batteryLevel, signalStrength } = req.body;
    const { userId: staffId, eventId } = req.auth || {};

    if (!deviceId || !staffId || !eventId) {
        return res.status(400).json({ error: 'Faltan datos requeridos (deviceId, token de autenticación).' });
    }

    try {
        const userRes = await pool.query('SELECT name FROM staff WHERE id = $1', [staffId]);
        const staffName = userRes.rows.length > 0 ? userRes.rows[0].name : 'Desconocido';

        const upsertQuery = `
            INSERT INTO device_status (device_id, event_id, staff_id, staff_name, battery_level, signal_strength, last_seen)
            VALUES ($1, $2, $3, $4, $5, $6, NOW())
            ON CONFLICT (device_id) 
            DO UPDATE SET
                event_id = EXCLUDED.event_id,
                staff_id = EXCLUDED.staff_id,
                staff_name = EXCLUDED.staff_name,
                battery_level = EXCLUDED.battery_level,
                signal_strength = EXCLUDED.signal_strength,
                last_seen = NOW();
        `;
        
        await pool.query(upsertQuery, [deviceId, eventId, staffId, staffName, batteryLevel, signalStrength]);
        
        res.status(200).json({ ok: true, message: 'Estado del dispositivo actualizado.' });
    } catch (e) {
        console.error('mobile/heartbeat', e);
        // Verificar si el error se debe a que la tabla no existe
        if (e.code === '42P01') { // 'undefined_table'
            return res.status(500).json({ error: 'Error interno: La tabla "device_status" no existe. Por favor, ejecute el script de creación de tabla necesario.' });
        }
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
  });

  // === GET /api/mobile/me  (perfil por token) ===
  router.get('/me', auth, async (req, res) => {
    try {
      const { userId, eventId } = req.auth || {};
      if (!userId || !eventId) return res.status(401).json({ error: 'Token inválido' });

      const q = await pool.query(
        'SELECT id, name, role, event_id AS "eventId" FROM staff WHERE id = $1 AND event_id = $2',
        [userId, eventId]
      );
      if (q.rows.length === 0) return res.status(404).json({ error: 'Usuario no encontrado' });

      res.json({ user: q.rows[0] });
    } catch (e) {
      console.error('mobile/me', e);
      res.status(500).json({ error: 'Error interno' });
    }
  });

  // === GET /api/mobile/products  (productos activos del evento) ===
  router.get('/products', auth, async (req, res) => {
    try {
      const { eventId } = req.auth || {};
      if (!eventId) return res.status(401).json({ error: 'Token inválido' });

      const q = await pool.query(
        'SELECT id, name, price FROM products WHERE event_id = $1 AND is_active = true ORDER BY name ASC',
        [eventId]
      );
      res.json(q.rows);
    } catch (e) {
      console.error('mobile/products', e);
      res.status(500).json({ error: 'Error interno' });
    }
  });

  // === GET /api/mobile/customer/:customerUid  (consultar saldo de cliente) ===
  router.get('/customer/:customerUid', auth, async (req, res) => {
    const { customerUid } = req.params;
    try {
      const { eventId } = req.auth || {};
      if (!eventId) return res.status(401).json({ error: 'Token inválido' });

      const ev = await pool.query('SELECT id, name FROM events WHERE id = $1 LIMIT 1', [eventId]);
      const event = ev.rows[0];

      const q = await pool.query(
        'SELECT uid, customer_number AS "customerNumber", balance, is_active AS "isActive" FROM customers WHERE uid = $1 AND event_id = $2',
        [customerUid, eventId]
      );
      if (q.rows.length === 0) return res.status(404).json({ error: 'Tarjeta no encontrada' });

      res.json({ ...q.rows[0], eventName: event?.name });
    } catch (e) {
      console.error('mobile/customer', e);
      res.status(500).json({ error: 'Error interno' });
    }
  });

  // === POST /api/mobile/sale  (venta) ===
  router.post('/sale', auth, async (req, res) => {
    const { customerUid, items } = req.body || {};
    const staffId = req.auth?.userId;
    if (!staffId || !customerUid || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Datos de venta incompletos' });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const { eventId } = req.auth;

      const productIds = items.map(i => i.productId);
      const productsRes = await client.query(
        'SELECT id, name, price FROM products WHERE event_id = $1 AND id = ANY($2::uuid[])',
        [eventId, productIds]
      );
      if (productsRes.rows.length !== productIds.length) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Producto inválido' });
      }

      const productMap = new Map(productsRes.rows.map(p => [p.id, p]));
      let total = 0;
      const details = [];
      for (const it of items) {
        const p = productMap.get(it.productId);
        total += parseFloat(p.price) * it.quantity;
        details.push(`${it.quantity}x ${p.name}`);
      }

      const custRes = await client.query(
        'SELECT * FROM customers WHERE uid = $1 AND event_id = $2 FOR UPDATE',
        [customerUid, eventId]
      );
      if (custRes.rows.length === 0) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Cliente no encontrado' }); }
      const customer = custRes.rows[0];
      if (!customer.is_active) { await client.query('ROLLBACK'); return res.status(403).json({ error: 'Tarjeta bloqueada' }); }

      const balance = parseFloat(customer.balance);
      if (balance < total) {
        await client.query('ROLLBACK');
        return res.status(409).json({ error: `Saldo insuficiente. Saldo: ${balance.toFixed(2)}` });
      }

      const newBalance = balance - total;
      await client.query('UPDATE customers SET balance = $1 WHERE uid = $2 AND event_id = $3',
        [newBalance, customerUid, eventId]);

      const trx = await client.query(
        `INSERT INTO transactions (event_id, type, amount, staff_id, customer_uid, customer_event_id, details)
         VALUES ($1, 'Venta', $2, $3, $4, $1, $5) RETURNING id`,
        [eventId, -total, staffId, customerUid, details.join(', ')]
      );

      await client.query('COMMIT');
      res.status(201).json({ transactionId: trx.rows[0].id, newBalance: newBalance.toFixed(2), message: 'Venta exitosa' });
    } catch (e) {
      await pool.query('ROLLBACK');
      console.error('mobile/sale', e);
      res.status(500).json({ error: 'Error interno' });
    } finally {
      client.release();
    }
  });

  // === POST /api/mobile/recharge  (recarga) ===
  router.post('/recharge', auth, async (req, res) => {
    const { customerUid, amount } = req.body || {};
    const staffId = req.auth?.userId;
    const role = req.auth?.role;
    if (!staffId || !customerUid || !amount || parseFloat(amount) <= 0) {
      return res.status(400).json({ error: 'Datos de recarga incompletos' });
    }
    if (!['CAJERO', 'ADMINISTRADOR', 'ENCARGADO'].includes(role)) {
      return res.status(403).json({ error: 'No autorizado' });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const { eventId } = req.auth;

      const custRes = await client.query(
        'SELECT * FROM customers WHERE uid = $1 AND event_id = $2 FOR UPDATE',
        [customerUid, eventId]
      );
      if (custRes.rows.length === 0) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Cliente no encontrado' }); }
      const customer = custRes.rows[0];
      if (!customer.is_active) { await client.query('ROLLBACK'); return res.status(403).json({ error: 'Tarjeta bloqueada' }); }

      const recharge = parseFloat(amount);
      const newBalance = parseFloat(customer.balance) + recharge;

      await client.query('UPDATE customers SET balance = $1 WHERE uid = $2 AND event_id = $3',
        [newBalance, customerUid, eventId]);

      const trx = await client.query(
        `INSERT INTO transactions (event_id, type, amount, staff_id, customer_uid, customer_event_id, details)
         VALUES ($1, 'Recarga', $2, $3, $4, $1, 'Recarga móvil') RETURNING id`,
        [eventId, recharge, staffId, customerUid]
      );

      await client.query('COMMIT');
      res.status(201).json({ transactionId: trx.rows[0].id, newBalance: newBalance.toFixed(2), message: 'Recarga exitosa' });
    } catch (e) {
      await pool.query('ROLLBACK');
      console.error('mobile/recharge', e);
      res.status(500).json({ error: 'Error interno' });
    } finally {
      client.release();
    }
  });

  // === POST /api/mobile/register-card  (alta de BUYER o STAFF) ===
  router.post('/register-card', auth, async (req, res) => {
    try {
      const by = req.auth?.role || 'DESCONOCIDO';
      if (!['ADMINISTRADOR', 'ENCARGADO'].includes(by)) {
        return res.status(403).json({ error: 'Solo administrador/encargado pueden registrar tarjetas' });
      }

      const { entity, cardUid, role, name, number } = req.body || {};
      if (!entity || !cardUid) {
        return res.status(400).json({ error: 'entity y cardUid son requeridos' });
      }

      const ev = await pool.query("SELECT id, name FROM events WHERE status = 'activo' LIMIT 1");
      if (ev.rows.length === 0) return res.status(404).json({ error: 'No hay evento activo' });
      const event = ev.rows[0];

      if (entity === 'BUYER') {
        // Si necesitás otro nombre de columna para "customer_number", ajustalo acá.
        const exists = await pool.query('SELECT 1 FROM customers WHERE uid = $1 AND event_id = $2', [cardUid, event.id]);
        if (exists.rowCount > 0) return res.status(409).json({ error: 'Esa tarjeta ya está registrada como cliente' });

        const ins = await pool.query(
          `INSERT INTO customers (uid, event_id, customer_number, balance, is_active)
           VALUES ($1, $2, $3, 0, true) RETURNING uid, customer_number AS "customerNumber", balance, is_active AS "isActive"`,
          [cardUid, event.id, number || null]
        );
        return res.status(201).json({ message: 'Cliente creado', customer: ins.rows[0], event });

      } else if (entity === 'STAFF') {
        if (!role) return res.status(400).json({ error: 'role requerido para STAFF' });

        const exists = await pool.query('SELECT 1 FROM staff WHERE card_uid = $1 AND event_id = $2', [cardUid, event.id]);
        if (exists.rowCount > 0) return res.status(409).json({ error: 'Esa tarjeta ya está registrada como staff' });

        const ins = await pool.query(
          `INSERT INTO staff (name, role, card_uid, event_id, is_active)
           VALUES ($1, $2, $3, $4, true) RETURNING id, name, role, card_uid AS "cardUid", event_id AS "eventId"`,
          [name || null, role, cardUid, event.id]
        );
        return res.status(201).json({ message: 'Staff creado', staff: ins.rows[0], event });

      } else {
        return res.status(400).json({ error: 'entity debe ser BUYER o STAFF' });
      }
    } catch (e) {
      console.error('mobile/register-card', e);
      res.status(500).json({ error: 'Error interno' });
    }
  });

  return router;
};