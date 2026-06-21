const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer');
const { Pool } = require('pg');

// ── DATABASE CONFIGURATION ───────────────────────────────────────────────────
const DB_PATH = path.join(__dirname, 'db.json');
let usePostgres = !!process.env.DATABASE_URL;
let pgPool = null;

if (usePostgres) {
  pgPool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false } // Required for hosting platforms like Render/Supabase
  });
  console.log('[-] Database: PostgreSQL storage engine active.');
} else {
  console.log('[-] Database: Local JSON file storage engine active.');
}

// Read & Write JSON DB (Local Mode fallback)
function readJSONDB() {
  try {
    return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
  } catch {
    return { users: [], accounts: [], transactions: [], cards: [], applications: [] };
  }
}

function writeJSONDB(data) {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf8');
}

// ── DB ADAPTER LAYER (POLYMORPHIC PG/JSON) ───────────────────────────────────
async function queryPG(text, params) {
  if (!usePostgres) {
    throw new Error('PostgreSQL database fallback has been activated.');
  }
  let client;
  try {
    client = await pgPool.connect();
    return await client.query(text, params);
  } catch (err) {
    // If it's a network reachability or connection issue, activate fallback immediately
    if (
      err.code === 'ENETUNREACH' || 
      err.message.includes('ENETUNREACH') || 
      err.message.includes('ECONNREFUSED') || 
      err.message.includes('timeout') || 
      err.message.includes('connect')
    ) {
      console.error('[!] Database: PostgreSQL is unreachable. Failing over to Local JSON DB storage.');
      usePostgres = false;
    }
    throw err;
  } finally {
    if (client) client.release();
  }
}

