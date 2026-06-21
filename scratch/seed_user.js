const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, '../db.json');
const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));

// User Details
const userId = 'MTB-108293';
const newUser = {
  id: userId,
  name: 'James Krinis',
  email: 'j.krinis@krinisgroup.com',
  password: 'Garrihgton123',
  accountType: 'personal',
  kycStatus: 'APPROVED',
  createdAt: '2026-06-21T10:00:00.000Z',
  wireStatus: 'ENABLED',
  wireBlockMessage: ''
};

// Accounts Details (15,000,000.00 split)
const newAccounts = [
  {
    id: `ACC-108293-CHK`,
    userId: userId,
    type: 'checking',
    currency: 'USD',
    balance: 5245618.37,
    accountNumber: '0388273910',
    routingNumber: 'MTBUSD2X'
  },
  {
    id: `ACC-108293-SAV`,
    userId: userId,
    type: 'savings',
    currency: 'USD',
    balance: 4879152.12,
    accountNumber: '0388273923',
    routingNumber: 'MTBUSD2X'
  },
  {
    id: `ACC-108293-MKT`,
    userId: userId,
    type: 'market',
    currency: 'USD',
    balance: 4875229.51,
    accountNumber: '0388273936',
    routingNumber: 'MTBUSD2X'
  }
];

// Cards Details
const newCards = [
  {
    id: 'CRD-201931',
    userId: userId,
    cardNumber: '5314820073918842',
    cardholderName: 'JAMES KRINIS',
    expiry: '12/30',
    cvv: '392',
    status: 'ACTIVE',
    type: 'MASTERCARD DEBIT'
  },
  {
    id: 'CRD-201932',
    userId: userId,
    cardNumber: '5271930148529063',
    cardholderName: 'JAMES KRINIS',
    expiry: '06/29',
    cvv: '109',
    status: 'ACTIVE',
    type: 'MASTERCARD VIRTUAL'
  }
];

// Transactions (Construction and Oil & Gas LLCs)
const newTransactions = [
  {
    id: 'TXN-9182301',
    accountId: 'ACC-108293-CHK',
    userId: userId,
    type: 'DEBIT',
    description: 'Wire Transfer to Trident Construction Group LLC',
    amount: 125450.00,
    currency: 'USD',
    date: '2026-06-10T14:32:15.000Z',
    status: 'COMPLETED',
    counterparty: 'Trident Construction Group LLC'
  },
  {
    id: 'TXN-9182302',
    accountId: 'ACC-108293-CHK',
    userId: userId,
    type: 'CREDIT',
    description: 'Dividend Inflow from Krinis Drilling & Exploration LLC',
    amount: 785120.00,
    currency: 'USD',
    date: '2026-06-12T09:15:30.000Z',
    status: 'COMPLETED',
    counterparty: 'Krinis Drilling & Exploration LLC'
  },
  {
    id: 'TXN-9182303',
    accountId: 'ACC-108293-CHK',
    userId: userId,
    type: 'DEBIT',
    description: 'Supplier Payment to Apex Infrastructure Partners LLC',
    amount: 430700.00,
    currency: 'USD',
    date: '2026-06-14T11:05:00.000Z',
    status: 'COMPLETED',
    counterparty: 'Apex Infrastructure Partners LLC'
  },
  {
    id: 'TXN-9182304',
    accountId: 'ACC-108293-SAV',
    userId: userId,
    type: 'DEBIT',
    description: 'Material Procurement: BlueStream Petroleum LLC',
    amount: 85120.40,
    currency: 'USD',
    date: '2026-06-15T16:45:22.000Z',
    status: 'COMPLETED',
    counterparty: 'BlueStream Petroleum LLC'
  },
  {
    id: 'TXN-9182305',
    accountId: 'ACC-108293-MKT',
    userId: userId,
    type: 'CREDIT',
    description: 'Escrow Release: Vanguard Heavy Industries LLC',
    amount: 230000.00,
    currency: 'USD',
    date: '2026-06-17T10:30:10.000Z',
    status: 'COMPLETED',
    counterparty: 'Vanguard Heavy Industries LLC'
  },
  {
    id: 'TXN-9182306',
    accountId: 'ACC-108293-CHK',
    userId: userId,
    type: 'DEBIT',
    description: 'Contractor Payment to Nova Energy & Resources LLC',
    amount: 92800.00,
    currency: 'USD',
    date: '2026-06-18T13:20:40.000Z',
    status: 'COMPLETED',
    counterparty: 'Nova Energy & Resources LLC'
  },
  {
    id: 'TXN-9182307',
    accountId: 'ACC-108293-CHK',
    userId: userId,
    type: 'DEBIT',
    description: 'Equipment Rental: Titan Steelworks LLC',
    amount: 115000.00,
    currency: 'USD',
    date: '2026-06-19T08:12:05.000Z',
    status: 'COMPLETED',
    counterparty: 'Titan Steelworks LLC'
  },
  {
    id: 'TXN-9182308',
    accountId: 'ACC-108293-SAV',
    userId: userId,
    type: 'DEBIT',
    description: 'Logistics Wire to Summit Oilfield Services LLC',
    amount: 64300.00,
    currency: 'USD',
    date: '2026-06-20T15:00:00.000Z',
    status: 'COMPLETED',
    counterparty: 'Summit Oilfield Services LLC'
  },
  {
    id: 'TXN-9182309',
    accountId: 'ACC-108293-MKT',
    userId: userId,
    type: 'CREDIT',
    description: 'Refinery Payout from Phoenix Petrochemical Partners LLC',
    amount: 500000.00,
    currency: 'USD',
    date: '2026-06-21T09:45:12.000Z',
    status: 'COMPLETED',
    counterparty: 'Phoenix Petrochemical Partners LLC'
  }
];

// Append to db JSON lists
db.users.push(newUser);
db.accounts.push(...newAccounts);
db.cards.push(...newCards);
db.transactions.push(...newTransactions);

fs.writeFileSync(dbPath, JSON.stringify(db, null, 2), 'utf8');
console.log('Successfully seeded user James Krinis in db.json!');
