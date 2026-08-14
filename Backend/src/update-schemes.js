// One-time (or reusable) script to update scheme priorities without
// wiping and reseeding everything else. Run with: npm run update-schemes
require('dotenv').config();
const { db, ready } = require('./db');

// Lower number = higher priority = seen first on the officer dashboard.
// "Ration card benefit" wasn't mentioned by the frontend team's feedback,
// so it's grouped alongside Scholarship for now - adjust if they meant
// something different for it.
const priorities = [
  { name: 'Old age pension', priority: 1 },
  { name: 'Disability pension', priority: 2 },
  { name: 'Widow pension', priority: 3 },
  { name: 'Scholarship', priority: 4 },
  { name: 'Ration card benefit', priority: 4 },
  { name: 'Bank loan scheme', priority: 5 },
];

async function updatePriorities() {
  await ready;
  for (const s of priorities) {
    const result = await db.execute({
      sql: 'UPDATE schemes SET priority = ? WHERE name = ?',
      args: [s.priority, s.name],
    });
    console.log(`${s.name} -> priority ${s.priority} (${result.rowsAffected} row updated)`);
  }
  console.log('Done.');
}

updatePriorities().catch((err) => {
  console.error('Update failed:', err);
  process.exit(1);
});
