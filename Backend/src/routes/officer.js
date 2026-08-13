const express = require('express');
const db = require('../db');
const { requireOfficer } = require('../middleware/auth');
const { generateTrackingId } = require('../utils/trackingId');
const { sendSms } = require('../utils/sms');

const router = express.Router();
router.use(requireOfficer); // every route below requires officer login

// POST /api/v1/officer/applications
// This is what runs when a citizen is standing at the office and the
// officer types their details in. body: { name, phone, address, schemeId }
router.post('/applications', (req, res) => {
  const { name, phone, address, schemeId } = req.body;
  if (!name || !phone || !schemeId) {
    return res.status(400).json({ error: { code: 'MISSING_FIELDS', message: 'name, phone and schemeId are required' } });
  }

  const now = new Date().toISOString();
  const trackingId = generateTrackingId();

  const insertApplicant = db.prepare('INSERT INTO applicants (name, phone, address) VALUES (?, ?, ?)');
  const applicantId = insertApplicant.run(name, phone, address || null).lastInsertRowid;

  const insertApplication = db.prepare(`
    INSERT INTO applications (tracking_id, applicant_id, scheme_id, office_id, current_stage, created_at, updated_at)
    VALUES (?, ?, ?, ?, 'submitted', ?, ?)
  `);
  const applicationId = insertApplication.run(trackingId, applicantId, schemeId, req.officer.officeId, now, now).lastInsertRowid;

  db.prepare(`
    INSERT INTO status_history (application_id, stage, note, changed_by, changed_at)
    VALUES (?, 'submitted', 'Application received at office', ?, ?)
  `).run(applicationId, req.officer.username, now);

  sendSms(phone, `Your welfare application has been received. Your tracking ID is ${trackingId}. Use it to check status anytime.`);

  res.status(201).json({ data: { applicationId, trackingId } });
});

// GET /api/v1/officer/applications?stage=verification
// Priority sorting: lower scheme priority number = seen first (e.g. old
// age pension = 1). Within the same priority, oldest submissions first,
// so nothing quietly sits at the back of the queue.
router.get('/applications', (req, res) => {
  const { stage } = req.query;

  let query = `
    SELECT applications.id, applications.tracking_id, applications.current_stage,
           applications.created_at, applications.updated_at,
           schemes.name AS scheme_name, schemes.priority,
           applicants.name AS applicant_name, applicants.phone
    FROM applications
    JOIN schemes ON schemes.id = applications.scheme_id
    JOIN applicants ON applicants.id = applications.applicant_id
    WHERE applications.office_id = ?
  `;
  const params = [req.officer.officeId];

  if (stage) {
    query += ' AND applications.current_stage = ?';
    params.push(stage);
  }

  query += ' ORDER BY schemes.priority ASC, applications.created_at ASC';

  const applications = db.prepare(query).all(...params);
  res.json({ data: applications });
});

// GET /api/v1/officer/stats
// Total pending count + a breakdown per scheme, for the dashboard summary cards.
router.get('/stats', (req, res) => {
  const officeId = req.officer.officeId;

  const total = db.prepare(`
    SELECT COUNT(*) AS count FROM applications
    WHERE office_id = ? AND current_stage != 'approved' AND current_stage != 'rejected'
  `).get(officeId).count;

  const byScheme = db.prepare(`
    SELECT schemes.name AS scheme_name, schemes.priority, COUNT(applications.id) AS count
    FROM applications
    JOIN schemes ON schemes.id = applications.scheme_id
    WHERE applications.office_id = ? AND applications.current_stage != 'approved' AND applications.current_stage != 'rejected'
    GROUP BY schemes.id
    ORDER BY schemes.priority ASC
  `).all(officeId);

  res.json({ data: { totalPending: total, byScheme } });
});

// PATCH /api/v1/officer/applications/:id/status
// body: { stage, note }  -- stage: verification | review | approved | rejected
router.patch('/applications/:id/status', (req, res) => {
  const { id } = req.params;
  const { stage, note } = req.body;
  const validStages = ['submitted', 'verification', 'review', 'approved', 'rejected'];

  if (!validStages.includes(stage)) {
    return res.status(400).json({ error: { code: 'INVALID_STAGE', message: `stage must be one of ${validStages.join(', ')}` } });
  }

  const application = db.prepare(`
    SELECT applications.*, applicants.phone, applicants.name AS applicant_name
    FROM applications JOIN applicants ON applicants.id = applications.applicant_id
    WHERE applications.id = ?
  `).get(id);

  if (!application) {
    return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Application not found' } });
  }

  const now = new Date().toISOString();
  db.prepare('UPDATE applications SET current_stage = ?, updated_at = ? WHERE id = ?').run(stage, now, id);
  db.prepare(`
    INSERT INTO status_history (application_id, stage, note, changed_by, changed_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(id, stage, note || null, req.officer.username, now);

  sendSms(application.phone, `Update on your application ${application.tracking_id}: status changed to "${stage}".${note ? ' Note: ' + note : ''}`);

  res.json({ data: { id: Number(id), stage, updatedAt: now } });
});

// POST /api/v1/officer/applications/:id/documents
// Flags a document as missing (or received). body: { docName, status, note }
router.post('/applications/:id/documents', (req, res) => {
  const { id } = req.params;
  const { docName, status, note } = req.body;
  const validStatuses = ['pending', 'received', 'missing'];

  if (!docName || !validStatuses.includes(status)) {
    return res.status(400).json({ error: { code: 'INVALID_INPUT', message: `docName is required and status must be one of ${validStatuses.join(', ')}` } });
  }

  const application = db.prepare(`
    SELECT applications.tracking_id, applicants.phone
    FROM applications JOIN applicants ON applicants.id = applications.applicant_id
    WHERE applications.id = ?
  `).get(id);

  if (!application) {
    return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Application not found' } });
  }

  const existing = db.prepare('SELECT id FROM documents WHERE application_id = ? AND doc_name = ?').get(id, docName);
  if (existing) {
    db.prepare('UPDATE documents SET status = ?, note = ? WHERE id = ?').run(status, note || null, existing.id);
  } else {
    db.prepare('INSERT INTO documents (application_id, doc_name, status, note) VALUES (?, ?, ?, ?)').run(id, docName, status, note || null);
  }

  if (status === 'missing') {
    sendSms(application.phone, `Action needed on application ${application.tracking_id}: "${docName}" is missing. Please submit it to proceed.`);
  }

  res.json({ data: { applicationId: Number(id), docName, status } });
});

module.exports = router;
