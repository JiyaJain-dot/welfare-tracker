const express = require('express');
const { db, ready } = require('../db');

const router = express.Router();

async function getApplicationByTrackingId(trackingId) {
  const result = await db.execute({
    sql: `SELECT applications.id, applications.tracking_id, applications.current_stage,
                 applications.created_at, applications.updated_at,
                 schemes.name AS scheme_name,
                 applicants.name AS applicant_name
          FROM applications
          JOIN schemes ON schemes.id = applications.scheme_id
          JOIN applicants ON applicants.id = applications.applicant_id
          WHERE applications.tracking_id = ?`,
    args: [trackingId],
  });
  return result.rows[0];
}

async function trackHandler(req, res) {
  const { trackingId } = req.params;
  await ready;

  const application = await getApplicationByTrackingId(trackingId);
  if (!application) {
    return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'No application found for this tracking ID' } });
  }

  const timelineResult = await db.execute({
    sql: `SELECT stage, note, changed_at FROM status_history WHERE application_id = ? ORDER BY changed_at ASC`,
    args: [application.id],
  });

  const documentsResult = await db.execute({
    sql: `SELECT doc_name, status, note FROM documents WHERE application_id = ?`,
    args: [application.id],
  });

  const documents = documentsResult.rows;
  const missingDocuments = documents.filter((d) => d.status === 'missing');

  res.json({
    data: {
      trackingId: application.tracking_id,
      applicantName: application.applicant_name,
      scheme: application.scheme_name,
      currentStage: application.current_stage,
      submittedAt: application.created_at,
      lastUpdatedAt: application.updated_at,
      timeline: timelineResult.rows,
      documents,
      actionRequired:
        missingDocuments.length > 0
          ? `Missing document(s): ${missingDocuments.map((d) => d.doc_name).join(', ')}. Please submit at your earliest convenience.`
          : null,
    },
  });
}

async function notificationsHandler(req, res) {
  const { trackingId } = req.params;
  await ready;

  const application = await getApplicationByTrackingId(trackingId);
  if (!application) {
    return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'No application found for this tracking ID' } });
  }

  const notificationsResult = await db.execute({
    sql: `SELECT type, message, created_at FROM notifications WHERE application_id = ? ORDER BY created_at DESC`,
    args: [application.id],
  });

  res.json({ data: notificationsResult.rows });
}

// GET /api/v1/applications/track/:trackingId
router.get('/track/:trackingId', trackHandler);

// GET /api/v1/applications/notifications/:trackingId
router.get('/notifications/:trackingId', notificationsHandler);

// GET /api/v1/applications/:trackingId/consent-requests
// Citizen-facing: shows any PENDING requests from connected external
// systems (e.g. Ration Card System) asking to share their data into
// this application. This is the missing "citizen in the loop" step -
// nothing gets shared until the citizen responds via the endpoint below.
router.get('/:trackingId/consent-requests', async (req, res) => {
  const { trackingId } = req.params;
  await ready;

  const application = await getApplicationByTrackingId(trackingId);
  if (!application) {
    return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'No application found for this tracking ID' } });
  }

  const result = await db.execute({
    sql: `SELECT id, source_system, status, requested_at
          FROM consent_requests
          WHERE application_id = ? AND status = 'pending'
          ORDER BY requested_at DESC`,
    args: [application.id],
  });

  res.json({ data: result.rows });
});

// POST /api/v1/applications/:trackingId/consent-requests/:id/respond
// body: { approved: true | false }
// This is the ONLY place consent_status can move from 'pending' to
// 'approved' or 'denied' - officers can request, only the citizen can decide.
router.post('/:trackingId/consent-requests/:id/respond', async (req, res) => {
  const { trackingId, id } = req.params;
  const { approved } = req.body;

  if (typeof approved !== 'boolean') {
    return res.status(400).json({ error: { code: 'MISSING_FIELDS', message: 'approved (true or false) is required' } });
  }

  await ready;

  const application = await getApplicationByTrackingId(trackingId);
  if (!application) {
    return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'No application found for this tracking ID' } });
  }

  const requestResult = await db.execute({
    sql: `SELECT id, status FROM consent_requests WHERE id = ? AND application_id = ?`,
    args: [id, application.id],
  });
  const request = requestResult.rows[0];

  if (!request) {
    return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Consent request not found' } });
  }
  if (request.status !== 'pending') {
    return res.status(409).json({ error: { code: 'ALREADY_RESPONDED', message: `This request was already ${request.status}.` } });
  }

  const now = new Date().toISOString();
  const newStatus = approved ? 'approved' : 'denied';

  await db.execute({
    sql: `UPDATE consent_requests SET status = ?, responded_at = ? WHERE id = ?`,
    args: [newStatus, now, id],
  });

  res.json({ data: { consentRequestId: Number(id), status: newStatus, respondedAt: now } });
});

module.exports = router;
module.exports.trackHandler = trackHandler;
module.exports.notificationsHandler = notificationsHandler;
