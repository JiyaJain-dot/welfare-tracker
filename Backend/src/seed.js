// Run this once with: npm run seed
// It creates a starting office, some schemes with priority levels, and
// one officer login so you have something to test the API with.
require('dotenv').config();
const bcrypt = require('bcryptjs');
const db = require('./db');

const officeId = db.prepare('INSERT INTO offices (name) VALUES (?)').run('Main Taluk Office').lastInsertRowid;

const schemes = [
  { name: 'Old age pension', priority: 1 },
  { name: 'Widow pension', priority: 1 },
  { name: 'Disability pension', priority: 1 },
  { name: 'Scholarship', priority: 2 },
  { name: 'Ration card benefit', priority: 2 },
  { name: 'Bank loan scheme', priority: 3 }
];
const insertScheme = db.prepare('INSERT INTO schemes (name, priority) VALUES (?, ?)');
schemes.forEach(s => insertScheme.run(s.name, s.priority));

const passwordHash = bcrypt.hashSync('officer123', 10);
db.prepare('INSERT INTO officers (name, username, password_hash, office_id) VALUES (?, ?, ?, ?)')
  .run('Test Officer', 'officer1', passwordHash, officeId);

console.log('Seed complete.');
console.log('Test officer login -> username: officer1  password: officer123');
