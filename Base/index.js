require('dotenv').config();

const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const jwt = require('jsonwebtoken');

const app = express();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://admin_eventos:2312@localhost:5432/gestion_eventos_db'
});

// Middlewares
app.use(cors());
app.use(express.json({ verify: (req, res, buf) => { req.rawBody = buf.toString(); } }));
app.use(express.urlencoded({ extended: false }));

// Debug echo
app.post('/debug/echo', (req, res) => {
  res.json({ contentType: req.headers['content-type'], raw: req.rawBody, parsed: req.body });
});

// Helpers auth
const signToken = (user, eventId) => {
  const secret = process.env.JWT_SECRET || 'dev-secret';
  const payload = { userId: user.id, role: user.role, eventId };
  return jwt.sign(payload, secret, { expiresIn: '12h' });
};
const requireAuth = (req, res, next) => {
  const { authorization } = req.headers || {};
  if (!authorization || !authorization.startsWith('Bearer ')) return next();
  try { const token = authorization.split(' ')[1]; req.auth = jwt.verify(token, process.env.JWT_SECRET || 'dev-secret'); }
  catch (_) {}
  next();
};

// Router móvil
const mobileRouter = require('./routes/mobile')({ pool, requireAuth, signToken });
app.use('/api/mobile', mobileRouter);

// ... (tus rutas /api/events, /api/products, etc. permanecen igual)

// --- Server (único) ---
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';

// Evita levantar dos veces si el archivo se requiere desde otro módulo/test
if (require.main === module) {
  if (!global.__server) {
    global.__server = app
      .listen(PORT, HOST, () => {
        console.log(`Servidor API escuchando en http://${HOST}:${PORT}`);
      })
      .on('error', (err) => {
        console.error('listen error:', err);
        process.exit(1);
      });
  }
}