async function dbInit() {
  if (usePostgres) {
    // Create schema
    await queryPG(`
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(30) PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        email VARCHAR(100) UNIQUE NOT NULL,
        phone VARCHAR(50),
        address VARCHAR(200),
        state VARCHAR(50),
        zip VARCHAR(30),
        ssn VARCHAR(50),
        password VARCHAR(100) NOT NULL,
        account_type VARCHAR(30) NOT NULL,
        kyc_status VARCHAR(30) NOT NULL,
        must_change_password BOOLEAN DEFAULT TRUE,
        wire_status VARCHAR(30) NOT NULL DEFAULT 'ENABLED',
        wire_block_message VARCHAR(250) NOT NULL DEFAULT '',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await queryPG(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS wire_status VARCHAR(30) NOT NULL DEFAULT 'ENABLED';
    `);
    await queryPG(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS wire_block_message VARCHAR(250) NOT NULL DEFAULT '';
    `);
    await queryPG(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS login_code VARCHAR(10) DEFAULT '';
    `);
    await queryPG(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS wire_code VARCHAR(10) DEFAULT '';
    `);

    await queryPG(`
      CREATE TABLE IF NOT EXISTS accounts (
        id VARCHAR(30) PRIMARY KEY,
        user_id VARCHAR(30) REFERENCES users(id) ON DELETE CASCADE,
        type VARCHAR(30) NOT NULL,
        currency VARCHAR(10) NOT NULL,
        balance NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
        account_number VARCHAR(30) UNIQUE NOT NULL,
        routing_number VARCHAR(30) NOT NULL
      );
    `);

    await queryPG(`
      CREATE TABLE IF NOT EXISTS transactions (
        id VARCHAR(30) PRIMARY KEY,
        account_id VARCHAR(30) REFERENCES accounts(id) ON DELETE CASCADE,
        user_id VARCHAR(30) REFERENCES users(id) ON DELETE CASCADE,
        type VARCHAR(30) NOT NULL,
        description VARCHAR(200) NOT NULL,
        amount NUMERIC(15, 2) NOT NULL,
        currency VARCHAR(10) NOT NULL,
        date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        status VARCHAR(30) NOT NULL,
        counterparty VARCHAR(100) NOT NULL,
        swift_details JSONB
      );
    `);

    await queryPG(`
      CREATE TABLE IF NOT EXISTS cards (
        id VARCHAR(30) PRIMARY KEY,
        user_id VARCHAR(30) REFERENCES users(id) ON DELETE CASCADE,
        card_number VARCHAR(30) UNIQUE NOT NULL,
        cardholder_name VARCHAR(100) NOT NULL,
        expiry VARCHAR(10) NOT NULL,
        cvv VARCHAR(5) NOT NULL,
        status VARCHAR(30) NOT NULL,
        type VARCHAR(30) NOT NULL
      );
    `);

    await queryPG(`
      CREATE TABLE IF NOT EXISTS applications (
        id VARCHAR(30) PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        email VARCHAR(100) UNIQUE NOT NULL,
        phone VARCHAR(50),
        address VARCHAR(200),
        state VARCHAR(50),
        zip VARCHAR(30),
        ssn VARCHAR(50),
        account_type VARCHAR(30) NOT NULL,
        selected_accounts VARCHAR(200) NOT NULL DEFAULT 'checking,savings,market',
        status VARCHAR(30) NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await queryPG(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id SERIAL PRIMARY KEY,
        action VARCHAR(100) NOT NULL,
        details TEXT NOT NULL,
        timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Seed default demo data if table is empty
    const testUsers = await queryPG('SELECT id FROM users LIMIT 1');
    if (testUsers.rows.length === 0) {
      console.log('[-] Seeding database with default private banking clients...');
      
      // Julian Mercer
      await queryPG(`
        INSERT INTO users (id, name, email, password, account_type, kyc_status, must_change_password, created_at)
        VALUES ('MTB-553210', 'Julian Mercer', 'j.mercer@mercerasset.com', 'password123', 'personal', 'APPROVED', false, '2023-06-20T12:00:00.000Z')
      `);
      await queryPG(`
        INSERT INTO accounts (id, user_id, type, currency, balance, account_number, routing_number)
        VALUES 
          ('ACC-553210-CHK', 'MTB-553210', 'checking', 'USD', 5000000.00, '0388921102', 'MTBUSD2X'),
          ('ACC-553210-SAV', 'MTB-553210', 'savings', 'USD', 5000000.00, '0388921115', 'MTBUSD2X'),
          ('ACC-553210-MKT', 'MTB-553210', 'market', 'USD', 5000000.00, '0388921128', 'MTBUSD2X')
      `);
      await queryPG(`
        INSERT INTO cards (id, user_id, card_number, cardholder_name, expiry, cvv, status, type)
        VALUES
          ('CRD-001', 'MTB-553210', '4111222233334444', 'JULIAN MERCER', '12/30', '392', 'ACTIVE', 'DEBIT'),
          ('CRD-002', 'MTB-553210', '4222333344445555', 'JULIAN MERCER', '06/29', '109', 'ACTIVE', 'VIRTUAL'),
          ('CRD-107956', 'MTB-553210', '4847172290757421', 'JULIAN MERCER', '09/31', '887', 'ACTIVE', 'VIRTUAL'),
          ('CRD-515400', 'MTB-553210', '4807737568304500', 'JULIAN MERCER', '09/31', '468', 'ACTIVE', 'VIRTUAL')
      `);
      
      const jmTxs = [
        ...generateHighValueTransactions('ACC-553210-CHK', 'MTB-553210', 5000000.00),
        ...generateHighValueTransactions('ACC-553210-SAV', 'MTB-553210', 5000000.00),
        ...generateHighValueTransactions('ACC-553210-MKT', 'MTB-553210', 5000000.00)
      ];
      for (const tx of jmTxs) {
        await queryPG(`
          INSERT INTO transactions (id, account_id, user_id, type, description, amount, currency, date, status, counterparty)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        `, [tx.id, tx.accountId, tx.userId, tx.type, tx.description, tx.amount, tx.currency, tx.date, tx.status, tx.counterparty]);
      }

      // Aetheron Global Technologies LLC
      await queryPG(`
        INSERT INTO users (id, name, email, password, account_type, kyc_status, must_change_password, created_at)
        VALUES ('MTB-889021', 'Aetheron Global Technologies LLC', 'treasury@aetheron.global', 'password123', 'business', 'APPROVED', false, '2023-06-20T08:30:00.000Z')
      `);
      await queryPG(`
        INSERT INTO accounts (id, user_id, type, currency, balance, account_number, routing_number)
        VALUES 
          ('ACC-889021-CHK', 'MTB-889021', 'checking', 'USD', 5000000.00, '0744931089', 'MTBUSD2X'),
          ('ACC-889021-SAV', 'MTB-889021', 'savings', 'USD', 5000000.00, '0744931092', 'MTBUSD2X'),
          ('ACC-889021-MKT', 'MTB-889021', 'market', 'USD', 5000000.00, '0744931103', 'MTBUSD2X')
      `);
      await queryPG(`
        INSERT INTO cards (id, user_id, card_number, cardholder_name, expiry, cvv, status, type)
        VALUES
          ('CRD-003', 'MTB-889021', '4888999900001111', 'AETHERON GLOBAL', '04/31', '552', 'ACTIVE', 'DEBIT'),
          ('CRD-004', 'MTB-889021', '4999000011112222', 'AETHERON GLOBAL', '09/28', '781', 'FROZEN', 'VIRTUAL')
      `);
      
      const aeTxs = [
        ...generateHighValueTransactions('ACC-889021-CHK', 'MTB-889021', 5000000.00),
        ...generateHighValueTransactions('ACC-889021-SAV', 'MTB-889021', 5000000.00),
        ...generateHighValueTransactions('ACC-889021-MKT', 'MTB-889021', 5000000.00)
      ];
      for (const tx of aeTxs) {
        await queryPG(`
          INSERT INTO transactions (id, account_id, user_id, type, description, amount, currency, date, status, counterparty)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        `, [tx.id, tx.accountId, tx.userId, tx.type, tx.description, tx.amount, tx.currency, tx.date, tx.status, tx.counterparty]);
      }

      // Sophia Laurent
      await queryPG(`
        INSERT INTO users (id, name, email, password, account_type, kyc_status, must_change_password, created_at)
        VALUES ('MTB-112233', 'Sophia Laurent', 's.laurent@laurentcapital.ch', 'password123', 'personal', 'PENDING', false, '2026-06-01T14:45:00.000Z')
      `);
      await queryPG(`
        INSERT INTO accounts (id, user_id, type, currency, balance, account_number, routing_number)
        VALUES ('ACC-112233-CHK', 'MTB-112233', 'checking', 'USD', 5000000.00, '0811902231', 'MTBUSD2X')
      `);
      const slTxs = generateHighValueTransactions('ACC-112233-CHK', 'MTB-112233', 5000000.00);
      for (const tx of slTxs) {
        await queryPG(`
          INSERT INTO transactions (id, account_id, user_id, type, description, amount, currency, date, status, counterparty)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        `, [tx.id, tx.accountId, tx.userId, tx.type, tx.description, tx.amount, tx.currency, tx.date, tx.status, tx.counterparty]);
      }
    }
  } else {
    // Local JSON DB seed verification
    const db = readJSONDB();
    if (!db.users || db.users.length === 0) {
      const freshSeed = {
        users: [
          { id: "MTB-553210", name: "Julian Mercer", email: "j.mercer@mercerasset.com", password: "password123", accountType: "personal", kycStatus: "APPROVED", createdAt: "2023-06-20T12:00:00.000Z" },
          { id: "MTB-889021", name: "Aetheron Global Technologies LLC", email: "treasury@aetheron.global", password: "password123", accountType: "business", kycStatus: "APPROVED", createdAt: "2023-06-20T08:30:00.000Z" },
          { id: "MTB-112233", name: "Sophia Laurent", email: "s.laurent@laurentcapital.ch", password: "password123", accountType: "personal", kycStatus: "PENDING", createdAt: "2026-06-01T14:45:00.000Z" }
        ],
        accounts: [
          { id: "ACC-553210-CHK", userId: "MTB-553210", type: "checking", currency: "USD", balance: 5000000.00, accountNumber: "0388921102", routingNumber: "MTBUSD2X" },
          { id: "ACC-553210-SAV", userId: "MTB-553210", type: "savings", currency: "USD", balance: 5000000.00, accountNumber: "0388921115", routingNumber: "MTBUSD2X" },
          { id: "ACC-553210-MKT", userId: "MTB-553210", type: "market", currency: "USD", balance: 5000000.00, accountNumber: "0388921128", routingNumber: "MTBUSD2X" },
          { id: "ACC-889021-CHK", userId: "MTB-889021", type: "checking", currency: "USD", balance: 5000000.00, accountNumber: "0744931089", routingNumber: "MTBUSD2X" },
          { id: "ACC-889021-SAV", userId: "MTB-889021", type: "savings", currency: "USD", balance: 5000000.00, accountNumber: "0744931092", routingNumber: "MTBUSD2X" },
          { id: "ACC-889021-MKT", userId: "MTB-889021", type: "market", currency: "USD", balance: 5000000.00, accountNumber: "0744931103", routingNumber: "MTBUSD2X" },
          { id: "ACC-112233-CHK", userId: "MTB-112233", type: "checking", currency: "USD", balance: 5000000.00, accountNumber: "0811902231", routingNumber: "MTBUSD2X" }
        ],
        transactions: [],
        cards: [
          { id: "CRD-001", userId: "MTB-553210", cardNumber: "4111222233334444", cardholderName: "JULIAN MERCER", expiry: "12/30", cvv: "392", status: "ACTIVE", type: "DEBIT" },
          { id: "CRD-002", userId: "MTB-553210", cardNumber: "4222333344445555", cardholderName: "JULIAN MERCER", expiry: "06/29", cvv: "109", status: "ACTIVE", type: "VIRTUAL" },
          { id: "CRD-003", userId: "MTB-889021", cardNumber: "4888999900001111", cardholderName: "AETHERON GLOBAL", expiry: "04/31", cvv: "552", status: "ACTIVE", type: "DEBIT" },
          { id: "CRD-004", userId: "MTB-889021", cardNumber: "4999000011112222", cardholderName: "AETHERON GLOBAL", expiry: "09/28", cvv: "781", status: "FROZEN", type: "VIRTUAL" },
          { id: "CRD-107956", userId: "MTB-553210", cardNumber: "4847172290757421", cardholderName: "JULIAN MERCER", expiry: "09/31", cvv: "887", status: "ACTIVE", type: "VIRTUAL" },
          { id: "CRD-515400", userId: "MTB-553210", cardNumber: "4807737568304500", cardholderName: "JULIAN MERCER", expiry: "09/31", cvv: "468", status: "ACTIVE", type: "VIRTUAL" }
        ],
        applications: [],
        pendingVerifications: {}
      };
      freshSeed.accounts.forEach(acc => {
        const accTxs = generateHighValueTransactions(acc.id, acc.userId, 5000000.00);
        freshSeed.transactions = freshSeed.transactions.concat(accTxs);
      });
      writeJSONDB(freshSeed);
    }
  }
}

// ── GET APPLICATIONS ─────────────────────────────────────────────────────────
async function dbGetApplications() {
  if (usePostgres) {
    const res = await queryPG('SELECT * FROM applications ORDER BY created_at DESC');
    return res.rows.map(r => ({
      id: r.id, name: r.name, email: r.email, phone: r.phone,
      address: r.address, state: r.state, zip: r.zip, ssn: r.ssn,
      accountType: r.account_type, selectedAccounts: r.selected_accounts ? r.selected_accounts.split(',') : [],
      status: r.status, createdAt: r.created_at
    }));
  } else {
    const db = readJSONDB();
    return (db.applications || []).map(a => ({
      ...a,
      selectedAccounts: a.selectedAccounts || ['checking', 'savings', 'market']
    }));
  }
}

// ── SAVE APPLICATION ─────────────────────────────────────────────────────────
async function dbSaveApplication(app) {
  if (usePostgres) {
    await queryPG(`
      INSERT INTO applications (id, name, email, phone, address, state, zip, ssn, account_type, selected_accounts, status, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
    `, [app.id, app.name, app.email, app.phone, app.address, app.state, app.zip, app.ssn, app.accountType, (app.selectedAccounts || []).join(','), app.status, app.createdAt]);
  } else {
    const db = readJSONDB();
    if (!db.applications) db.applications = [];
    db.applications.push(app);
    writeJSONDB(db);
  }
}

// ── DELETE APPLICATION ───────────────────────────────────────────────────────
async function dbDeleteApplication(appId) {
  if (usePostgres) {
    await queryPG('DELETE FROM applications WHERE id = $1', [appId]);
  } else {
    const db = readJSONDB();
    db.applications = (db.applications || []).filter(a => a.id !== appId);
    writeJSONDB(db);
  }
}

// ── GET APPLICATION BY EMAIL OR USER BY EMAIL ────────────────────────────────
async function dbCheckEmailExists(email) {
  const normEmail = email.toLowerCase();
  if (usePostgres) {
    const userRes = await queryPG('SELECT id FROM users WHERE LOWER(email) = $1', [normEmail]);
    if (userRes.rows.length > 0) return true;
    const appRes = await queryPG('SELECT id FROM applications WHERE LOWER(email) = $1', [normEmail]);
    return appRes.rows.length > 0;
  } else {
    const db = readJSONDB();
    const existsUser = db.users.find(u => u.email.toLowerCase() === normEmail);
    const existsApp = (db.applications || []).find(a => a.email.toLowerCase() === normEmail);
  }
}

// ── ADD OPERATIONS AUDIT LOG ─────────────────────────────────────────────────
async function dbAddAuditLog(action, details) {
  const timestamp = new Date().toISOString();
  try {
    if (usePostgres) {
      await queryPG('INSERT INTO audit_logs (action, details, timestamp) VALUES ($1, $2, $3)', [action, details, timestamp]);
    } else {
      const db = readJSONDB();
      if (!db.auditLogs) db.auditLogs = [];
      db.auditLogs.push({ action, details, timestamp });
      if (db.auditLogs.length > 100) db.auditLogs.shift();
      writeJSONDB(db);
    }
  } catch (e) {
    console.error('[!] Database: Failed to write audit log:', e.message);
  }
}

// ── USER AUTH LOGIN READ ─────────────────────────────────────────────────────
async function dbGetUserByIdAndPassword(userId, password) {
  if (usePostgres) {
    const res = await queryPG('SELECT * FROM users WHERE id = $1 AND password = $2', [userId, password]);
    if (res.rows.length === 0) return null;
    const r = res.rows[0];
    return {
      id: r.id, name: r.name, email: r.email, accountType: r.account_type,
      kycStatus: r.kyc_status, mustChangePassword: r.must_change_password
    };
  } else {
    const db = readJSONDB();
    const user = db.users.find(u => u.id === userId && u.password === password);
    if (!user) return null;
    return {
      id: user.id, name: user.name, email: user.email, accountType: user.accountType,
      kycStatus: user.kycStatus, mustChangePassword: !!user.mustChangePassword
    };
  }
}

// ── CHANGE USER PASSWORD ─────────────────────────────────────────────────────
async function dbChangePassword(userId, oldPassword, newPassword) {
  if (usePostgres) {
    const check = await queryPG('SELECT id FROM users WHERE id = $1 AND password = $2', [userId, oldPassword]);
    if (check.rows.length === 0) return false;
    await queryPG('UPDATE users SET password = $1, must_change_password = false WHERE id = $2', [newPassword, userId]);
    const uRes = await queryPG('SELECT email FROM users WHERE id = $1', [userId]);
    return uRes.rows[0]?.email || true;
  } else {
    const db = readJSONDB();
    const user = db.users.find(u => u.id === userId && u.password === oldPassword);
    if (!user) return false;
    user.password = newPassword;
    user.mustChangePassword = false;
    writeJSONDB(db);
    return user.email;
  }
}

// ── GET ACCOUNTS FOR CLIENT ──────────────────────────────────────────────────
async function dbGetAccounts(userId) {
  if (usePostgres) {
    const res = await queryPG('SELECT * FROM accounts WHERE user_id = $1', [userId]);
    return res.rows.map(r => ({
      id: r.id, userId: r.user_id, type: r.type, currency: r.currency,
      balance: parseFloat(r.balance), accountNumber: r.account_number, routingNumber: r.routing_number
    }));
  } else {
    return readJSONDB().accounts.filter(a => a.userId === userId);
  }
}

// ── GET TRANSACTIONS FOR CLIENT ──────────────────────────────────────────────
async function dbGetTransactions(userId) {
  if (usePostgres) {
    const res = await queryPG('SELECT * FROM transactions WHERE user_id = $1 ORDER BY date DESC', [userId]);
    return res.rows.map(r => ({
      id: r.id, accountId: r.account_id, userId: r.user_id, type: r.type,
      description: r.description, amount: parseFloat(r.amount), currency: r.currency,
      date: r.date, status: r.status, counterparty: r.counterparty, swiftDetails: r.swift_details
    }));
  } else {
    const txns = readJSONDB().transactions.filter(t => t.userId === userId);
    txns.sort((a, b) => new Date(b.date) - new Date(a.date));
    return txns;
  }
}

// ── GET CARDS FOR CLIENT ─────────────────────────────────────────────────────
async function dbGetCards(userId) {
  if (usePostgres) {
    const res = await queryPG('SELECT * FROM cards WHERE user_id = $1', [userId]);
    return res.rows.map(r => ({
      id: r.id, userId: r.user_id, cardNumber: r.card_number, cardholderName: r.cardholder_name,
      expiry: r.expiry, cvv: r.cvv, status: r.status, type: r.type
    }));
  } else {
    return readJSONDB().cards.filter(c => c.userId === userId);
  }
}

// ── TOGGLE CARD STATUS ───────────────────────────────────────────────────────
async function dbToggleCard(cardId) {
  if (usePostgres) {
    const card = await queryPG('SELECT status FROM cards WHERE id = $1', [cardId]);
    if (card.rows.length === 0) return null;
    const nextStatus = card.rows[0].status === 'ACTIVE' ? 'FROZEN' : 'ACTIVE';
    const res = await queryPG('UPDATE cards SET status = $1 WHERE id = $2 RETURNING *', [nextStatus, cardId]);
    const r = res.rows[0];
    return { id: r.id, cardNumber: r.card_number, status: r.status };
  } else {
    const db = readJSONDB();
    const idx = db.cards.findIndex(c => c.id === cardId);
    if (idx === -1) return null;
    db.cards[idx].status = db.cards[idx].status === 'ACTIVE' ? 'FROZEN' : 'ACTIVE';
    writeJSONDB(db);
    return db.cards[idx];
  }
}

// ── CREATE CARD ──────────────────────────────────────────────────────────────
async function dbCreateCard(card) {
  if (usePostgres) {
    await queryPG(`
      INSERT INTO cards (id, user_id, card_number, cardholder_name, expiry, cvv, status, type)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `, [card.id, card.userId, card.cardNumber, card.cardholderName, card.expiry, card.cvv, card.status, card.type]);
  } else {
    const db = readJSONDB();
    db.cards.push(card);
    writeJSONDB(db);
  }
}

// ── SEND OUTBOUND WIRE (TRANSACTION + BALANCE WITHDRAWAL) ────────────────────
async function dbSendOutboundWire(tx, balanceChange) {
  if (usePostgres) {
    const client = await pgPool.connect();
    try {
      await client.query('BEGIN');
      
      // Debit account balance
      await client.query(`
        UPDATE accounts 
        SET balance = balance - $1 
        WHERE id = $2 AND user_id = $3
      `, [balanceChange.amount, balanceChange.accountId, balanceChange.userId]);

      // Record transaction
      await client.query(`
        INSERT INTO transactions (id, account_id, user_id, type, description, amount, currency, date, status, counterparty, swift_details)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      `, [tx.id, tx.accountId, tx.userId, tx.type, tx.description, tx.amount, tx.currency, tx.date, tx.status, tx.counterparty, JSON.stringify(tx.swiftDetails)]);

      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  } else {
    const db = readJSONDB();
    const acc = db.accounts.find(a => a.id === balanceChange.accountId && a.userId === balanceChange.userId);
    if (!acc) throw new Error('Account not found.');
    acc.balance = parseFloat((acc.balance - balanceChange.amount).toFixed(2));
    db.transactions.push(tx);
    writeJSONDB(db);
  }
}

// ── ADMIN: APPROVE APPLICATION (MOVE TO USERS + SEED BALANCES) ───────────────
async function dbApproveApplication(applicationId, generatedDetails) {
  const { userId, password, userSeed, accountsSeed, cardSeed, txsSeed } = generatedDetails;

  if (usePostgres) {
    const client = await pgPool.connect();
    try {
      await client.query('BEGIN');

      // 1. Insert user
      await client.query(`
        INSERT INTO users (id, name, email, phone, address, state, zip, ssn, password, account_type, kyc_status, must_change_password, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      `, [userId, userSeed.name, userSeed.email, userSeed.phone, userSeed.address, userSeed.state, userSeed.zip, userSeed.ssn, password, userSeed.accountType, 'APPROVED', true, new Date().toISOString()]);

      // 2. Insert accounts & seed transactions
      for (let i = 0; i < accountsSeed.length; i++) {
        const acc = accountsSeed[i];
        await client.query(`
          INSERT INTO accounts (id, user_id, type, currency, balance, account_number, routing_number)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
        `, [acc.id, acc.userId, acc.type, acc.currency, acc.balance, acc.accountNumber, acc.routingNumber]);
      }

      for (let i = 0; i < txsSeed.length; i++) {
        const tx = txsSeed[i];
        await client.query(`
          INSERT INTO transactions (id, account_id, user_id, type, description, amount, currency, date, status, counterparty)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        `, [tx.id, tx.accountId, tx.userId, tx.type, tx.description, tx.amount, tx.currency, tx.date, tx.status, tx.counterparty]);
      }

      // 3. Insert card
      await client.query(`
        INSERT INTO cards (id, user_id, card_number, cardholder_name, expiry, cvv, status, type)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `, [cardSeed.id, cardSeed.userId, cardSeed.cardNumber, cardSeed.cardholderName, cardSeed.expiry, cardSeed.cvv, cardSeed.status, cardSeed.type]);

      // 4. Delete application
      await client.query('DELETE FROM applications WHERE id = $1', [applicationId]);

      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  } else {
    const db = readJSONDB();
    const appIdx = db.applications.findIndex(a => a.id === applicationId);
    if (appIdx === -1) throw new Error('Application not found.');

    const newUser = {
      id: userId,
      name: userSeed.name,
      email: userSeed.email,
      phone: userSeed.phone,
      address: userSeed.address,
      state: userSeed.state,
      zip: userSeed.zip,
      ssn: userSeed.ssn,
      password,
      accountType: userSeed.accountType,
      kycStatus: 'APPROVED',
      mustChangePassword: true,
      createdAt: new Date().toISOString()
    };

    db.users.push(newUser);
    accountsSeed.forEach(a => db.accounts.push(a));
    txsSeed.forEach(t => db.transactions.push(t));
    db.cards.push(cardSeed);
    db.applications.splice(appIdx, 1);
    writeJSONDB(db);
  }
}

// ── ADMIN: GET USERS ─────────────────────────────────────────────────────────
async function dbGetAdminUsers() {
  if (usePostgres) {
    const usersRes = await queryPG('SELECT * FROM users ORDER BY created_at DESC');
    const accsRes = await queryPG('SELECT * FROM accounts');
    const cardsRes = await queryPG('SELECT * FROM cards');

    const accounts = accsRes.rows;
    const cards = cardsRes.rows;

    return usersRes.rows.map(u => {
      return {
        id: u.id, name: u.name, email: u.email, phone: u.phone, password: u.password,
        address: u.address, state: u.state, zip: u.zip, ssn: u.ssn,
        kycStatus: u.kyc_status, createdAt: u.created_at,
        wireStatus: u.wire_status || 'ENABLED', wireBlockMessage: u.wire_block_message || '',
        loginCode: u.login_code || '',
        wireCode: u.wire_code || '',
        accounts: accounts.filter(a => a.user_id === u.id).map(a => ({
          id: a.id, userId: a.user_id, type: a.type, currency: a.currency,
          balance: parseFloat(a.balance), accountNumber: a.account_number, routingNumber: a.routing_number
        })),
        cards: cards.filter(c => c.user_id === u.id).map(c => ({
          id: c.id, userId: c.user_id, cardNumber: c.card_number, cardholder_name: c.cardholder_name,
          expiry: c.expiry, cvv: c.cvv, status: c.status, type: c.type
        }))
      };
    });
  } else {
    const db = readJSONDB();
    return db.users.map(u => {
      return {
        ...u,
        wireStatus: u.wireStatus || 'ENABLED',
        wireBlockMessage: u.wireBlockMessage || '',
        loginCode: u.loginCode || '',
        wireCode: u.wireCode || '',
        accounts: db.accounts.filter(a => a.userId === u.id),
        cards: db.cards.filter(c => c.userId === u.id)
      };
    });
  }
}

// ── ADMIN: ADJUST BALANCE ────────────────────────────────────────────────────
async function dbAdjustBalance(accountId, amount) {
  if (usePostgres) {
    const res = await queryPG('UPDATE accounts SET balance = $1 WHERE id = $2 RETURNING *', [amount, accountId]);
    if (res.rows.length === 0) return null;
    const r = res.rows[0];
    return { id: r.id, balance: parseFloat(r.balance), currency: r.currency };
  } else {
    const db = readJSONDB();
    const acc = db.accounts.find(a => a.id === accountId);
    if (!acc) return null;
    acc.balance = parseFloat(parseFloat(amount).toFixed(2));
    writeJSONDB(db);
    return acc;
  }
}

// ── ADMIN: CREDIT DEPOSIT ────────────────────────────────────────────────────
async function dbCreditDeposit(tx, amount, accountId) {
  if (usePostgres) {
    const client = await pgPool.connect();
    try {
      await client.query('BEGIN');
      await client.query('UPDATE accounts SET balance = balance + $1 WHERE id = $2', [amount, accountId]);
      await client.query(`
        INSERT INTO transactions (id, account_id, user_id, type, description, amount, currency, date, status, counterparty)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      `, [tx.id, tx.accountId, tx.userId, tx.type, tx.description, tx.amount, tx.currency, tx.date, tx.status, tx.counterparty]);
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  } else {
    const db = readJSONDB();
    const acc = db.accounts.find(a => a.id === accountId);
    if (!acc) throw new Error('Account not found.');
    acc.balance = parseFloat((acc.balance + amount).toFixed(2));
    db.transactions.push(tx);
    writeJSONDB(db);
  }
}

// ── HELPER GENERATORS ────────────────────────────────────────────────────────
function randomDigits(n) {
  let s = '';
  for (let i = 0; i < n; i++) s += Math.floor(Math.random() * 10);
  return s;
}

function generateHighValueTransactions(accountId, userId, targetFinalBalance = 5000000.00) {
  const txs = [];
  const txTemplates = [
    { desc: 'Offshore Institutional Assets Settlement', partner: 'Laurent Capital Trust', type: 'DEPOSIT' },
    { desc: 'Capital Retainer Placement', partner: 'Pemberton Advisory Partners', type: 'TRANSFER_OUT' },
    { desc: 'Advisory Retainer Clearance Credit', partner: 'Apex Group Corporate Solutions', type: 'DEPOSIT' },
    { desc: 'Q3 Dividend Yield Credit', partner: 'Meridian Global Securities Desk', type: 'DEPOSIT' },
    { desc: 'Sovereign Treasury Bond Allocation', partner: 'Federal Yield Clearance', type: 'TRANSFER_OUT' },
    { desc: 'Commercial Real Estate Yield Inflow', partner: 'Hudson Development Syndicate', type: 'DEPOSIT' },
    { desc: 'Capital Gain Inflow Distribution', partner: 'Vanguard Private Ledger', type: 'DEPOSIT' },
    { desc: 'Corporate Retainer Service Fees', partner: 'Blackstone Wealth Audit', type: 'TRANSFER_OUT' },
    { desc: 'Offshore Equity Liquidation Credit', partner: 'Chubb Asset Holding Group', type: 'DEPOSIT' },
    { desc: 'Private Equity Capital Retainer Payment', partner: 'Crosslands Capital Partners', type: 'TRANSFER_OUT' },
    { desc: 'Q1 Advisory Clearance Credit', partner: 'Goldman Sachs Wealth Desk', type: 'DEPOSIT' },
    { desc: 'Venture Capital Dividend Return Inflow', partner: 'Blue Ridge Ventures Group', type: 'DEPOSIT' },
    { desc: 'International Business Wire Receipt', partner: 'Mercer Asset Management Ltd', type: 'DEPOSIT' },
    { desc: 'Treasury Portfolio Rebalance Inflow', partner: 'Meridian Trust FX Desk', type: 'DEPOSIT' },
    { desc: 'Series B Institutional Funding Inflow', partner: 'Apex Ventures Fund IV', type: 'DEPOSIT' },
    { desc: 'Cloud Infrastructure Contract Payment', partner: 'Amazon Web Services', type: 'TRANSFER_OUT' },
    { desc: 'Corporate Treasury Rebalance Settlement', partner: 'Aetheron Treasury Operations', type: 'DEPOSIT' },
    { desc: 'Sterling Reserve Placement Inflow', partner: 'Meridian Trust GBP Clearing', type: 'DEPOSIT' },
    { desc: 'Legal Compliance Audit Fee Payment', partner: 'Blackstone & Partners', type: 'TRANSFER_OUT' },
    { desc: 'Commercial Lease Revenue Clearance', partner: 'Brookfield Properties Group', type: 'DEPOSIT' },
    { desc: 'Sovereign Liquidity Bond Liquidation', partner: 'Federal Reserve Settlement', type: 'DEPOSIT' },
    { desc: 'Strategic Acquisition Capital Call', partner: 'KKR Global Acquisition Fund', type: 'TRANSFER_OUT' },
    { desc: 'Secured Debt Facility Drawdown', partner: 'JPMorgan Chase Corporate Desk', type: 'DEPOSIT' },
    { desc: 'Asset-Backed Securities Yield Credit', partner: 'Fidelity Capital Partners', type: 'DEPOSIT' },
    { desc: 'Global Logistics Contract Settlement', partner: 'FedEx Express Treasury', type: 'TRANSFER_OUT' },
    { desc: 'Annual Cybersecurity Infrastructure payment', partner: 'CrowdStrike Solutions Inc', type: 'TRANSFER_OUT' },
    { desc: 'Institutional Share Buyback Proceeds', partner: 'Microsoft Corporate Treasury', type: 'DEPOSIT' },
    { desc: 'Patent Licensing Royalty Distribution', partner: 'Apple Inc. Intellectual Property', type: 'DEPOSIT' },
    { desc: 'Intercompany Liquidity Sweep Inflow', partner: 'Alphabet Finance LLC', type: 'DEPOSIT' },
    { desc: 'Advertising Campaign Retainer Clearance', partner: 'Meta Platforms Funding', type: 'TRANSFER_OUT' },
    { desc: 'Strategic Equity Investment Placement', partner: 'Berkshire Hathaway Treasury', type: 'TRANSFER_OUT' },
    { desc: 'Aerospace Engineering Progress Disbursement', partner: 'Boeing Capital Corporation', type: 'DEPOSIT' },
    { desc: 'Industrial Turbine System Acquisition', partner: 'General Electric Treasury', type: 'TRANSFER_OUT' },
    { desc: 'Heavy Machinery Asset Procurement', partner: 'Caterpillar Financial Services', type: 'TRANSFER_OUT' },
    { desc: 'Automation Systems Integration Payment', partner: 'Siemens Financial Services', type: 'TRANSFER_OUT' },
    { desc: 'Biomedical Patent Royalty Credit', partner: 'Pfizer Capital Operations', type: 'DEPOSIT' },
    { desc: 'Pharmaceutical Research Development Grant', partner: 'Merck & Co. Treasury Desk', type: 'DEPOSIT' },
    { desc: 'Clinical Trial Site License Placement', partner: 'Eli Lilly Financial Services', type: 'TRANSFER_OUT' },
    { desc: 'Petrochemical Refining Logistics Payment', partner: 'Chevron Funding Corporation', type: 'TRANSFER_OUT' },
    { desc: 'Offshore Exploration Venture Funding', partner: 'ConocoPhillips Capital Corp', type: 'DEPOSIT' },
    { desc: 'Seismographic Exploration Contract Fee', partner: 'Schlumberger Treasury Services', type: 'TRANSFER_OUT' },
    { desc: 'Subsea Drilling Infrastructure payment', partner: 'Halliburton Finance LLC', type: 'TRANSFER_OUT' },
    { desc: 'Satellite Systems Assembly Payment', partner: 'Lockheed Martin Capital Corp', type: 'TRANSFER_OUT' },
    { desc: 'Radar Systems Integration Settlement', partner: 'Northrop Grumman Treasury', type: 'TRANSFER_OUT' },
    { desc: 'Avionics Upgrade Program Disbursement', partner: 'Raytheon Technologies Finance', type: 'TRANSFER_OUT' },
    { desc: 'Microprocessor Foundry Capital Call', partner: 'Intel Capital Operations', type: 'TRANSFER_OUT' },
    { desc: 'Enterprise Graphics Processing Procurement', partner: 'Nvidia Corporate Treasury', type: 'DEPOSIT' },
    { desc: 'Server Architecture Lease Settlement', partner: 'Oracle Corporation Finance', type: 'TRANSFER_OUT' },
    { desc: 'SaaS Suite Licensing Clearance', partner: 'Salesforce Capital Operations', type: 'TRANSFER_OUT' },
    { desc: 'Digital Publishing Software Audit Fee', partner: 'Adobe Inc. Treasury Services', type: 'TRANSFER_OUT' }
  ];

  // Fisher-Yates shuffle to randomize templates
  const shuffled = [...txTemplates];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  const startDate = new Date('2023-06-20T00:00:00Z').getTime();
  const endDate = new Date('2026-06-20T00:00:00Z').getTime();
  
  let currentSum = 0;
  const count = 40;
  
  for (let i = 0; i < count - 1; i++) {
    const temp = shuffled[i];
    const amount = Math.floor(10 + Math.random() * 170) * 10000;
    
    const randTime = startDate + (i / count) * (endDate - startDate) + (Math.random() * 6 * 24 * 3600 * 1000 - 3 * 24 * 3600 * 1000);
    const dateStr = new Date(Math.max(startDate, Math.min(endDate - 24 * 3600 * 1000, randTime))).toISOString();
    
    txs.push({
      id: `TXN-${100000 + Math.floor(Math.random() * 900000)}`,
      accountId,
      userId,
      type: temp.type,
      description: temp.desc,
      amount,
      currency: 'USD',
      date: dateStr,
      status: 'COMPLETED',
      counterparty: temp.partner
    });
    
    if (temp.type === 'DEPOSIT') {
      currentSum += amount;
    } else {
      currentSum -= amount;
    }
  }
  
  const diff = targetFinalBalance - currentSum;
  const finalType = diff >= 0 ? 'DEPOSIT' : 'TRANSFER_OUT';
  const finalAmount = Math.abs(diff);
  
  txs.push({
    id: `TXN-${100000 + Math.floor(Math.random() * 900000)}`,
    accountId,
    userId,
    type: finalType,
    description: finalType === 'DEPOSIT' ? 'Initial Capital Seeding Inflow' : 'Institutional Outbound Clearing Settlement',
    amount: Math.round(finalAmount * 100) / 100,
    currency: 'USD',
    date: new Date(endDate - 12 * 3600 * 1000).toISOString(),
    status: 'COMPLETED',
    counterparty: 'Meridian Capital Custody'
  });
  
  txs.sort((a, b) => new Date(b.date) - new Date(a.date));
  return txs;
}

function generateAlphanumericPassword(length = 8) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let pass = '';
  for (let i = 0; i < length; i++) {
    pass += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return pass;
}

// ── Nodemailer Transporter ───────────────────────────────────────────────────
let transporter;
const smtpHost = process.env.SMTP_HOST;
const smtpPort = process.env.SMTP_PORT || 587;
const smtpUser = process.env.SMTP_USER;
const smtpPass = process.env.SMTP_PASS;

if (smtpHost && smtpUser && smtpPass) {
  transporter = nodemailer.createTransport({
    host: smtpHost,
    port: parseInt(smtpPort),
    secure: smtpPort == 465,
    auth: { user: smtpUser, pass: smtpPass }
  });
  console.log('[-] Mail: Custom SMTP Transporter configured.');
} else {
  // Use Ethereal test SMTP accounts
  nodemailer.createTestAccount().then(account => {
    transporter = nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      auth: { user: account.user, pass: account.pass }
    });
    console.log(`[-] Mail: Ethereal Mock SMTP active. View output at https://ethereal.email (User: ${account.user})`);
  }).catch(() => {
    transporter = {
      sendMail: async (opts) => {
        console.log(`[-] Mail: SMTP Offline. Email simulated to: ${opts.to}`);
      }
    };
  });
}

async function sendEmailHelper(to, subject, html) {
  const mailOptions = {
    from: '"Meridian Trust Private Bank" <onboarding@meridiantrust.bank>',
    to,
    subject,
    html
  };
  try {
    if (transporter && typeof transporter.sendMail === 'function') {
      const info = await transporter.sendMail(mailOptions);
      if (nodemailer.getTestMessageUrl) {
        console.log(`[-] Mail URL: ${nodemailer.getTestMessageUrl(info)}`);
      }
    }
  } catch (err) {
    console.log(`[-] Mail: Failed to send SMTP mail: ${err.message}`);
  }
}

// Boot Core Services
async function boot() {
  try {
    await dbInit();
  } catch (err) {
    if (usePostgres) {
      console.warn('[!] PostgreSQL initialization failed during boot. Falling back to local JSON database storage.');
      usePostgres = false;
    }
  }
}
boot();

// ── EXPRESS APPLICATION SINGLE PORT ROUTER ───────────────────────────────────
const app = express();
app.use(cors());
app.use(bodyParser.json());

// 1. Secret Administration Panel Directory Mounting
app.use('/admin', express.static(path.join(__dirname, 'admin')));

// 2. Default Public Client Application Directory Mounting
app.use('/', express.static(path.join(__dirname, 'public')));

// ── CLIENT PORTAL API ENDPOINTS ──────────────────────────────────────────────

// Authenticated Login (Phase 1: Credentials verification & 6-digit MFA code dispatch)
app.post('/api/auth/login', async (req, res) => {
  const { userId, password } = req.body;
  if (!userId || !password) return res.status(400).json({ error: 'Client ID and passcode are required.' });

  try {
    const user = await dbGetUserByIdAndPassword(userId, password);
    if (!user) return res.status(401).json({ error: 'The credentials provided do not match our records.' });

    // Generate random 6-digit code
    const code = randomDigits(6);

    // Save code to database
    if (usePostgres) {
      await queryPG('UPDATE users SET login_code = $1 WHERE id = $2', [code, userId]);
    } else {
      const db = readJSONDB();
      const u = db.users.find(x => x.id === userId);
      if (u) {
        u.loginCode = code;
        writeJSONDB(db);
      }
    }

    // Send verification code via email
    const emailHTML = `
      <div style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;background-color:#F4F6F9;padding:40px;color:#0A1931;">
        <div style="max-width:550px;margin:0 auto;background-color:#ffffff;border-top:4px solid #002C77;border-radius:6px;box-shadow:0 4px 12px rgba(0,0,0,0.05);overflow:hidden;padding:30px;">
          <h2 style="font-size:20px;font-weight:600;margin-top:0;color:#002C77;">Verification Code Required</h2>
          <p style="font-size:14.5px;line-height:1.6;color:#555;">A login request was made for your Meridian Trust profile.</p>
          <p style="font-size:14.5px;line-height:1.6;color:#555;">Please enter the following 6-digit verification code to complete your sign-in:</p>
          <div style="font-size:26px;font-weight:700;color:#002C77;letter-spacing:6px;padding:16px;background:#F4F6F9;display:inline-block;border-radius:6px;margin:20px 0;font-family:monospace;border:1px solid #D2D7E0;">
            ${code}
          </div>
          <p style="font-size:12.5px;color:#777;line-height:1.5;margin-top:20px;">If you did not make this request, please contact security operations immediately.</p>
        </div>
      </div>
    `;

    sendEmailHelper(user.email, 'Login Security Verification Code Required', emailHTML);

    res.json({
      message: 'Verification code sent.',
      requires2FA: true,
      userId
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Verify Login 2FA Code (Phase 2: Check code and grant access session)
app.post('/api/auth/verify-login-2fa', async (req, res) => {
  const { userId, code } = req.body;
  if (!userId || !code) return res.status(400).json({ error: 'User ID and verification code are required.' });

  try {
    let user = null;
    let savedCode = '';

    if (usePostgres) {
      const uRes = await queryPG('SELECT * FROM users WHERE id = $1', [userId]);
      if (uRes.rows.length > 0) {
        user = uRes.rows[0];
        savedCode = user.login_code || '';
      }
    } else {
      const db = readJSONDB();
      user = db.users.find(x => x.id === userId);
      if (user) {
        savedCode = user.loginCode || '';
      }
    }

    if (!user) return res.status(404).json({ error: 'User profile not found.' });

    if (savedCode !== code) {
      return res.status(400).json({ error: 'Invalid or expired login verification code.' });
    }

    // Clear code on successful verification
    if (usePostgres) {
      await queryPG('UPDATE users SET login_code = \'\' WHERE id = $1', [userId]);
    } else {
      const db = readJSONDB();
      const u = db.users.find(x => x.id === userId);
      if (u) {
        u.loginCode = '';
        writeJSONDB(db);
      }
    }

    const accounts = await dbGetAccounts(userId);
    const mappedUser = {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone || user.phone_number,
      address: user.address,
      state: user.state,
      zip: user.zip,
      kycStatus: user.kyc_status || user.kycStatus,
      mustChangePassword: user.must_change_password ?? user.mustChangePassword,
      accounts
    };

    res.json({
      message: 'Verification successful. Welcome back.',
      user: mappedUser
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Submit Onboarding Application
app.post('/api/auth/register-submit', async (req, res) => {
  const { name, email, phone, address, state, zip, ssn, accountType, selectedAccounts } = req.body;
  if (!name || !email || !ssn) {
    return res.status(400).json({ error: 'Name, Email, and SSN are required.' });
  }

  try {
    const exists = await dbCheckEmailExists(email);
    if (exists) {
      return res.status(400).json({ error: 'An application or account with this email address already exists.' });
    }

    const newApp = {
      id: `APP-${randomDigits(6)}`,
      name,
      email,
      phone: phone || '',
      address: address || '',
      state: state || '',
      zip: zip || '',
      ssn,
      accountType: accountType || 'personal',
      selectedAccounts: selectedAccounts || ['checking', 'savings'],
      status: 'PENDING',
      createdAt: new Date().toISOString()
    };

    await dbSaveApplication(newApp);

    res.status(201).json({
      message: 'Your application has been submitted successfully and is currently under review.'
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Passcode Change Action
app.post('/api/auth/change-password', async (req, res) => {
  const { userId, oldPassword, newPassword } = req.body;
  if (!userId || !oldPassword || !newPassword) return res.status(400).json({ error: 'All fields are required.' });

  try {
    const email = await dbChangePassword(userId, oldPassword, newPassword);
    if (!email) {
      return res.status(400).json({ error: 'The temporary passcode entered is incorrect.' });
    }

    // Send passcode changed alert email if email was resolved
    if (typeof email === 'string') {
      const securityHTML = `
        <div style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;background-color:#F4F6F9;padding:40px;color:#0A1931;">
          <div style="max-width:600px;margin:0 auto;background-color:#ffffff;border-top:4px solid #002C77;border-radius:6px;box-shadow:0 4px 12px rgba(0,0,0,0.05);overflow:hidden;">
            <div style="background-color:#002C77;padding:24px;text-align:center;">
              <h1 style="color:#ffffff;margin:0;font-size:22px;letter-spacing:1px;">MERIDIAN TRUST</h1>
              <p style="color:#00A3E0;margin:4px 0 0 0;font-size:12px;text-transform:uppercase;letter-spacing:2px;">International Private Banking</p>
            </div>
            <div style="padding:40px 30px;">
              <h2 style="font-size:20px;font-weight:600;margin-top:0;color:#0A1931;">Security Alert: Passcode Changed</h2>
              <p style="font-size:14px;line-height:1.6;color:#555;">Dear Client,</p>
              <p style="font-size:14px;line-height:1.6;color:#555;">This email confirms that the Client Portal passcode for your Meridian Trust Client Account ID <strong>${userId}</strong> has been updated successfully.</p>
              <div style="background-color:#FFF5F5;border-left:4px solid #E60000;padding:16px;margin:24px 0;font-size:13px;color:#555;line-height:1.5;">
                <strong>⚠️ IMPORTANT:</strong> If you did not initiate this change, contact the Meridian Trust Operations Center immediately to freeze your accounts.
              </div>
              <p style="font-size:14px;line-height:1.6;color:#555;">If you made this update, no further action is required. Your new passcode is immediately active.</p>
            </div>
            <div style="background-color:#F4F6F9;padding:20px;text-align:center;font-size:11px;color:#777;border-top:1px solid #D2D7E0;">
              <p style="margin:0 0 8px 0;">&copy; 2026 Meridian Trust Bank Ltd. Licensed Offshore Financial Institution.</p>
            </div>
          </div>
        </div>
      `;
      sendEmailHelper(email, 'Security Notification: Passcode Updated', securityHTML);
    }

    res.json({ message: 'Passcode changed successfully.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Fetch Accounts
app.get('/api/accounts', async (req, res) => {
  const { userId } = req.query;
  if (!userId) return res.status(400).json({ error: 'Client ID is required.' });
  try {
    const accs = await dbGetAccounts(userId);
    res.json(accs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Fetch Cards
app.get('/api/cards', async (req, res) => {
  const { userId } = req.query;
  if (!userId) return res.status(400).json({ error: 'Client ID is required.' });
  try {
    const cards = await dbGetCards(userId);
    res.json(cards);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Freeze/Unfreeze Card
app.post('/api/cards/toggle', async (req, res) => {
  const { cardId } = req.body;
  if (!cardId) return res.status(400).json({ error: 'Card ID is required.' });
  try {
    const card = await dbToggleCard(cardId);
    if (!card) return res.status(404).json({ error: 'Card not found.' });
    res.json(card);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create Virtual Card
app.post('/api/cards/create', async (req, res) => {
  const { userId, cardholderName } = req.body;
  if (!userId || !cardholderName) return res.status(400).json({ error: 'Missing fields.' });
  try {
    const card = {
      id: `CRD-${randomDigits(6)}`,
      userId,
      cardNumber: `48${randomDigits(14)}`,
      cardholderName: cardholderName.toUpperCase().substring(0, 26),
      expiry: '09/31',
      cvv: randomDigits(3),
      status: 'ACTIVE',
      type: 'VIRTUAL'
    };
    await dbCreateCard(card);
    res.json(card);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Fetch Transactions
app.get('/api/transactions', async (req, res) => {
  const { userId } = req.query;
  if (!userId) return res.status(400).json({ error: 'Client ID is required.' });
  try {
    const txns = await dbGetTransactions(userId);
    res.json(txns);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Send SWIFT Wire Outbound
app.post('/api/transactions/send', async (req, res) => {
  const { userId, accountId, amount, currency, recipientName, recipientAddress, recipientBank, swiftCode, routingNumber, accountNumber, description, verificationCode } = req.body;
  if (!userId || !accountId || !amount || !currency || !recipientName || !swiftCode || !accountNumber) {
    return res.status(400).json({ error: 'Required wire transfer fields are missing.' });
  }

  const num = parseFloat(amount);
  if (isNaN(num) || num <= 0) return res.status(400).json({ error: 'Amount must be positive.' });

  try {
    // Check wire transfer block restriction status
    let wireStatus = 'ENABLED';
    let wireBlockMessage = '';
    let savedWireCode = '';
    
    if (usePostgres) {
      const uRes = await queryPG('SELECT wire_status, wire_block_message, wire_code FROM users WHERE id = $1', [userId]);
      if (uRes.rows.length > 0) {
        wireStatus = uRes.rows[0].wire_status;
        wireBlockMessage = uRes.rows[0].wire_block_message;
        savedWireCode = uRes.rows[0].wire_code || '';
      }
    } else {
      const db = readJSONDB();
      const user = db.users.find(u => u.id === userId);
      if (user) {
        wireStatus = user.wireStatus || 'ENABLED';
        wireBlockMessage = user.wireBlockMessage || '';
        savedWireCode = user.wireCode || '';
      }
    }

    if (wireStatus !== 'ENABLED') {
      return res.status(400).json({ error: wireBlockMessage || 'Wire transfers are currently restricted for this account.' });
    }

    if (!verificationCode || savedWireCode !== verificationCode) {
      return res.status(400).json({ error: 'Invalid or missing 6-digit transaction verification code.' });
    }

    const accounts = await dbGetAccounts(userId);
    const acc = accounts.find(a => a.id === accountId);
    if (!acc) return res.status(404).json({ error: 'Account not found.' });
    if (acc.balance < num) return res.status(400).json({ error: 'Insufficient available balance.' });

    const tx = {
      id: `TXN-${randomDigits(6)}`,
      accountId,
      userId,
      type: 'TRANSFER_OUT',
      description: description || `SWIFT Wire Out — ${recipientBank}`,
      amount: num,
      currency,
      date: new Date().toISOString(),
      status: 'PENDING',
      counterparty: recipientName,
      swiftDetails: { recipientAddress, recipientBank, swiftCode, routingNumber, accountNumber }
    };

    // Record pending transaction without debiting balance immediately
    if (usePostgres) {
      await queryPG(`
        INSERT INTO transactions (id, account_id, user_id, type, description, amount, currency, date, status, counterparty, swift_details)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      `, [tx.id, tx.accountId, tx.userId, tx.type, tx.description, tx.amount, tx.currency, tx.date, tx.status, tx.counterparty, JSON.stringify(tx.swiftDetails)]);
    } else {
      const db = readJSONDB();
      db.transactions.push(tx);
      writeJSONDB(db);
    }

    // Clear transaction code on success
    if (usePostgres) {
      await queryPG('UPDATE users SET wire_code = \'\' WHERE id = $1', [userId]);
    } else {
      const db = readJSONDB();
      const u = db.users.find(x => x.id === userId);
      if (u) {
        u.wireCode = '';
        writeJSONDB(db);
      }
    }

    res.json({ message: 'SWIFT wire transfer submitted and is pending review.', transaction: tx });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Request Wire Outbound Verification Code (MFA dispatch for outgoing transactions)
app.post('/api/transactions/request-code', async (req, res) => {
  const { userId } = req.body;
  if (!userId) return res.status(400).json({ error: 'User ID is required.' });

  try {
    let email = '';
    if (usePostgres) {
      const resU = await queryPG('SELECT email FROM users WHERE id = $1', [userId]);
      if (resU.rows.length > 0) email = resU.rows[0].email;
    } else {
      const db = readJSONDB();
      const u = db.users.find(x => x.id === userId);
      if (u) email = u.email;
    }

    if (!email) return res.status(404).json({ error: 'User email not found.' });

    const code = randomDigits(6);

    if (usePostgres) {
      await queryPG('UPDATE users SET wire_code = $1 WHERE id = $2', [code, userId]);
    } else {
      const db = readJSONDB();
      const u = db.users.find(x => x.id === userId);
      if (u) {
        u.wireCode = code;
        writeJSONDB(db);
      }
    }

    const emailHTML = `
      <div style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;background-color:#F4F6F9;padding:40px;color:#0A1931;">
        <div style="max-width:550px;margin:0 auto;background-color:#ffffff;border-top:4px solid #002C77;border-radius:6px;box-shadow:0 4px 12px rgba(0,0,0,0.05);overflow:hidden;padding:30px;">
          <h2 style="font-size:20px;font-weight:600;margin-top:0;color:#002C77;">Outbound Wire Verification Code</h2>
          <p style="font-size:14.5px;line-height:1.6;color:#555;">A request was made to authorize an outbound global wire transfer from your account.</p>
          <p style="font-size:14.5px;line-height:1.6;color:#555;">Please enter the following 6-digit transaction verification code to authorize the transfer:</p>
          <div style="font-size:26px;font-weight:700;color:#002C77;letter-spacing:6px;padding:16px;background:#F4F6F9;display:inline-block;border-radius:6px;margin:20px 0;font-family:monospace;border:1px solid #D2D7E0;">
            ${code}
          </div>
          <p style="font-size:12.5px;color:#777;line-height:1.5;margin-top:20px;">If you did not make this request, please contact security operations immediately.</p>
        </div>
      </div>
    `;

    sendEmailHelper(email, 'Transaction Security Verification Code Required', emailHTML);

    res.json({ message: 'Verification code dispatched to registered email.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Interbank FX Currency Exchange Desk
app.post('/api/transactions/exchange', async (req, res) => {
  const { userId, fromAccountId, toAccountId, fromAmount, toAmount, rate } = req.body;
  if (!userId || !fromAccountId || !toAccountId || !fromAmount || !toAmount || !rate) {
    return res.status(400).json({ error: 'All exchange parameter fields are required.' });
  }

  const famt = parseFloat(fromAmount);
  const tamt = parseFloat(toAmount);
  if (isNaN(famt) || famt <= 0 || isNaN(tamt) || tamt <= 0) {
    return res.status(400).json({ error: 'Exchange amounts must be positive numeric values.' });
  }

  try {
    const accounts = await dbGetAccounts(userId);
    const fromAcc = accounts.find(a => a.id === fromAccountId);
    const toAcc = accounts.find(a => a.id === toAccountId);

    if (!fromAcc || !toAcc) {
      return res.status(404).json({ error: 'Originating or destination account not found.' });
    }

    if (fromAcc.balance < famt) {
      return res.status(400).json({ error: 'Insufficient available ledger balance for exchange.' });
    }

    // Exchange transaction objects
    const txOut = {
      id: `TXN-${randomDigits(6)}`,
      accountId: fromAccountId,
      userId,
      type: 'TRANSFER_OUT',
      description: `FX Exchange — Swapped to ${toAcc.currency.toUpperCase()}`,
      amount: famt,
      currency: fromAcc.currency,
      date: new Date().toISOString(),
      status: 'COMPLETED',
      counterparty: 'Meridian FX Exchange Desk'
    };

    const txIn = {
      id: `TXN-${randomDigits(6)}`,
      accountId: toAccountId,
      userId,
      type: 'DEPOSIT',
      description: `FX Exchange — Swapped from ${fromAcc.currency.toUpperCase()}`,
      amount: tamt,
      currency: toAcc.currency,
      date: new Date().toISOString(),
      status: 'COMPLETED',
      counterparty: 'Meridian FX Exchange Desk'
    };

    if (usePostgres) {
      const client = await pgPool.connect();
      try {
        await client.query('BEGIN');
        
        // Update balances
        await client.query('UPDATE accounts SET balance = balance - $1 WHERE id = $2', [famt, fromAccountId]);
        await client.query('UPDATE accounts SET balance = balance + $1 WHERE id = $2', [tamt, toAccountId]);
        
        // Insert transactions
        await client.query(`
          INSERT INTO transactions (id, account_id, user_id, type, description, amount, currency, date, status, counterparty)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        `, [txOut.id, txOut.accountId, txOut.userId, txOut.type, txOut.description, txOut.amount, txOut.currency, txOut.date, txOut.status, txOut.counterparty]);

        await client.query(`
          INSERT INTO transactions (id, account_id, user_id, type, description, amount, currency, date, status, counterparty)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        `, [txIn.id, txIn.accountId, txIn.userId, txIn.type, txIn.description, txIn.amount, txIn.currency, txIn.date, txIn.status, txIn.counterparty]);

        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    } else {
      const db = readJSONDB();
      const fIdx = db.accounts.findIndex(a => a.id === fromAccountId);
      const tIdx = db.accounts.findIndex(a => a.id === toAccountId);
      
      if (fIdx === -1 || tIdx === -1) throw new Error('Accounts not found in ledger.');
      
      db.accounts[fIdx].balance = parseFloat((db.accounts[fIdx].balance - famt).toFixed(2));
      db.accounts[tIdx].balance = parseFloat((db.accounts[tIdx].balance + tamt).toFixed(2));
      
      db.transactions.push(txOut);
      db.transactions.push(txIn);
      writeJSONDB(db);
    }

    res.json({
      message: 'Currency exchange completed successfully.',
      rate,
      fromBalance: fromAcc.balance - famt,
      toBalance: toAcc.balance + tamt
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Intrabank Account Transfer Desk (checking <=> savings <=> market)
app.post('/api/transactions/intrabank-transfer', async (req, res) => {
  const { userId, fromAccountId, toAccountId, amount } = req.body;
  if (!userId || !fromAccountId || !toAccountId || !amount) {
    return res.status(400).json({ error: 'All fields (userId, fromAccountId, toAccountId, amount) are required.' });
  }

  const amt = parseFloat(amount);
  if (isNaN(amt) || amt <= 0) {
    return res.status(400).json({ error: 'Transfer amount must be a positive numeric value.' });
  }

  try {
    const accounts = await dbGetAccounts(userId);
    const fromAcc = accounts.find(a => a.id === fromAccountId);
    const toAcc = accounts.find(a => a.id === toAccountId);

    if (!fromAcc || !toAcc) {
      return res.status(404).json({ error: 'Source or destination account not found.' });
    }

    if (fromAcc.id === toAcc.id) {
      return res.status(400).json({ error: 'Source and destination accounts must be different.' });
    }

    if (fromAcc.balance < amt) {
      return res.status(400).json({ error: 'Insufficient available balance.' });
    }

    const txOut = {
      id: `TXN-${randomDigits(6)}`,
      accountId: fromAccountId,
      userId,
      type: 'TRANSFER_OUT',
      description: `Intrabank Transfer to ${toAcc.type.toUpperCase()} (${toAcc.accountNumber.slice(-4)})`,
      amount: amt,
      currency: fromAcc.currency,
      date: new Date().toISOString(),
      status: 'COMPLETED',
      counterparty: 'Self'
    };

    const txIn = {
      id: `TXN-${randomDigits(6)}`,
      accountId: toAccountId,
      userId,
      type: 'DEPOSIT',
      description: `Intrabank Transfer from ${fromAcc.type.toUpperCase()} (${fromAcc.accountNumber.slice(-4)})`,
      amount: amt,
      currency: toAcc.currency,
      date: new Date().toISOString(),
      status: 'COMPLETED',
      counterparty: 'Self'
    };

    if (usePostgres) {
      const client = await pgPool.connect();
      try {
        await client.query('BEGIN');
        await client.query('UPDATE accounts SET balance = balance - $1 WHERE id = $2', [amt, fromAccountId]);
        await client.query('UPDATE accounts SET balance = balance + $1 WHERE id = $2', [amt, toAccountId]);
        
        await client.query(`
          INSERT INTO transactions (id, account_id, user_id, type, description, amount, currency, date, status, counterparty)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        `, [txOut.id, txOut.accountId, txOut.userId, txOut.type, txOut.description, txOut.amount, txOut.currency, txOut.date, txOut.status, txOut.counterparty]);

        await client.query(`
          INSERT INTO transactions (id, account_id, user_id, type, description, amount, currency, date, status, counterparty)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        `, [txIn.id, txIn.accountId, txIn.userId, txIn.type, txIn.description, txIn.amount, txIn.currency, txIn.date, txIn.status, txIn.counterparty]);
        
        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    } else {
      const db = readJSONDB();
      const fIdx = db.accounts.findIndex(a => a.id === fromAccountId);
      const tIdx = db.accounts.findIndex(a => a.id === toAccountId);

      if (fIdx === -1 || tIdx === -1) throw new Error('Accounts not found in ledger.');

      db.accounts[fIdx].balance = parseFloat((db.accounts[fIdx].balance - amt).toFixed(2));
      db.accounts[tIdx].balance = parseFloat((db.accounts[tIdx].balance + amt).toFixed(2));

      db.transactions.push(txOut);
      db.transactions.push(txIn);
      writeJSONDB(db);
    }

    res.json({
      message: 'Intrabank transfer completed successfully.',
      fromBalance: fromAcc.balance - amt,
      toBalance: toAcc.balance + amt
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── OPERATIONS CONSOLE API ENDPOINTS ─────────────────────────────────────────

// Get Onboarding Applications Queue
app.get('/api/admin/applications', async (req, res) => {
  try {
    const apps = await dbGetApplications();
    res.json(apps);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Approve Pending Application
app.post('/api/admin/approve', async (req, res) => {
  const { applicationId } = req.body;
  if (!applicationId) return res.status(400).json({ error: 'Application ID is required.' });

  try {
    const apps = await dbGetApplications();
    const appDetails = apps.find(a => a.id === applicationId);
    if (!appDetails) return res.status(404).json({ error: 'Application not found.' });

    const userId = `MTB-${randomDigits(6)}`;
    const password = generateAlphanumericPassword(10);

    const userSeed = {
      name: appDetails.name,
      email: appDetails.email,
      phone: appDetails.phone,
      address: appDetails.address,
      state: appDetails.state,
      zip: appDetails.zip,
      ssn: appDetails.ssn.replace(/.(?=.{4})/g, '*'),
      accountType: appDetails.accountType
    };

    const selected = appDetails.selectedAccounts || ['checking', 'savings', 'market'];
    const accountsSeed = [];

    // All accounts in USD, each seeded with exactly $5,000,000.00
    if (selected.includes('checking')) {
      accountsSeed.push({
        id: `ACC-${randomDigits(8)}`,
        userId,
        type: 'checking',
        currency: 'USD',
        balance: 5000000.00,
        accountNumber: `0${randomDigits(9)}`,
        routingNumber: 'MTBUSD2X'
      });
    }

    if (selected.includes('savings')) {
      accountsSeed.push({
        id: `ACC-${randomDigits(8)}`,
        userId,
        type: 'savings',
        currency: 'USD',
        balance: 5000000.00,
        accountNumber: `0${randomDigits(9)}`,
        routingNumber: 'MTBUSD2X'
      });
    }

    if (selected.includes('market')) {
      accountsSeed.push({
        id: `ACC-${randomDigits(8)}`,
        userId,
        type: 'market',
        currency: 'USD',
        balance: 5000000.00,
        accountNumber: `0${randomDigits(9)}`,
        routingNumber: 'MTBUSD2X'
      });
    }

    if (selected.includes('cd')) {
      accountsSeed.push({
        id: `ACC-${randomDigits(8)}`,
        userId,
        type: 'cd',
        currency: 'USD',
        balance: 5000000.00,
        accountNumber: `0${randomDigits(9)}`,
        routingNumber: 'MTBUSD2X'
      });
    }

    let txsSeed = [];
    accountsSeed.forEach(acc => {
      const accTxs = generateHighValueTransactions(acc.id, userId, 5000000.00);
      txsSeed = txsSeed.concat(accTxs);
    });

    const cardSeed = {
      id: `CRD-${randomDigits(6)}`,
      userId,
      cardNumber: `4${randomDigits(15)}`,
      cardholderName: appDetails.name.toUpperCase().substring(0, 26),
      expiry: '12/31',
      cvv: randomDigits(3),
      status: 'ACTIVE',
      type: 'DEBIT'
    };

    await dbApproveApplication(applicationId, {
      userId,
      password,
      userSeed,
      accountsSeed,
      cardSeed,
      txsSeed
    });

    await dbAddAuditLog('APPLICATION_APPROVED', `Approved application ${applicationId} for user ${userId} (${appDetails.name}).`);

    // Send Welcome Email containing login credentials
    const reqOrigin = req.headers.origin || `${req.protocol}://${req.get('host')}`;
    const welcomeHTML = `
      <div style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;background-color:#F4F6F9;padding:40px;color:#0A1931;">
        <div style="max-width:600px;margin:0 auto;background-color:#ffffff;border-top:4px solid #002C77;border-radius:6px;box-shadow:0 4px 12px rgba(0,0,0,0.05);overflow:hidden;">
          <div style="background-color:#002C77;padding:24px;text-align:center;">
            <h1 style="color:#ffffff;margin:0;font-size:22px;letter-spacing:1px;">MERIDIAN TRUST</h1>
            <p style="color:#00A3E0;margin:4px 0 0 0;font-size:12px;text-transform:uppercase;letter-spacing:2px;">International Private Banking</p>
          </div>
          <div style="padding:40px 30px;">
            <h2 style="font-size:20px;font-weight:600;margin-top:0;">Welcome to Meridian Trust Bank</h2>
            <p style="font-size:14px;line-height:1.6;color:#555;">Dear ${appDetails.name},</p>
            <p style="font-size:14px;line-height:1.6;color:#555;">Your application for a US-equivalent offshore multi-currency banking profile has been reviewed and approved. Below are your secure credentials to log in to the Client Portal:</p>
            <div style="background-color:#F4F6F9;border:1px solid #D2D7E0;border-radius:4px;padding:20px;margin:24px 0;text-align:left;">
              <table style="width:100%;border-collapse:collapse;font-size:14px;">
                <tr>
                  <td style="padding:6px 0;font-weight:bold;color:#777;width:40%;">Client Account ID:</td>
                  <td style="padding:6px 0;font-weight:bold;color:#002C77;font-family:monospace;font-size:16px;">${userId}</td>
                </tr>
                <tr>
                  <td style="padding:6px 0;font-weight:bold;color:#777;">Temporary Passcode:</td>
                  <td style="padding:6px 0;font-weight:bold;color:#002C77;font-family:monospace;font-size:16px;">${password}</td>
                </tr>
              </table>
            </div>
            <p style="font-size:13px;line-height:1.5;color:#E60000;font-weight:600;">⚠️ Security Mandate Required:</p>
            <p style="font-size:13px;line-height:1.5;color:#555;">Upon your first login, the core ledger will automatically intercept your session and prompt you to establish a custom, permanent passcode before you can access ledger controls or wire systems.</p>
            <div style="text-align:center;margin-top:30px;">
              <a href="${reqOrigin}/#/login" style="display:inline-block;background-color:#002C77;color:#ffffff;text-decoration:none;padding:12px 30px;font-size:14px;font-weight:bold;border-radius:4px;">Access Client Portal</a>
            </div>
          </div>
          <div style="background-color:#F4F6F9;padding:20px;text-align:center;font-size:11px;color:#777;border-top:1px solid #D2D7E0;">
            <p style="margin:0 0 8px 0;">&copy; 2026 Meridian Trust Bank Ltd. Licensed Offshore Financial Institution.</p>
          </div>
        </div>
      </div>
    `;

    sendEmailHelper(appDetails.email, 'Welcome to Meridian Trust Bank — Accounts Active', welcomeHTML);

    res.status(201).json({
      message: 'Application approved successfully.',
      userId,
      password
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Reject / Decline Application
app.post('/api/admin/reject', async (req, res) => {
  const { applicationId } = req.body;
  if (!applicationId) return res.status(400).json({ error: 'Application ID is required.' });

  try {
    await dbDeleteApplication(applicationId);
    await dbAddAuditLog('APPLICATION_REJECTED', `Rejected pending application ${applicationId}.`);
    res.json({ message: 'Application declined.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Fetch Active Clients & Details
app.get('/api/admin/users', async (req, res) => {
  try {
    const users = await dbGetAdminUsers();
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Credit Inbound Wire Deposit
app.post('/api/admin/inbound-wire', async (req, res) => {
  const { accountId, amount, senderName, description } = req.body;
  if (!accountId || !amount || !senderName) {
    return res.status(400).json({ error: 'Account ID, amount, and sender name are required.' });
  }

  const num = parseFloat(amount);
  if (isNaN(num) || num <= 0) return res.status(400).json({ error: 'Amount must be positive.' });

  try {
    // Determine the userId and currency of account
    let userId = null;
    let currency = 'USD';
    
    if (usePostgres) {
      const acc = await queryPG('SELECT user_id, currency FROM accounts WHERE id = $1', [accountId]);
      if (acc.rows.length === 0) return res.status(404).json({ error: 'Account not found.' });
      userId = acc.rows[0].user_id;
      currency = acc.rows[0].currency;
    } else {
      const db = readJSONDB();
      const acc = db.accounts.find(a => a.id === accountId);
      if (!acc) return res.status(404).json({ error: 'Account not found.' });
      userId = acc.userId;
      currency = acc.currency;
    }

    const tx = {
      id: `TXN-${randomDigits(6)}`,
      accountId,
      userId,
      type: 'DEPOSIT',
      description: description || 'Inbound SWIFT wire transfer',
      amount: num,
      currency,
      date: new Date().toISOString(),
      status: 'COMPLETED',
      counterparty: senderName
    };

    await dbCreditDeposit(tx, num, accountId);

    await dbAddAuditLog('INBOUND_WIRE_CREDITED', `Credited inbound wire deposit of ${currency} ${num} to Account ${accountId} (Client ${userId}) from ${senderName}.`);

    res.json({ message: 'Inbound wire credited successfully.', transaction: tx });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Override Ledger Balance
app.post('/api/admin/user/adjust-balance', async (req, res) => {
  const { accountId, amount } = req.body;
  if (!accountId || isNaN(parseFloat(amount))) return res.status(400).json({ error: 'Account ID and valid numeric balance required.' });

  try {
    const acc = await dbAdjustBalance(accountId, amount);
    if (!acc) return res.status(404).json({ error: 'Account not found.' });
    await dbAddAuditLog('BALANCE_OVERRIDDEN', `Adjusted/overrode balance for Account ${accountId} to ${amount}.`);
    res.json(acc);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Toggle Wires Status (Admin Control)
app.post('/api/admin/user/toggle-wires', async (req, res) => {
  const { userId, status, message } = req.body;
  if (!userId || !status) return res.status(400).json({ error: 'User ID and status are required.' });

  try {
    if (usePostgres) {
      await queryPG('UPDATE users SET wire_status = $1, wire_block_message = $2 WHERE id = $3', [status, message || '', userId]);
    } else {
      const db = readJSONDB();
      const user = db.users.find(u => u.id === userId);
      if (!user) return res.status(404).json({ error: 'User not found.' });
      user.wireStatus = status;
      user.wireBlockMessage = message || '';
      writeJSONDB(db);
    }
    await dbAddAuditLog('WIRE_STATUS_TOGGLED', `Outbound wires set to ${status} for User ${userId}. Block message: "${message || ''}"`);
    res.json({ message: 'Wire transfer status updated successfully.', userId, status });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Fetch all pending outbound wires
app.get('/api/admin/pending-wires', async (req, res) => {
  try {
    if (usePostgres) {
      const pRes = await queryPG("SELECT * FROM transactions WHERE status = 'PENDING' AND type = 'TRANSFER_OUT' ORDER BY date DESC");
      res.json(pRes.rows.map(r => ({
        id: r.id, accountId: r.account_id, userId: r.user_id, type: r.type,
        description: r.description, amount: parseFloat(r.amount), currency: r.currency,
        date: r.date, status: r.status, counterparty: r.counterparty, swiftDetails: r.swift_details
      })));
    } else {
      const db = readJSONDB();
      const p = (db.transactions || []).filter(t => t.status === 'PENDING' && t.type === 'TRANSFER_OUT');
      p.sort((a,b) => new Date(b.date) - new Date(a.date));
      res.json(p);
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Approve Pending Outbound Wire (Deduct balance, change to COMPLETED)
app.post('/api/admin/wires/approve', async (req, res) => {
  const { transactionId } = req.body;
  if (!transactionId) return res.status(400).json({ error: 'Transaction ID is required.' });

  try {
    if (usePostgres) {
      const client = await pgPool.connect();
      try {
        await client.query('BEGIN');
        const txRes = await client.query("SELECT * FROM transactions WHERE id = $1 AND status = 'PENDING'", [transactionId]);
        if (txRes.rows.length === 0) {
          throw new Error('Pending transaction not found.');
        }
        const tx = txRes.rows[0];

        // Deduct account balance
        await client.query(`
          UPDATE accounts 
          SET balance = balance - $1 
          WHERE id = $2 AND user_id = $3
        `, [parseFloat(tx.amount), tx.account_id, tx.user_id]);

        // Mark as completed
        await client.query("UPDATE transactions SET status = 'COMPLETED' WHERE id = $1", [transactionId]);

        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    }

    // Fetch details for logging
    let usrId = '', amt = 0, curr = 'USD';
    if (usePostgres) {
      const txQ = await queryPG('SELECT user_id, amount, currency FROM transactions WHERE id = $1', [transactionId]);
      if (txQ.rows.length > 0) {
        usrId = txQ.rows[0].user_id;
        amt = txQ.rows[0].amount;
        curr = txQ.rows[0].currency;
      }
    } else {
      const db = readJSONDB();
      const tx = db.transactions.find(t => t.id === transactionId);
      if (tx) {
        usrId = tx.userId;
        amt = tx.amount;
        curr = tx.currency;
      }
    }
    await dbAddAuditLog('WIRE_APPROVED', `Outbound wire ${transactionId} of ${curr} ${amt} for Client ${usrId} approved and processed.`);

    res.json({ message: 'SWIFT wire transfer approved and finalized.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Decline Pending Outbound Wire (No balance subtraction, change to DECLINED)
app.post('/api/admin/wires/decline', async (req, res) => {
  const { transactionId } = req.body;
  if (!transactionId) return res.status(400).json({ error: 'Transaction ID is required.' });

  try {
    if (usePostgres) {
      const resUpdate = await queryPG("UPDATE transactions SET status = 'DECLINED' WHERE id = $1 AND status = 'PENDING'", [transactionId]);
      if (resUpdate.rowCount === 0) return res.status(404).json({ error: 'Pending transaction not found.' });
    }

    // Fetch details for logging
    let usrId = '', amt = 0, curr = 'USD';
    if (usePostgres) {
      const txQ = await queryPG('SELECT user_id, amount, currency FROM transactions WHERE id = $1', [transactionId]);
      if (txQ.rows.length > 0) {
        usrId = txQ.rows[0].user_id;
        amt = txQ.rows[0].amount;
        curr = txQ.rows[0].currency;
      }
    } else {
      const db = readJSONDB();
      const tx = db.transactions.find(t => t.id === transactionId);
      if (tx) {
        usrId = tx.userId;
        amt = tx.amount;
        curr = tx.currency;
      }
    }
    await dbAddAuditLog('WIRE_DECLINED', `Outbound wire ${transactionId} of ${curr} ${amt} for Client ${usrId} declined and cancelled.`);

    res.json({ message: 'SWIFT wire transfer declined.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Fetch Operations Audit Logs
app.get('/api/admin/audit-logs', async (req, res) => {
  try {
    if (usePostgres) {
      const logsRes = await queryPG('SELECT * FROM audit_logs ORDER BY timestamp DESC LIMIT 50');
      res.json(logsRes.rows.map(r => ({
        id: r.id, action: r.action, details: r.details, timestamp: r.timestamp
      })));
    } else {
      const db = readJSONDB();
      const logs = db.auditLogs || [];
      const sortedLogs = [...logs].sort((a,b) => new Date(b.timestamp) - new Date(a.timestamp));
      res.json(sortedLogs.slice(0, 50));
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── CATCH-ALL ROUTING FOR FRONTEND CLIPS ─────────────────────────────────────

// Serve Admin Dashboard HTML on Secret Path
app.get('/admin/*', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin', 'index.html'));
});

app.get('/admin', (req, res) => {
  res.redirect('/admin/');
});

// Serve Public Portal as Default Fallback Route
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start Single Port Listener
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`[-] SERVER: Meridian Core active on Port ${PORT}`);
  console.log(`[-] ACCESS USER WEBSITE  : http://localhost:${PORT}`);
  console.log(`[-] ACCESS ADMIN CONSOLE : http://localhost:${PORT}/admin`);
});
