// Creates one realistic dummy application with a multi-stage timeline,
// a missing document, and matching notifications - so the frontend has
// real data to build the tracker + notifications UI against.
// Run with: npm run create-test-application
// Requires `npm run seed` to have been run already (needs an office + scheme to exist).
require('dotenv').config();
const { db, ready } = require('./db');
const { generateTrackingId } = require('./utils/trackingId');

const DAY = 24 * 60 * 60 * 1000;

async function createTestApplication() {
  await ready;

  const officeResult = await db.execute('SELECT id FROM offices LIMIT 1');
  const office = officeResult.rows[0];
  const schemeResult = await db.execute({
    sql: 'SELECT id FROM schemes WHERE name = ?',
    args: ['Old age pension'],
  });
  const scheme = schemeResult.rows[0];

  if (!office || !scheme) {
    console.error('No office/scheme found - run `npm run seed` first, then try again.');
    process.exit(1);
  }

  const trackingId = generateTrackingId();
  const submittedAt = new Date(Date.now() - 5 * DAY).toISOString();
  const now = new Date().toISOString();

  const applicantResult = await db.execute({
    sql: 'INSERT INTO applicants (name, phone, address) VALUES (?, ?, ?)',
    args: ['Ramesh Kumar (test)', '9999999999', 'Test Village, Test District'],
  });
  const applicantId = Number(applicantResult.lastInsertRowid);

  const applicationResult = await db.execute({
    sql: `INSERT INTO applications (tracking_id, applicant_id, scheme_id, office_id, current_stage, created_at, updated_at)
          VALUES (?, ?, ?, ?, 'verification', ?, ?)`,
    args: [trackingId, applicantId, scheme.id, office.id, submittedAt, now],
  });
  const applicationId = Number(applicationResult.lastInsertRowid);

  const stages = [
    { stage: 'submitted', note: 'Application received at office', daysAgo: 5 },
    { stage: 'verification', note: 'Documents under review', daysAgo: 2 },
  ];

  for (const s of stages) {
    const changedAt = new Date(Date.now() - s.daysAgo * DAY).toISOString();
    await db.execute({
      sql: `INSERT INTO status_history (application_id, stage, note, changed_by, changed_at) VALUES (?, ?, ?, ?, ?)`,
      args: [applicationId, s.stage, s.note, 'officer1', changedAt],
    });
    await db.execute({
      sql: `INSERT INTO notifications (application_id, type, message, created_at) VALUES (?, 'status_update', ?, ?)`,
      args: [applicationId, `Status changed to "${s.stage}". ${s.note}`, changedAt],
    });
  }

  await db.execute({
    sql: `INSERT INTO documents (application_id, doc_name, status, note) VALUES (?, 'Aadhaar card', 'missing', NULL)`,
    args: [applicationId],
  });
  await db.execute({
    sql: `INSERT INTO notifications (application_id, type, message, created_at) VALUES (?, 'document_missing', ?, ?)`,
    args: [applicationId, 'Action needed: "Aadhaar card" is missing. Please submit it to proceed.', now],
  });

  console.log('Test application created.');
  console.log('Tracking ID:', trackingId);
  console.log('Try: GET /api/v1/tracker/' + trackingId);
  console.log('Try: GET /api/v1/notifications/' + trackingId);
}

createTestApplication().catch((err) => {
  console.error('Failed:', err);
  process.exit(1);
});
