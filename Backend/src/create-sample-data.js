// Creates one test application each for Widow pension, Disability
// pension, and Scholarship - each at a different stage in the process,
// so the frontend has varied real data to test against.
// Run with: npm run create-sample-data
// Requires `npm run seed` to have been run already.
require('dotenv').config();
const { db, ready } = require('./db');
const { generateTrackingId } = require('./utils/trackingId');

const DAY = 24 * 60 * 60 * 1000;

const STAGE_NOTES = {
  submitted: 'Application received at office',
  verification: 'Documents under review',
  review: 'Under final review',
  approved: 'Application approved',
};
const ALL_STAGES = ['submitted', 'verification', 'review', 'approved'];

const samples = [
  {
    schemeName: 'Widow pension',
    applicantName: 'Lakshmi Devi (test)',
    phone: '9888888888',
    address: 'Test Village, Test District',
    finalStage: 'review',
    missingDoc: null,
  },
  {
    schemeName: 'Disability pension',
    applicantName: 'Suresh Babu (test)',
    phone: '9777777777',
    address: 'Test Village, Test District',
    finalStage: 'verification',
    missingDoc: 'Disability certificate',
  },
  {
    schemeName: 'Scholarship',
    applicantName: 'Priya Sharma (test)',
    phone: '9666666666',
    address: 'Test Village, Test District',
    finalStage: 'submitted',
    missingDoc: null,
  },
];

async function createOne(sample, office) {
  const schemeResult = await db.execute({
    sql: 'SELECT id FROM schemes WHERE name = ?',
    args: [sample.schemeName],
  });
  const scheme = schemeResult.rows[0];
  if (!scheme) {
    console.error(`Scheme "${sample.schemeName}" not found - run \`npm run seed\` first.`);
    return null;
  }

  const trackingId = generateTrackingId();
  const submittedAt = new Date(Date.now() - 6 * DAY).toISOString();
  const now = new Date().toISOString();

  const applicantResult = await db.execute({
    sql: 'INSERT INTO applicants (name, phone, address) VALUES (?, ?, ?)',
    args: [sample.applicantName, sample.phone, sample.address],
  });
  const applicantId = Number(applicantResult.lastInsertRowid);

  const applicationResult = await db.execute({
    sql: `INSERT INTO applications (tracking_id, applicant_id, scheme_id, office_id, current_stage, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)`,
    args: [trackingId, applicantId, scheme.id, office.id, sample.finalStage, submittedAt, now],
  });
  const applicationId = Number(applicationResult.lastInsertRowid);

  const finalIndex = ALL_STAGES.indexOf(sample.finalStage);
  const stagesToInsert = ALL_STAGES.slice(0, finalIndex + 1);

  let dayOffset = 6;
  for (const stage of stagesToInsert) {
    const changedAt = new Date(Date.now() - dayOffset * DAY).toISOString();
    await db.execute({
      sql: `INSERT INTO status_history (application_id, stage, note, changed_by, changed_at) VALUES (?, ?, ?, ?, ?)`,
      args: [applicationId, stage, STAGE_NOTES[stage], 'officer1', changedAt],
    });
    await db.execute({
      sql: `INSERT INTO notifications (application_id, type, message, created_at) VALUES (?, 'status_update', ?, ?)`,
      args: [applicationId, `Status changed to "${stage}". ${STAGE_NOTES[stage]}`, changedAt],
    });
    dayOffset = Math.max(0, dayOffset - 2);
  }

  if (sample.missingDoc) {
    await db.execute({
      sql: `INSERT INTO documents (application_id, doc_name, status, note) VALUES (?, ?, 'missing', NULL)`,
      args: [applicationId, sample.missingDoc],
    });
    await db.execute({
      sql: `INSERT INTO notifications (application_id, type, message, created_at) VALUES (?, 'document_missing', ?, ?)`,
      args: [applicationId, `Action needed: "${sample.missingDoc}" is missing. Please submit it to proceed.`, now],
    });
  }

  return { scheme: sample.schemeName, trackingId, finalStage: sample.finalStage };
}

async function run() {
  await ready;

  const officeResult = await db.execute('SELECT id FROM offices LIMIT 1');
  const office = officeResult.rows[0];
  if (!office) {
    console.error('No office found - run `npm run seed` first.');
    process.exit(1);
  }

  const results = [];
  for (const sample of samples) {
    const r = await createOne(sample, office);
    if (r) results.push(r);
  }

  console.log('\nCreated test applications:');
  results.forEach((r) => {
    console.log(`- ${r.scheme}: ${r.trackingId} (stage: ${r.finalStage})`);
  });
}

run().catch((err) => {
  console.error('Failed:', err);
  process.exit(1);
});
