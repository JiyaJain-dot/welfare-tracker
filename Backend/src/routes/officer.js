const express = require('express');
const { db, ready } = require('../db');
const { requireOfficer } = require('../middleware/auth');
const { generateTrackingId } = require('../utils/trackingId');
const { sendSms } = require('../utils/sms');
const { fetchNormalizedRationCards } = require('../connectors/rationCardConnector');

const router = express.Router();
router.use(requireOfficer);

// POST /api/v1/officer/applications
router.post('/applications', async (req, res) => {
  const { name, phone, address, schemeId } = req.body;

  if (!name || !phone || !schemeId) {
    return res.status(400).json({
      error: { code: 'MISSING_FIELDS', message: 'name, phone and schemeId are required' },
    });
  }

  await ready;

  const duplicateResult = await db.execute({
    sql: `
      SELECT applications.id, applications.tracking_id
      FROM applications
      JOIN applicants ON applicants.id = applications.applicant_id
      WHERE applicants.phone = ?
      AND applications.scheme_id = ?
      AND applications.office_id = ?
    `,
    args: [phone, schemeId, req.officer.officeId],
  });

  const duplicate = duplicateResult.rows[0];
  if (duplicate) {
    return res.status(409).json({
      error: {
        code: 'DUPLICATE_APPLICATION',
        message: 'An application already exists for this applicant and scheme.',
        existingApplication: { applicationId: duplicate.id, trackingId: duplicate.tracking_id },
      },
    });
  }

  const now = new Date().toISOString();
  const trackingId = generateTrackingId();

  const applicantResult = await db.execute({
    sql: 'INSERT INTO applicants (name, phone, address) VALUES (?, ?, ?)',
    args: [name, phone, address || null],
  });
  const applicantId = Number(applicantResult.lastInsertRowid);

  const applicationResult = await db.execute({
    sql: `INSERT INTO applications
          (tracking_id, applicant_id, scheme_id, office_id, current_stage, created_at, updated_at)
          VALUES (?, ?, ?, ?, 'submitted', ?, ?)`,
    args: [trackingId, applicantId, schemeId, req.officer.officeId, now, now],
  });
  const applicationId = Number(applicationResult.lastInsertRowid);

  await db.execute({
    sql: `INSERT INTO status_history (application_id, stage, note, changed_by, changed_at)
          VALUES (?, 'submitted', 'Application received at office', ?, ?)`,
    args: [applicationId, req.officer.username, now],
  });

  await db.execute({
    sql: `INSERT INTO notifications (application_id, type, message, created_at)
          VALUES (?, 'status_update', ?, ?)`,
    args: [applicationId, `Application received. Tracking ID: ${trackingId}.`, now],
  });

  await sendSms(phone, `Your welfare application has been received. Your tracking ID is ${trackingId}. Use it to check status anytime.`);

  res.status(201).json({ data: { applicationId, trackingId } });
});

// GET /api/v1/officer/applications
router.get('/applications', async (req, res) => {
  const { stage } = req.query;

  await ready;

  const sql = `
    SELECT applications.id, applications.tracking_id, applications.current_stage,
           applications.created_at, applications.updated_at,
           schemes.name AS scheme_name, schemes.priority,
           applicants.name AS applicant_name, applicants.phone,
           'Welfare Tracker' AS source_system
    FROM applications
    JOIN schemes ON schemes.id = applications.scheme_id
    JOIN applicants ON applicants.id = applications.applicant_id
    WHERE applications.office_id = ?
    ORDER BY schemes.priority ASC, applications.created_at ASC
  `;

  const localResult = await db.execute({ sql, args: [req.officer.officeId] });
  const externalApplications = await fetchNormalizedRationCards();

  let combined = [];

  for (const application of localResult.rows) {
    combined.push({ ...application, consent_status: null, consent_granted: false });
  }

  for (const external of externalApplications) {
    const applicantResult = await db.execute({
      sql: `
        SELECT applications.id
        FROM applications
        JOIN applicants ON applicants.id = applications.applicant_id
        WHERE applicants.phone = ?
        AND applications.office_id = ?
        LIMIT 1
      `,
      args: [external.phone, req.officer.officeId],
    });

    const localApplication = applicantResult.rows[0];
    if (!localApplication) continue;

    // Look at the MOST RECENT consent request for this application - its
    // status only ever changes when the citizen responds, never here.
    const consentResult = await db.execute({
      sql: `
        SELECT status
        FROM consent_requests
        WHERE application_id = ?
        ORDER BY requested_at DESC
        LIMIT 1
      `,
      args: [localApplication.id],
    });

    const consentStatus = consentResult.rows[0]?.status || 'none'; // none | pending | approved | denied
    const consentGranted = consentStatus === 'approved';

    if (!consentGranted) {
      combined.push({
        id: external.id,
        tracking_id: external.tracking_id,
        applicant_name: external.applicant_name,
        phone: external.phone,
        scheme_name: external.scheme_name,
        priority: external.priority,
        current_stage: external.current_stage,
        created_at: external.created_at,
        source_system: external.source_system,
        consent_status: consentStatus,
        consent_granted: false,
      });
    } else {
      combined.push({ ...external, consent_status: consentStatus, consent_granted: true });
    }
  }

  if (stage) {
    combined = combined.filter((a) => a.current_stage === stage);
  }

  combined.sort((a, b) => {
    if (a.priority !== b.priority) return a.priority - b.priority;
    return new Date(a.created_at) - new Date(b.created_at);
  });

  res.json({ data: combined });
});

