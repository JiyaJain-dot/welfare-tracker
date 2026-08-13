const express = require('express');
const { db, ready } = require('../db');

const router = express.Router();

// GET /api/v1/applications/track/:trackingId
// No login needed - anyone with the tracking ID can check status, same
// as a courier tracking number.
router.get('/track/:trackingId', async (req, res) => {
  const { trackingId } = req.params;
  await ready;

  const appResult = await db.execute({
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
  const application = appResult.rows[0];

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
});

module.exports = router;
