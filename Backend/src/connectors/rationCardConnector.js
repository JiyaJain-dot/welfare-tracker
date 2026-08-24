// Talks to the separate "Ration Card System" (a different department's
// system) and normalizes its differently-shaped data into our own
// internal schema. Every future connector we add follows this same
// pattern: fetch external -> normalize field names/values -> tag with
// source_system -> merge into our unified view.
const RATION_CARD_STATUS_MAP = {
  Pending: 'submitted',
  'Under Verification': 'verification',
  Issued: 'approved',
};

function normalizeStatus(externalStatus) {
  return RATION_CARD_STATUS_MAP[externalStatus] || 'submitted';
}

async function fetchNormalizedRationCards() {
  const baseUrl = process.env.RATION_CARD_API_URL;
  if (!baseUrl) {
    console.warn('RATION_CARD_API_URL not set - skipping Ration Card System connector');
    return [];
  }

  try {
    const res = await fetch(`${baseUrl}/api/ration-cards`);
    if (!res.ok) throw new Error(`Ration Card API returned ${res.status}`);
    const { data } = await res.json();

    return data.map((record) => ({
      id: `ration-${record.card_id}`,
      tracking_id: record.card_id,
      applicant_name: record.applicant_full_name,
      phone: record.phone_number,
      scheme_name: 'Ration card benefit',
      priority: 4, // matches the priority tier of our own "Ration card benefit" scheme
      current_stage: normalizeStatus(record.card_status),
      created_at: record.submission_date,
      source_system: 'Ration Card System',
    }));
  } catch (err) {
    // Fail open: if the external department's system is down, our own
    // dashboard should still work - just without their data for now.
    console.error('Ration Card connector failed:', err.message);
    return [];
  }
}

module.exports = { fetchNormalizedRationCards };
