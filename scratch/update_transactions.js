const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, '../db.json');
const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));

// Find and update the status of the specific transactions
const updates = {
  'TXN-9182309': 'PENDING',
  'TXN-9182308': 'DECLINED',
  'TXN-9182307': 'CANCELLED',
  'TXN-9182306': 'FAILED',
  'TXN-9182305': 'PENDING'
};

let count = 0;
db.transactions.forEach(t => {
  if (updates[t.id]) {
    t.status = updates[t.id];
    count++;
  }
});

fs.writeFileSync(dbPath, JSON.stringify(db, null, 2), 'utf8');
console.log(`Updated ${count} transactions successfully in db.json!`);