// POST /api/v1/officer/applications/:id/consent
// Creates a PENDING consent request. It does NOT grant access itself -
// the citizen must approve it from the client portal (see the new
// GET/POST consent-requests endpoints in public.js) before any external
// data is exposed on the officer dashboard.
router.post('/applications/:id/consent', async (req, res) => {
  const { id } = req.params;

  await ready;

  const applicationResult = await db.execute({
    sql: `SELECT applications.id FROM applications WHERE applications.id = ? AND applications.office_id = ?`,
    args: [id, req.officer.officeId],
  });

  const application = applicationResult.rows[0];
  if (!application) {
    return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Application not found' } });
  }

  // Don't create a duplicate request if one is already pending or approved
  const existingResult = await db.execute({
    sql: `
      SELECT id, status FROM consent_requests
      WHERE application_id = ? AND status IN ('pending', 'approved')
      ORDER BY requested_at DESC LIMIT 1
    `,
    args: [id],
  });
  const existing = existingResult.rows[0];

  if (existing) {
    return res.json({
      data: {
        applicationId: Number(id),
        consentRequestId: existing.id,
        status: existing.status,
        message:
          existing.status === 'approved'
            ? 'Consent already approved.'
            : 'A consent request is already pending the citizen\'s response.',
      },
    });
  }

  const now = new Date().toISOString();
  const insertResult = await db.execute({
    sql: `INSERT INTO consent_requests (application_id, source_system, status, requested_by, requested_at)
          VALUES (?, 'Ration Card System', 'pending', ?, ?)`,
    args: [id, req.officer.username, now],
  });

  await db.execute({
    sql: `INSERT INTO notifications (application_id, type, message, created_at)
          VALUES (?, 'info', 'A request to share your Ration Card System data has been sent. Please respond on your tracking page.', ?)`,
    args: [id, now],
  });

  res.status(201).json({
    data: {
      applicationId: Number(id),
      consentRequestId: Number(insertResult.lastInsertRowid),
      status: 'pending',
      requestedBy: req.officer.username,
      requestedAt: now,
    },
  });
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
    sql: `UPDATE applications SET current_stage = ?, updated_at = ? WHERE id = ?`,
    args: [stage, now, id],
  });

  await db.execute({
    sql: `INSERT INTO status_history (application_id, stage, note, changed_by, changed_at) VALUES (?, ?, ?, ?, ?)`,
    args: [id, stage, note || null, req.officer.username, now],
  });

  await db.execute({
    sql: `INSERT INTO notifications (application_id, type, message, created_at) VALUES (?, 'status_update', ?, ?)`,
    args: [id, `Status changed to "${stage}".${note ? ' ' + note : ''}`, now],
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
    sql: `SELECT id FROM documents WHERE application_id = ? AND doc_name = ?`,
    args: [id, docName],
  });
  const existing = existingResult.rows[0];

  if (existing) {
    await db.execute({
      sql: `UPDATE documents SET status = ?, note = ? WHERE id = ?`,
      args: [status, note || null, existing.id],
    });
  } else {
    await db.execute({
      sql: `INSERT INTO documents (application_id, doc_name, status, note) VALUES (?, ?, ?, ?)`,
      args: [id, docName, status, note || null],
    });
  }

  if (status === 'missing') {
    await db.execute({
      sql: `INSERT INTO notifications (application_id, type, message, created_at) VALUES (?, 'document_missing', ?, ?)`,
      args: [id, `Action needed: "${docName}" is missing. Please submit it to proceed.`, new Date().toISOString()],
    });

    await sendSms(application.phone, `Action needed on application ${application.tracking_id}: "${docName}" is missing. Please submit it to proceed.`);
  }

  res.json({ data: { applicationId: Number(id), docName, status } });
});

// GET /api/v1/officer/applications/:id/history
router.get('/applications/:id/history', async (req, res) => {
  const { id } = req.params;

  await ready;

  const appResult = await db.execute({
    sql: `SELECT id FROM applications WHERE id = ? AND office_id = ?`,
    args: [id, req.officer.officeId],
  });

  if (!appResult.rows[0]) {
    return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Application not found' } });
  }

  const historyResult = await db.execute({
    sql: `SELECT id, stage, note, changed_by, changed_at FROM status_history
          WHERE application_id = ? ORDER BY changed_at ASC, id ASC`,
    args: [id],
  });

  res.json({ data: historyResult.rows });
});

module.exports = router;