module.exports = app;
// =================================================================
// === GESTIÓN DE EVENTOS
// =================================================================
// --- OBTENER TODOS LOS EVENTOS ---
app.get('/api/events', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT id, name, status, created_at as "createdAt" FROM events ORDER BY created_at DESC');
    res.status(200).json(rows);
  } catch (error) {
    console.error('Error al obtener eventos:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// --- OBTENER EL EVENTO ACTIVO ---
app.get('/api/events/active', async (req, res) => {
  try {
    const { rows } = await pool.query("SELECT * FROM events WHERE status = 'activo' LIMIT 1");
    if (rows.length === 0) {
      return res.status(404).json({ error: 'No se encontró ningún evento activo.' });
    }
    res.status(200).json(rows[0]);
  } catch (error) {
    console.error('Error al obtener evento activo:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// --- OBTENER TODOS LOS DETALLES DE UN EVENTO PARA EL DASHBOARD ---
app.get('/api/events/:eventId/details', async (req, res) => {
    const { eventId } = req.params;
    try {
        const eventQuery = 'SELECT id, name, status, created_at AS "createdAt" FROM events WHERE id = $1';
        
        // Usamos alias para que coincida con los tipos camelCase del frontend
        const usersQuery = 'SELECT id, event_id AS "eventId", name, employee_number AS "employeeNumber", role, card_uid AS "cardUid", is_active FROM staff WHERE event_id = $1 ORDER BY name ASC';
        const cardsQuery = 'SELECT uid, event_id AS "eventId", customer_number AS "customerNumber", balance, is_active FROM customers WHERE event_id = $1 ORDER BY customer_number ASC';
        const productsQuery = 'SELECT id, event_id AS "eventId", name, price, is_active FROM products WHERE event_id = $1 ORDER BY name ASC';
        const transactionsQuery = 'SELECT id, event_id AS "eventId", type, amount, timestamp, staff_id AS "userId", customer_uid AS "customerCardUid", details FROM transactions WHERE event_id = $1 ORDER BY "timestamp" DESC';

        const [eventRes, usersRes, cardsRes, productsRes, transactionsRes] = await Promise.all([
            pool.query(eventQuery, [eventId]),
            pool.query(usersQuery, [eventId]),
            pool.query(cardsQuery, [eventId]),
            pool.query(productsQuery, [eventId]),
            pool.query(transactionsQuery, [eventId])
        ]);

        if (eventRes.rows.length === 0) {
            return res.status(404).json({ error: 'Evento no encontrado.' });
        }

        const transactionsByCard = transactionsRes.rows.reduce((acc, tx) => {
            if (!acc[tx.customerCardUid]) {
                acc[tx.customerCardUid] = [];
            }
            acc[tx.customerCardUid].push(tx);
            return acc;
        }, {});

        const cardsWithHistory = cardsRes.rows.map(card => ({
            ...card,
            history: transactionsByCard[card.uid] || []
        }));

        const eventDetails = { 
            event: eventRes.rows[0], 
            users: usersRes.rows, 
            cards: cardsWithHistory, 
            products: productsRes.rows, 
            transactions: transactionsRes.rows 
        };
        res.status(200).json(eventDetails);
    } catch (error) {
        console.error(`Error al obtener los detalles del evento ${eventId}:`, error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});


// --- OBTENER RESUMEN EN VIVO DEL EVENTO ---
app.get('/api/events/:eventId/summary', async (req, res) => {
    const { eventId } = req.params;
    try {
        const [customerCountRes, totalBalanceRes, recentTransactionsRes] = await Promise.all([
            pool.query('SELECT COUNT(*) AS count FROM customers WHERE event_id = $1', [eventId]),
            pool.query('SELECT COALESCE(SUM(balance), 0) AS total_balance FROM customers WHERE event_id = $1', [eventId]),
            pool.query('SELECT * FROM transactions WHERE event_id = $1 ORDER BY "timestamp" DESC LIMIT 5', [eventId])
        ]);
        const summary = { totalCustomers: parseInt(customerCountRes.rows[0].count, 10), totalBalance: parseFloat(totalBalanceRes.rows[0].total_balance), recentTransactions: recentTransactionsRes.rows };
        res.status(200).json(summary);
    } catch (error) {
        console.error('Error al obtener el resumen del evento:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// --- CREAR UN NUEVO EVENTO ---
app.post('/api/events', async (req, res) => {
    const { name } = req.body;
    if (!name) { return res.status(400).json({ error: 'El nombre del evento es requerido.' }); }
    try {
        await pool.query("UPDATE events SET status = 'finalizado'");
        const { rows } = await pool.query("INSERT INTO events (name, status) VALUES ($1, 'activo') RETURNING *", [name]);
        res.status(201).json(rows[0]);
    } catch (error) {
        console.error('Error al crear evento:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// --- ELIMINAR UN EVENTO Y TODOS SUS DATOS ---
app.delete('/api/events/:eventId', async (req, res) => {
    const { eventId } = req.params;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        // El `ON DELETE CASCADE` en la tabla `device_status` y otras tablas
        // se encargará de limpiar los registros asociados.
        const deleteEventResult = await client.query('DELETE FROM events WHERE id = $1', [eventId]);
        
        if (deleteEventResult.rowCount === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Evento no encontrado.' });
        }
        
        await client.query('COMMIT');
        res.status(204).send(); // No content
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error al eliminar evento:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    } finally {
        client.release();
    }
});

// --- ACTUALIZAR ESTADO DE UN EVENTO (ACTIVAR/FINALIZAR) ---
app.put('/api/events/:eventId', async (req, res) => {
    const { eventId } = req.params;
    const { status } = req.body;
    if (status !== 'activo' && status !== 'finalizado') {
        return res.status(400).json({ error: "El estado solo puede ser 'activo' o 'finalizado'." });
    }
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        // Si se activa este evento, todos los demás deben finalizar
        if (status === 'activo') {
            await client.query("UPDATE events SET status = 'finalizado' WHERE id != $1", [eventId]);
        }
        const { rows } = await client.query("UPDATE events SET status = $1 WHERE id = $2 RETURNING *", [status, eventId]);
        if (rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Evento no encontrado.' });
        }
        await client.query('COMMIT');
        res.status(200).json(rows[0]);
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error al actualizar estado del evento:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    } finally {
        client.release();
    }
});

// =================================================================
// === GESTIÓN DE DISPOSITIVOS =====================================
// =================================================================
app.get('/api/events/:eventId/devices', async (req, res) => {
    const { eventId } = req.params;
    try {
        const query = `
            SELECT 
                id, 
                device_id AS "deviceId",
                event_id AS "eventId",
                staff_id AS "staffId",
                staff_name AS "staffName",
                battery_level AS "batteryLevel",
                signal_strength AS "signalStrength",
                last_seen AS "lastSeen"
            FROM device_status 
            WHERE event_id = $1 
            ORDER BY last_seen DESC
        `;
        const { rows } = await pool.query(query, [eventId]);
        res.status(200).json(rows);
    } catch (error) {
        console.error('Error al obtener el estado de los dispositivos:', error);
        if (error.code === '42P01') { // 'undefined_table'
            return res.status(500).json({ 
                error: 'Error de configuración: La tabla "device_status" no se encuentra en la base de datos. Es necesaria para la pestaña Dispositivos.' 
            });
        }
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});


// =================================================================
// === GESTIÓN DE COMPRADORES (CARDS) ==============================
// =================================================================

// --- OBTENER TODAS LAS TARJETAS DE UN EVENTO ---
app.get('/api/events/:eventId/cards', async (req, res) => {
    const { eventId } = req.params;
    try {
        const { rows } = await pool.query('SELECT uid, event_id AS "eventId", customer_number AS "customerNumber", balance, is_active FROM customers WHERE event_id = $1 ORDER BY customer_number ASC', [eventId]);
        res.status(200).json(rows);
    } catch (error) {
        console.error('Error al obtener compradores:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// --- OBTENER UNA TARJETA ESPECÍFICA POR UID ---
app.get('/api/events/:eventId/cards/:uid', async (req, res) => {
  const { eventId, uid } = req.params;
  try {
    const { rows } = await pool.query('SELECT uid, customer_number as "customerNumber", balance, is_active FROM customers WHERE event_id=$1 AND uid=$2', [eventId, uid]);
    if (rows.length === 0) { return res.status(404).json({ error: 'Tarjeta de cliente no encontrada.' }); }
    res.status(200).json(rows[0]);
  } catch (e) { 
      console.error("Error al obtener tarjeta por UID:", e);
      res.status(500).json({ error: 'Error interno del servidor' }); 
  }
});

// --- REGISTRAR UN NUEVO COMPRADOR ---
app.post('/api/events/:eventId/cards', async (req, res) => {
    const { eventId } = req.params;
    const { uid, customerNumber } = req.body;
    if (!uid) { return res.status(400).json({ error: 'El UID de la tarjeta es requerido.' }); }
    try {
        // Si customerNumber es una cadena vacía o solo espacios, trátelo como NULL.
        const finalCustomerNumber = (customerNumber && customerNumber.trim()) ? customerNumber.trim() : null;

        const { rows } = await pool.query(
            'INSERT INTO customers (uid, event_id, customer_number, balance, is_active) VALUES ($1, $2, $3, 0, true) RETURNING *', 
            [uid, eventId, finalCustomerNumber]
        );
        res.status(201).json(rows[0]);
    } catch (error) {
        console.error('Error al crear comprador:', error);
        if (error.code === '23505') { 
            return res.status(409).json({ error: 'El UID o el Número de Comprador ya está en uso en este evento.' }); 
        }
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});


// --- ACTUALIZAR TARJETA DE UN COMPRADOR ---
app.put('/api/events/:eventId/cards/:cardUid', async (req, res) => {
    const { eventId, cardUid } = req.params;
    const { is_active, customerNumber } = req.body;
    
    const fields = [];
    const values = [];
    let queryIndex = 1;

    if (customerNumber !== undefined) {
        fields.push(`customer_number = $${queryIndex++}`);
        values.push(customerNumber);
    }
    if (is_active !== undefined) {
        if (typeof is_active !== 'boolean') return res.status(400).json({ error: 'is_active debe ser un booleano.' });
        fields.push(`is_active = $${queryIndex++}`);
        values.push(is_active);
    }

    if (fields.length === 0) {
        return res.status(400).json({ error: 'No se proporcionaron campos para actualizar.' });
    }

    values.push(eventId, cardUid);
    const queryString = `UPDATE customers SET ${fields.join(', ')} WHERE event_id = $${queryIndex++} AND uid = $${queryIndex++} RETURNING *`;

    try {
        const { rows } = await pool.query(queryString, values);
        if (rows.length === 0) {
            return res.status(404).json({ error: 'Tarjeta de comprador no encontrada en este evento.' });
        }
        res.status(200).json(rows[0]);
    } catch (error) {
        console.error('Error al actualizar tarjeta del comprador:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// --- ELIMINAR UN COMPRADOR ---
app.delete('/api/events/:eventId/cards/:cardUid', async (req, res) => {
    const { eventId, cardUid } = req.params;
    try {
        const cardRes = await pool.query('SELECT balance FROM customers WHERE uid = $1 AND event_id = $2', [cardUid, eventId]);
        if (cardRes.rows.length === 0) {
            return res.status(404).json({ error: 'Comprador no encontrado.' });
        }
        if (parseFloat(cardRes.rows[0].balance) > 0) {
            return res.status(409).json({ error: 'No se puede eliminar un comprador con saldo. Realice una devolución total primero.' });
        }
        const txRes = await pool.query('SELECT id FROM transactions WHERE customer_uid = $1 LIMIT 1', [cardUid]);
        if (txRes.rows.length > 0) {
            return res.status(409).json({ error: 'No se puede eliminar un comprador con transacciones registradas. Bloquéelo en su lugar.' });
        }
        await pool.query('DELETE FROM customers WHERE uid = $1 AND event_id = $2', [cardUid, eventId]);
        res.status(204).send();
    } catch (error) {
        console.error('Error al eliminar comprador:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// =================================================================
// === GESTIÓN DE PERSONAL (USERS) =================================
// =================================================================

// --- OBTENER PERSONAL DE UN EVENTO ---
app.get('/api/events/:eventId/users', async (req, res) => {
    const { eventId } = req.params;
    try {
        const { rows } = await pool.query('SELECT id, event_id AS "eventId", name, employee_number AS "employeeNumber", role, card_uid AS "cardUid", is_active FROM staff WHERE event_id = $1 ORDER BY name ASC', [eventId]);
        res.status(200).json(rows);
    } catch (error) {
        console.error('Error al obtener personal:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// --- CREAR MIEMBRO DEL PERSONAL ---
app.post('/api/events/:eventId/users', async (req, res) => {
    const { eventId } = req.params;
    const { name, role, cardUid, employeeNumber } = req.body;
    if (!name || !role || !cardUid) {
        return res.status(400).json({ error: 'Los campos name, role y cardUid son requeridos.' });
    }
    try {
        const { rows } = await pool.query('INSERT INTO staff (event_id, name, role, card_uid, employee_number, is_active) VALUES ($1, $2, $3, $4, $5, true) RETURNING *', [eventId, name, role, cardUid, employeeNumber]);
        res.status(201).json(rows[0]);
    } catch (error) {
        console.error('Error al crear miembro del personal:', error);
        if (error.code === '23505') { return res.status(409).json({ error: 'El UID de la tarjeta de personal ya está en uso en este evento.' }); }
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// --- ACTUALIZAR MIEMBRO DEL PERSONAL ---
app.put('/api/events/:eventId/users/:userId', async (req, res) => {
    const { eventId, userId } = req.params;
    const { name, role, cardUid, employeeNumber, is_active } = req.body;

    const fields = [];
    const values = [];
    let queryIndex = 1;

    if (name !== undefined) { fields.push(`name = $${queryIndex++}`); values.push(name); }
    if (role !== undefined) { fields.push(`role = $${queryIndex++}`); values.push(role); }
    if (cardUid !== undefined) { fields.push(`card_uid = $${queryIndex++}`); values.push(cardUid); }
    if (employeeNumber !== undefined) { fields.push(`employee_number = $${queryIndex++}`); values.push(employeeNumber); }
    if (is_active !== undefined) { 
        if(typeof is_active !== 'boolean') return res.status(400).json({ error: 'is_active debe ser un booleano.' });
        fields.push(`is_active = $${queryIndex++}`); values.push(is_active); 
    }
    
    if (fields.length === 0) {
        return res.status(400).json({ error: 'No se proporcionaron campos para actualizar.' });
    }

    values.push(eventId, userId);
    const queryString = `UPDATE staff SET ${fields.join(', ')} WHERE event_id = $${queryIndex++} AND id = $${queryIndex++} RETURNING id, event_id AS "eventId", name, employee_number AS "employeeNumber", role, card_uid AS "cardUid", is_active`;

    try {
        const { rows } = await pool.query(queryString, values);
        if (rows.length === 0) {
            return res.status(404).json({ error: 'Miembro del personal no encontrado en este evento.' });
        }
        res.status(200).json(rows[0]);
    } catch (error) {
        console.error('Error al actualizar usuario:', error);
        if (error.code === '23505') return res.status(409).json({ error: 'El UID de la tarjeta ya está en uso.' });
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// --- ELIMINAR MIEMBRO DEL PERSONAL ---
app.delete('/api/events/:eventId/users/:userId', async (req, res) => {
    const { eventId, userId } = req.params;
    try {
        const checkTx = await pool.query('SELECT id FROM transactions WHERE staff_id = $1 LIMIT 1', [userId]);
        if (checkTx.rows.length > 0) {
            return res.status(409).json({ error: 'No se puede eliminar un usuario con transacciones registradas. Desactívelo en su lugar.' });
        }
        const result = await pool.query('DELETE FROM staff WHERE id = $1 AND event_id = $2', [userId, eventId]);
        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Usuario no encontrado.' });
        }
        res.status(204).send();
    } catch (error) {
        console.error('Error al eliminar usuario:', error);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});


// =================================================================
// === GESTIÓN DE PRODUCTOS (PRODUCTS) =============================
// =================================================================

// --- OBTENER PRODUCTOS DE UN EVENTO ---
app.get('/api/events/:eventId/products', async (req, res) => {
  try {
    const { eventId } = req.params;
    const { rows } = await pool.query('SELECT id, event_id AS "eventId", name, price, is_active FROM products WHERE event_id = $1 ORDER BY name ASC', [eventId]);
    res.status(200).json(rows);
  } catch (error) {
    console.error('Error al obtener productos:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// --- CREAR UN NUEVO PRODUCTO ---
app.post('/api/events/:eventId/products', async (req, res) => {
    const { eventId } = req.params;
    const { name, price } = req.body;
    if (!name || price === undefined) { return res.status(400).json({ error: 'Los campos name y price son requeridos.' }); }
    if (typeof price !== 'number' || price < 0) { return res.status(400).json({ error: 'El precio debe ser un número no negativo.' }); }
    try {
        const { rows } = await pool.query('INSERT INTO products (event_id, name, price, is_active) VALUES ($1, $2, $3, true) RETURNING *', [eventId, name, price]);
        res.status(201).json(rows[0]);
    } catch (error) {
        console.error('Error al crear producto:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// --- ACTUALIZAR UN PRODUCTO ---
app.put('/api/events/:eventId/products/:productId', async (req, res) => {
    const { eventId, productId } = req.params;
    const { name, price, is_active } = req.body;

    const fields = [];
    const values = [];
    let queryIndex = 1;

    if (name !== undefined) {
        fields.push(`name = $${queryIndex++}`);
        values.push(name);
    }
    if (price !== undefined) {
        if (typeof price !== 'number' || price < 0) {
            return res.status(400).json({ error: 'El precio debe ser un número no negativo.' });
        }
        fields.push(`price = $${queryIndex++}`);
        values.push(price);
    }
    if (is_active !== undefined) {
        if (typeof is_active !== 'boolean') {
            return res.status(400).json({ error: 'is_active debe ser un booleano.' });
        }
        fields.push(`is_active = $${queryIndex++}`);
        values.push(is_active);
    }

    if (fields.length === 0) {
        return res.status(400).json({ error: 'No se proporcionaron campos para actualizar.' });
    }

    values.push(eventId, productId);
    const queryString = `UPDATE products SET ${fields.join(', ')} WHERE event_id = $${queryIndex++} AND id = $${queryIndex++} RETURNING *`;

    try {
        const { rows } = await pool.query(queryString, values);
        if (rows.length === 0) {
            return res.status(404).json({ error: 'Producto no encontrado en este evento.' });
        }
        res.status(200).json(rows[0]);
    } catch (error) {
        console.error('Error al actualizar producto:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// --- ELIMINAR UN PRODUCTO ---
app.delete('/api/events/:eventId/products/:productId', async (req, res) => {
    const { eventId, productId } = req.params;
    try {
        const productRes = await pool.query('SELECT name FROM products WHERE id = $1 AND event_id = $2', [productId, eventId]);
        if (productRes.rows.length === 0) {
            return res.status(404).json({ error: 'Producto no encontrado.' });
        }
        const productName = productRes.rows[0].name;
        const txCheckRes = await pool.query("SELECT id FROM transactions WHERE event_id = $1 AND type = 'Venta' AND details LIKE $2 LIMIT 1", [eventId, `%${productName}%`]);
        if (txCheckRes.rows.length > 0) {
            return res.status(409).json({ error: 'No se puede eliminar un producto que ha sido parte de una venta. Desactívelo en su lugar.' });
        }
        await pool.query('DELETE FROM products WHERE id = $1 AND event_id = $2', [productId, eventId]);
        res.status(204).send();
    } catch (error) {
        console.error('Error al eliminar producto:', error);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});

// =================================================================
// === GESTIÓN DE TRANSACCIONES Y SALDO ============================
// =================================================================

// --- OBTENER TRANSACCIONES (CON FILTROS) ---
app.get('/api/events/:eventId/transactions', async (req, res) => {
    const { eventId } = req.params;
    const { staffId, customerUid } = req.query;
    let query = 'SELECT id, event_id AS "eventId", type, amount, timestamp, staff_id AS "userId", customer_uid AS "customerCardUid", details FROM transactions WHERE event_id = $1';
    const params = [eventId];
    let paramIndex = 2;
    if (staffId) { query += ` AND staff_id = $${paramIndex++}`; params.push(staffId); }
    if (customerUid) { query += ` AND customer_uid = $${paramIndex++}`; params.push(customerUid); }
    query += ' ORDER BY "timestamp" DESC';
    try {
        const { rows } = await pool.query(query, params);
        res.status(200).json(rows);
    } catch (error) {
        console.error('Error al obtener transacciones:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// --- REALIZAR UNA VENTA ---
app.post('/api/transactions/sale', async (req, res) => {
    const { staffId, customerUid, eventId, amount, details } = req.body;
    if (!staffId || !customerUid || !eventId || amount === undefined || typeof amount !== 'number' || amount <= 0) {
        return res.status(400).json({ error: 'Datos de venta inválidos o incompletos.' });
    }
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const customerResult = await client.query('SELECT * FROM customers WHERE uid = $1 AND event_id = $2 FOR UPDATE', [customerUid, eventId]);
        if (customerResult.rows.length === 0) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'La tarjeta del cliente no fue encontrada.' }); }
        const customer = customerResult.rows[0];
        if (!customer.is_active) { await client.query('ROLLBACK'); return res.status(403).json({ error: 'La tarjeta del cliente está bloqueada.' }); }
        const currentBalance = parseFloat(customer.balance);
        if (currentBalance < amount) { await client.query('ROLLBACK'); return res.status(409).json({ error: `Saldo insuficiente. Saldo actual: ${currentBalance.toFixed(2)}` }); }
        const newBalance = currentBalance - amount;
        await client.query('UPDATE customers SET balance = $1 WHERE uid = $2 AND event_id = $3', [newBalance, customerUid, eventId]);
        const transactionResult = await client.query(`INSERT INTO transactions (event_id, type, amount, staff_id, customer_uid, customer_event_id, details) VALUES ($1, 'Venta', $2, $3, $4, $1, $5) RETURNING *`, [eventId, -amount, staffId, customerUid, details]);
        await client.query('COMMIT');
        res.status(201).json(transactionResult.rows[0]);
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error al procesar la venta:', error);
        res.status(500).json({ error: 'Error interno del servidor.' });
    } finally {
        client.release();
    }
});

// --- REALIZAR UNA RECARGA DE SALDO ---
app.post('/api/transactions/recharge', async (req, res) => {
    const { staffId, customerUid, eventId, amount, details } = req.body;
    if (!staffId || !customerUid || !eventId || amount === undefined || typeof amount !== 'number' || amount <= 0) {
      return res.status(400).json({ error: 'Datos de recarga inválidos o incompletos.' });
    }
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const customerResult = await client.query('SELECT * FROM customers WHERE uid = $1 AND event_id = $2 FOR UPDATE', [customerUid, eventId]);
      if (customerResult.rows.length === 0) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'La tarjeta del cliente no fue encontrada.' }); }
      const customer = customerResult.rows[0];
      if (!customer.is_active) { await client.query('ROLLBACK'); return res.status(403).json({ error: 'La tarjeta del cliente está bloqueada.' }); }
      const newBalance = parseFloat(customer.balance) + parseFloat(amount);
      await client.query('UPDATE customers SET balance = $1 WHERE uid = $2 AND event_id = $3', [newBalance, customerUid, eventId]);
      const transactionResult = await client.query( `INSERT INTO transactions (event_id, type, amount, staff_id, customer_uid, customer_event_id, details) VALUES ($1, 'Recarga', $2, $3, $4, $1, $5) RETURNING *`, [eventId, amount, staffId, customerUid, details]);
      await client.query('COMMIT');
      res.status(201).json(transactionResult.rows[0]);
    } catch (e) {
      await client.query('ROLLBACK');
      console.error('Error en la recarga:', e);
      res.status(500).json({ error: 'Error interno del servidor.' });
    } finally {
      client.release();
    }
});

// --- REALIZAR UNA DEVOLUCIÓN PARCIAL ---
app.post('/api/transactions/refund', async (req, res) => {
    const { staffId, customerUid, eventId, amount, details } = req.body;
    if (!staffId || !customerUid || !eventId || amount === undefined || typeof amount !== 'number' || amount <= 0) {
      return res.status(400).json({ error: 'Datos de devolución inválidos o incompletos.' });
    }
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const customerResult = await client.query('SELECT * FROM customers WHERE uid = $1 AND event_id = $2 FOR UPDATE', [customerUid, eventId]);
      if (customerResult.rows.length === 0) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'La tarjeta del cliente no fue encontrada.' }); }
      const customer = customerResult.rows[0];
      const currentBalance = parseFloat(customer.balance);
      if (currentBalance < amount) { await client.query('ROLLBACK'); return res.status(409).json({ error: `No se puede devolver ${amount.toFixed(2)}, el saldo actual es ${currentBalance.toFixed(2)}.` }); }
      const newBalance = currentBalance - amount;
      await client.query('UPDATE customers SET balance = $1 WHERE uid = $2 AND event_id = $3', [newBalance, customerUid, eventId]);
      const signedAmount = -Math.abs(amount);
      const transactionResult = await client.query(`INSERT INTO transactions (event_id, type, amount, staff_id, customer_uid, customer_event_id, details) VALUES ($1, 'Devolución', $2, $3, $4, $1, $5) RETURNING *`, [eventId, signedAmount, staffId, customerUid, details || `Devolución de ${amount.toFixed(2)}`]);
      await client.query('COMMIT');
      res.status(201).json(transactionResult.rows[0]);
    } catch (e) {
      await client.query('ROLLBACK');
      console.error('Error en la devolución:', e);
      res.status(500).json({ error: 'Error interno del servidor.' });
    } finally {
      client.release();
    }
});

// --- REALIZAR DEVOLUCIÓN TOTAL ---
app.post('/api/transactions/refund-total', async (req, res) => {
    const { staffId, customerUid, eventId, details } = req.body;
    if (!staffId || !customerUid || !eventId) {
      return res.status(400).json({ error: 'Datos de devolución inválidos o incompletos.' });
    }
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const customerResult = await client.query('SELECT * FROM customers WHERE uid = $1 AND event_id = $2 FOR UPDATE', [customerUid, eventId]);
      if (customerResult.rows.length === 0) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'La tarjeta del cliente no fue encontrada.' }); }
      const customer = customerResult.rows[0];
      const currentBalance = parseFloat(customer.balance);
      if (currentBalance <= 0) { await client.query('ROLLBACK'); return res.status(409).json({ error: 'No hay saldo para devolver.' }); }
      await client.query('UPDATE customers SET balance = 0 WHERE uid = $1 AND event_id = $2', [customerUid, eventId]);
      const transactionResult = await client.query(`INSERT INTO transactions (event_id, type, amount, staff_id, customer_uid, customer_event_id, details) VALUES ($1, 'Devolución Total', $2, $3, $4, $1, $5) RETURNING *`, [eventId, -currentBalance, staffId, customerUid, details || `Devolución total de ${currentBalance.toFixed(2)}`]);
      await client.query('COMMIT');
      res.status(201).json(transactionResult.rows[0]);
    } catch (e) {
      await client.query('ROLLBACK');
      console.error('Error en la devolución total:', e);
      res.status(500).json({ error: 'Error interno del servidor.' });
    } finally {
      client.release();
    }
});

// --- ANULAR UNA VENTA ---
app.post('/api/transactions/void', async (req, res) => {
    const { transactionId, managerCardUid } = req.body;
    if (!transactionId || !managerCardUid) {
        return res.status(400).json({ error: 'Se requiere el ID de la transacción y el UID de la tarjeta del encargado.' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 1. Obtener la transacción original para validar y obtener el event_id
        const originalTxResult = await client.query('SELECT * FROM transactions WHERE id = $1 FOR UPDATE', [transactionId]);
        if (originalTxResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Transacción original no encontrada.' });
        }
        const originalTx = originalTxResult.rows[0];
        const eventId = originalTx.event_id;

        // 2. Validar que el manager exista, pertenezca al evento, sea manager/admin y esté activo
        const managerResult = await client.query(
            'SELECT * FROM staff WHERE card_uid = $1 AND event_id = $2 AND is_active = true',
            [managerCardUid, eventId]
        );
        if (managerResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(403).json({ error: 'Tarjeta de encargado no válida, inactiva, o no pertenece a este evento.' });
        }
        const manager = managerResult.rows[0];
        if (manager.role !== 'ADMINISTRADOR' && manager.role !== 'ENCARGADO') {
            await client.query('ROLLBACK');
            return res.status(403).json({ error: 'El usuario no tiene permisos para anular transacciones.' });
        }

        // 3. Verificar que es una venta y no ha sido anulada previamente
        if (originalTx.type !== 'Venta') {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'Solo se pueden anular transacciones de tipo "Venta".' });
        }
        
        const existingVoidResult = await client.query("SELECT * FROM transactions WHERE type = 'Anulación' AND details LIKE $1", [`Anulación de tx #${originalTx.id}%`]);
        if (existingVoidResult.rows.length > 0) {
            await client.query('ROLLBACK');
            return res.status(409).json({ error: 'Esta transacción ya ha sido anulada previamente.' });
        }

        // 4. Reembolsar el saldo al cliente
        const customerUid = originalTx.customer_uid;
        const amountToRefund = Math.abs(parseFloat(originalTx.amount));
        if (isNaN(amountToRefund)) {
             await client.query('ROLLBACK');
             console.error(`Invalid amount found in transaction ${originalTx.id}: ${originalTx.amount}`);
             return res.status(500).json({ error: 'El monto de la transacción original es inválido.' });
        }

        const customerResult = await client.query('SELECT * FROM customers WHERE uid = $1 AND event_id = $2 FOR UPDATE', [customerUid, eventId]);
        if (customerResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Cliente de la transacción original no encontrado.' });
        }
        const customer = customerResult.rows[0];
        const newBalance = parseFloat(customer.balance) + amountToRefund;
        await client.query('UPDATE customers SET balance = $1 WHERE uid = $2 AND event_id = $3', [newBalance, customerUid, eventId]);

        // 5. Crear la nueva transacción de anulación, devolviendo los campos con alias para el frontend
        const voidDetails = `Anulación de tx #${originalTx.id}. Autorizado por: ${manager.name}.`;
        const voidTransactionResult = await client.query(
            `INSERT INTO transactions (event_id, type, amount, staff_id, customer_uid, customer_event_id, details) 
             VALUES ($1, 'Anulación', $2, $3, $4, $1, $5) 
             RETURNING id, event_id AS "eventId", type, amount, timestamp, staff_id AS "userId", customer_uid AS "customerCardUid", details`,
            [eventId, amountToRefund, manager.id, customerUid, voidDetails]
        );

        await client.query('COMMIT');
        res.status(201).json(voidTransactionResult.rows[0]);

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error al anular la transacción:', error);
        res.status(500).json({ error: 'Error interno del servidor.' });
    } finally {
        client.release();
    }
});

// =================================================================
// === 6. INICIAR EL SERVIDOR (VERSIÓN PARA RED LOCAL) =============
// =================================================================



// Verificación inicial de la conexión a la base de datos
pool.connect((err, client, done) => {
    if (err) {
      console.error('Error fatal: no se pudo conectar a la base de datos.', err);
      process.exit(1);
    } else {
      console.log('Conexión con la base de datos verificada exitosamente.');
      client.release(); // Devuelve el cliente al pool
    }
});

pool.on('error', (err, client) => {
    console.error('Error inesperado en el cliente de la base de datos', err);
    process.exit(-1);
});