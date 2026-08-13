const express = require('express');
const { db, ready } = require('../db');
const { requireOfficer } = require('../middleware/auth');
const { generateTrackingId } = require('../utils/trackingId');
const { sendSms } = require('../utils/sms');

const router = express.Router();
router.use(requireOfficer); // every route below requires officer login

// POST /api/v1/officer/applications
// body: { name, phone, address, schemeId }
router.post('/applications', async (req, res) => {
  const { name, phone, address, schemeId } = req.body;
  if (!name || !phone || !schemeId) {
    return res.status(400).json({ error: { code: 'MISSING_FIELDS', message: 'name, phone and schemeId are required' } });
  }

  await ready;
  const now = new Date().toISOString();
  const trackingId = generateTrackingId();

  const applicantResult = await db.execute({
    sql: 'INSERT INTO applicants (name, phone, address) VALUES (?, ?, ?)',
    args: [name, phone, address || null],
  });
  const applicantId = Number(applicantResult.lastInsertRowid);

  const applicationResult = await db.execute({
    sql: `INSERT INTO applications (tracking_id, applicant_id, scheme_id, office_id, current_stage, created_at, updated_at)
          VALUES (?, ?, ?, ?, 'submitted', ?, ?)`,
    args: [trackingId, applicantId, schemeId, req.officer.officeId, now, now],
  });
  const applicationId = Number(applicationResult.lastInsertRowid);

  await db.execute({
    sql: `INSERT INTO status_history (application_id, stage, note, changed_by, changed_at)
          VALUES (?, 'submitted', 'Application received at office', ?, ?)`,
    args: [applicationId, req.officer.username, now],
  });

  await sendSms(phone, `Your welfare application has been received. Your tracking ID is ${trackingId}. Use it to check status anytime.`);

  res.status(201).json({ data: { applicationId, trackingId } });
});

// GET /api/v1/officer/applications?stage=verification
router.get('/applications', async (req, res) => {
  const { stage } = req.query;
  await ready;

  let sql = `
    SELECT applications.id, applications.tracking_id, applications.current_stage,
           applications.created_at, applications.updated_at,
           schemes.name AS scheme_name, schemes.priority,
           applicants.name AS applicant_name, applicants.phone
    FROM applications
    JOIN schemes ON schemes.id = applications.scheme_id
    JOIN applicants ON applicants.id = applications.applicant_id
    WHERE applications.office_id = ?
  `;
  const args = [req.officer.officeId];

  if (stage) {
    sql += ' AND applications.current_stage = ?';
    args.push(stage);
  }

  sql += ' ORDER BY schemes.priority ASC, applications.created_at ASC';

  const result = await db.execute({ sql, args });
  res.json({ data: result.rows });
});

// GET /api/v1/officer/stats
router.get('/stats', async (req, res) => {
  const officeId = req.officer.officeId;
  await ready;

  const totalResult = await db.execute({
    sql: `SELECT COUNT(*) AS count FROM applications
          WHERE office_id = ? AND current_stage != 'approved' AND current_stage != 'rejected'`,
    args: [officeId],
  });

  const bySchemeResult = await db.execute({
    sql: `SELECT schemes.name AS scheme_name, schemes.priority, COUNT(applications.id) AS count
          FROM applications
          JOIN schemes ON schemes.id = applications.scheme_id
          WHERE applications.office_id = ? AND applications.current_stage != 'approved' AND applications.current_stage != 'rejected'
          GROUP BY schemes.id
          ORDER BY schemes.priority ASC`,
    args: [officeId],
  });

  res.json({ data: { totalPending: Number(totalResult.rows[0].count), byScheme: bySchemeResult.rows } });
});

// PATCH /api/v1/officer/applications/:id/status
router.patch('/applications/:id/status', async (req, res) => {
  const { id } = req.params;
  const { stage, note } = req.body;
  const validStages = ['submitted', 'verification', 'review', 'approved', 'rejected'];

  if (!validStages.includes(stage)) {
    return res.status(400).json({ error: { code: 'INVALID_STAGE', message: `stage must be one of ${validStages.join(', ')}` } });
  }

  await ready;
  const appResult = await db.execute({
    sql: `SELECT applications.*, applicants.phone, applicants.name AS applicant_name
          FROM applications JOIN applicants ON applicants.id = applications.applicant_id
          WHERE applications.id = ?`,
    args: [id],
  });
  const application = appResult.rows[0];

  if (!application) {
    return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Application not found' } });
  }

  const now = new Date().toISOString();
  await db.execute({
    sql: 'UPDATE applications SET current_stage = ?, updated_at = ? WHERE id = ?',
    args: [stage, now, id],
  });
  await db.execute({
    sql: `INSERT INTO status_history (application_id, stage, note, changed_by, changed_at) VALUES (?, ?, ?, ?, ?)`,
    args: [id, stage, note || null, req.officer.username, now],
  });

  await sendSms(application.phone, `Update on your application ${application.tracking_id}: status changed to "${stage}".${note ? ' Note: ' + note : ''}`);

  res.json({ data: { id: Number(id), stage, updatedAt: now } });
});

// POST /api/v1/officer/applications/:id/documents
router.post('/applications/:id/documents', async (req, res) => {
  const { id } = req.params;
  const { docName, status, note } = req.body;
  const validStatuses = ['pending', 'received', 'missing'];

  if (!docName || !validStatuses.includes(status)) {
    return res.status(400).json({ error: { code: 'INVALID_INPUT', message: `docName is required and status must be one of ${validStatuses.join(', ')}` } });
  }

  await ready;
  const appResult = await db.execute({
    sql: `SELECT applications.tracking_id, applicants.phone
          FROM applications JOIN applicants ON applicants.id = applications.applicant_id
          WHERE applications.id = ?`,
    args: [id],
  });
  const application = appResult.rows[0];

  if (!application) {
    return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Application not found' } });
  }

  const existingResult = await db.execute({
    sql: 'SELECT id FROM documents WHERE application_id = ? AND doc_name = ?',
    args: [id, docName],
  });
  const existing = existingResult.rows[0];

  if (existing) {
    await db.execute({
      sql: 'UPDATE documents SET status = ?, note = ? WHERE id = ?',
      args: [status, note || null, existing.id],
    });
  } else {
    await db.execute({
      sql: 'INSERT INTO documents (application_id, doc_name, status, note) VALUES (?, ?, ?, ?)',
      args: [id, docName, status, note || null],
    });
  }

  if (status === 'missing') {
    await sendSms(application.phone, `Action needed on application ${application.tracking_id}: "${docName}" is missing. Please submit it to proceed.`);
  }

  res.json({ data: { applicationId: Number(id), docName, status } });
});

module.exports = router;
