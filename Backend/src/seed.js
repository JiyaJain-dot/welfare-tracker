// Run this once with: npm run seed
// It creates a starting office, some schemes with priority levels, and
// one officer login so you have something to test the API with.
require('dotenv').config();
const bcrypt = require('bcryptjs');
const { db, ready } = require('./db');

async function seed() {
  await ready;

  const officeResult = await db.execute({
    sql: 'INSERT INTO offices (name) VALUES (?)',
    args: ['Main Taluk Office'],
  });
  const officeId = Number(officeResult.lastInsertRowid);

  const schemes = [
    { name: 'Old age pension', priority: 1 },
    { name: 'Widow pension', priority: 1 },
    { name: 'Disability pension', priority: 1 },
    { name: 'Scholarship', priority: 2 },
    { name: 'Ration card benefit', priority: 2 },
    { name: 'Bank loan scheme', priority: 3 },
  ];
  for (const s of schemes) {
    await db.execute({
      sql: 'INSERT INTO schemes (name, priority) VALUES (?, ?)',
      args: [s.name, s.priority],
    });
  }

  const passwordHash = bcrypt.hashSync('officer123', 10);
  await db.execute({
    sql: 'INSERT INTO officers (name, username, password_hash, office_id) VALUES (?, ?, ?, ?)',
    args: ['Test Officer', 'officer1', passwordHash, officeId],
  });

  console.log('Seed complete.');
  console.log('Test officer login -> username: officer1  password: officer123');
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
