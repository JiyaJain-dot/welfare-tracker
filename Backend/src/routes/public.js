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

// Shared handler - used by both /track/:trackingId and the /tracker
// alias your frontend team is building against.
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

// Notifications for a tracking ID - separate from the timeline, meant
// for a "bell icon" / notifications list UI on the client dashboard.
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

module.exports = router;
module.exports.trackHandler = trackHandler;
module.exports.notificationsHandler = notificationsHandler;
