// seed.js
require('dotenv').config();
const { Pool } = require('pg');
const { faker } = require('@faker-js/faker');

// --- Configuration ---
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://admin_eventos:2312@localhost:5432/gestion_eventos_db'
});

const EVENT_NAME = 'Festival Gastronómico 2024';
const NUM_CUSTOMERS = 50;
const NUM_TRANSACTIONS_PER_CUSTOMER = 8; // Increased for more activity

// --- Helper Functions ---
const getRandomElement = (arr) => arr[Math.floor(Math.random() * arr.length)];

// --- Main Seeding Logic ---
async function seed() {
  const client = await pool.connect();
  try {
    console.log('Starting database seeding process...');
    await client.query('BEGIN');

    // 1. Find or Create the Event
    let eventResult = await client.query('SELECT id FROM events WHERE name = $1', [EVENT_NAME]);
    let eventId;
    if (eventResult.rows.length > 0) {
      eventId = eventResult.rows[0].id;
      console.log(`Found existing event "${EVENT_NAME}" with ID: ${eventId}`);
      // Clean up old data for this event
      console.log('Cleaning up old data for the event...');
      await client.query('DELETE FROM transactions WHERE event_id = $1', [eventId]);
      await client.query('DELETE FROM products WHERE event_id = $1', [eventId]);
      await client.query('DELETE FROM staff WHERE event_id = $1', [eventId]);
      await client.query('DELETE FROM customers WHERE event_id = $1', [eventId]);
      await client.query('DELETE FROM events WHERE id = $1', [eventId]); // Delete and recreate for a clean slate
      console.log('Old event data cleaned up.');
    }
    
    console.log(`Creating event "${EVENT_NAME}"...`);
    await client.query("UPDATE events SET status = 'finalizado'");
    const newEventResult = await client.query(
        "INSERT INTO events (name, status) VALUES ($1, 'activo') RETURNING id",
        [EVENT_NAME]
    );
    eventId = newEventResult.rows[0].id;
    console.log(`Created new event with ID: ${eventId}`);


    // 2. Seed Staff
    console.log('Seeding staff...');
    const staffData = [
        { name: 'Admin General', role: 'ADMINISTRADOR', cardUid: 'ADM001', employeeNumber: 'E-001' },
        { name: 'Gerardo Morales', role: 'ENCARGADO', cardUid: 'ENC001', employeeNumber: 'E-002' },
        { name: 'Ana López', role: 'CAJERO', cardUid: 'CAJ001', employeeNumber: 'E-101' },
        { name: 'Carlos Ruíz', role: 'CAJERO', cardUid: 'CAJ002', employeeNumber: 'E-102' },
        { name: 'Sofía Castro', role: 'VENDEDOR', cardUid: 'VEN001', employeeNumber: 'E-201' },
        { name: 'Javier Fernández', role: 'VENDEDOR', cardUid: 'VEN002', employeeNumber: 'E-202' },
        { name: 'Luisa Martínez', role: 'VENDEDOR', cardUid: 'VEN003', employeeNumber: 'E-203' },
    ];
    const staffInsertQuery = 'INSERT INTO staff (event_id, name, role, card_uid, employee_number, is_active) VALUES ($1, $2, $3, $4, $5, true) RETURNING *';
    const staff = [];
    for (const s of staffData) {
        const res = await client.query(staffInsertQuery, [eventId, s.name, s.role, s.cardUid, s.employeeNumber]);
        staff.push(res.rows[0]);
    }
    console.log(`Inserted ${staff.length} staff members.`);

    // 3. Seed Products
    console.log('Seeding products...');
    const productData = [
        { name: 'Cerveza Artesanal', price: 75.00 }, { name: 'Refresco', price: 35.00 },
        { name: 'Agua Embotellada', price: 25.00 }, { name: 'Tacos al Pastor (3)', price: 80.00 },
        { name: 'Hamburguesa Clásica', price: 120.00 }, { name: 'Pizza Rebanada', price: 50.00 },
        { name: 'Papas a la Francesa', price: 60.00 }, { name: 'Hot Dog', price: 55.00 },
        { name: 'Esquites', price: 45.00 }, { name: 'Marquesita', price: 65.00 },
        { name: 'Café Americano', price: 40.00 }, { name: 'Postre de Chocolate', price: 70.00 },
        { name: 'Gorra del Evento', price: 150.00 }, { name: 'Playera del Evento', price: 250.00 },
        { name: 'Coctel Especial', price: 110.00 }
    ];
    const productInsertQuery = 'INSERT INTO products (event_id, name, price, is_active) VALUES ($1, $2, $3, true) RETURNING *';
    const products = [];
    for (const p of productData) {
        const res = await client.query(productInsertQuery, [eventId, p.name, p.price]);
        products.push(res.rows[0]);
    }
    console.log(`Inserted ${products.length} products.`);

    // 4. Seed Customers
    console.log(`Seeding ${NUM_CUSTOMERS} customers...`);
    const customerInsertQuery = 'INSERT INTO customers (uid, event_id, customer_number, balance, is_active) VALUES ($1, $2, $3, $4, true) RETURNING *';
    const customers = [];
    for (let i = 1; i <= NUM_CUSTOMERS; i++) {
        const uid = `CUST${faker.string.alphanumeric(8).toUpperCase()}`;
        const customerNumber = `${1000 + i}`;
        const balance = 0; // Start with 0 balance, will add reloads later
        const res = await client.query(customerInsertQuery, [uid, eventId, customerNumber, balance]);
        customers.push(res.rows[0]);
    }
    console.log(`Inserted ${customers.length} customers.`);
    
    // 5. Seed Transactions
    console.log('Seeding transactions...');
    const cashiers = staff.filter(s => s.role === 'CAJERO' || s.role === 'ADMINISTRADOR');
    const vendors = staff.filter(s => s.role === 'VENDEDOR' || s.role === 'ENCARGADO');
    const transactionInsertQuery = 'INSERT INTO transactions (event_id, type, amount, staff_id, customer_uid, customer_event_id, details, timestamp) VALUES ($1, $2, $3, $4, $5, $1, $6, $7)';
    
    let transactionCount = 0;
    for (const customer of customers) {
        let currentBalance = 0;
        // Initial reload for every customer
        const initialReloadAmount = parseFloat(faker.finance.amount({ min: 200, max: 1500, dec: 0 }));
        const cashier = getRandomElement(cashiers);
        const initialTimestamp = faker.date.recent({ days: 3 });
        
        await client.query('UPDATE customers SET balance = $1 WHERE uid = $2', [initialReloadAmount, customer.uid]);
        currentBalance = initialReloadAmount;
        await client.query(transactionInsertQuery, [eventId, 'Recarga', initialReloadAmount, cashier.id, customer.uid, 'Recarga inicial', initialTimestamp]);
        transactionCount++;
        
        // Add more transactions (sales and reloads)
        for(let i = 0; i < NUM_TRANSACTIONS_PER_CUSTOMER; i++) {
             const willBeSale = Math.random() > 0.2; // 80% chance of being a sale
             const timestamp = faker.date.between({ from: initialTimestamp, to: new Date() });
             
             if(willBeSale) {
                 const vendor = getRandomElement(vendors);
                 const product = getRandomElement(products);
                 const quantity = faker.number.int({ min: 1, max: 3 });
                 const saleAmount = parseFloat(product.price) * quantity;
                 
                 if (currentBalance >= saleAmount) {
                    currentBalance -= saleAmount;
                    await client.query('UPDATE customers SET balance = $1 WHERE uid = $2', [currentBalance, customer.uid]);
                    await client.query(transactionInsertQuery, [eventId, 'Venta', -saleAmount, vendor.id, customer.uid, `${quantity}x ${product.name}`, timestamp]);
                    transactionCount++;
                 }
             } else { // It's a reload
                 const reloadCashier = getRandomElement(cashiers);
                 const reloadAmount = parseFloat(faker.finance.amount({ min: 50, max: 500, dec: 0 }));
                 currentBalance += reloadAmount;

                 await client.query('UPDATE customers SET balance = $1 WHERE uid = $2', [currentBalance, customer.uid]);
                 await client.query(transactionInsertQuery, [eventId, 'Recarga', reloadAmount, reloadCashier.id, customer.uid, 'Recarga adicional', timestamp]);
                 transactionCount++;
             }
        }
    }
    console.log(`Inserted ${transactionCount} transactions.`);

    await client.query('COMMIT');
    console.log('Database seeding completed successfully!');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error during seeding, transaction rolled back.', err);
  } finally {
    client.release();
    await pool.end();
  }
}

// Verification initial of the connection to the database
pool.connect((err, client, done) => {
    if (err) {
      console.error('Fatal error: could not connect to database.', err);
      process.exit(1);
    } else {
      console.log('Database connection verified successfully for seeding.');
      client.release();
      seed();
    }
});
