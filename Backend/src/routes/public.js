const express = require('express');
const db = require('../db');

const router = express.Router();

// GET /api/v1/applications/track/:trackingId
// This is the endpoint the citizen web portal and the SMS webhook both
// call. No login needed - anyone with the tracking ID can check status,
// same as a courier tracking number. We deliberately return only what
// the citizen needs (no full applicant record, no internal officer notes).
router.get('/track/:trackingId', (req, res) => {
  const { trackingId } = req.params;

  const application = db.prepare(`
    SELECT applications.id, applications.tracking_id, applications.current_stage,
           applications.created_at, applications.updated_at,
           schemes.name AS scheme_name,
           applicants.name AS applicant_name
    FROM applications
    JOIN schemes ON schemes.id = applications.scheme_id
    JOIN applicants ON applicants.id = applications.applicant_id
    WHERE applications.tracking_id = ?
  `).get(trackingId);

  if (!application) {
    return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'No application found for this tracking ID' } });
  }

  const timeline = db.prepare(`
    SELECT stage, note, changed_at
    FROM status_history
    WHERE application_id = ?
    ORDER BY changed_at ASC
  `).all(application.id);

  const documents = db.prepare(`
    SELECT doc_name, status, note
    FROM documents
    WHERE application_id = ?
  `).all(application.id);

  const missingDocuments = documents.filter(d => d.status === 'missing');

  res.json({
    data: {
      trackingId: application.tracking_id,
      applicantName: application.applicant_name,
      scheme: application.scheme_name,
      currentStage: application.current_stage,
      submittedAt: application.created_at,
      lastUpdatedAt: application.updated_at,
      timeline,
      documents,
      actionRequired: missingDocuments.length > 0
        ? `Missing document(s): ${missingDocuments.map(d => d.doc_name).join(', ')}. Please submit at your earliest convenience.`
        : null
    }
  });
});

module.exports = router;
