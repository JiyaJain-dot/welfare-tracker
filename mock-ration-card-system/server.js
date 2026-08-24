const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors()); // open for demo purposes - simulates a public inter-department API
app.use(express.json());

// Dummy in-memory "Ration Card System" data. Field names are deliberately
// DIFFERENT from our own schema (card_id instead of tracking_id,
// applicant_full_name instead of name, etc.) - this mismatch is the whole
// point: it simulates a real, independently-built government system that
// our connector has to normalize, not just relabel.
const rationCards = [
  {
    card_id: 'RC-2026-0001',
    applicant_full_name: 'Ramesh Kumar (test)',
    phone_number: '9999999999',
    card_status: 'Issued',
    submission_date: '2026-07-01T00:00:00.000Z',
    address_line: 'Test Village, Test District',
  },
  {
    card_id: 'RC-2026-0002',
    applicant_full_name: 'Lakshmi Devi (test)',
    phone_number: '9888888888',
    card_status: 'Under Verification',
    submission_date: '2026-08-05T00:00:00.000Z',
    address_line: 'Test Village, Test District',
  },
  {
    card_id: 'RC-2026-0003',
    applicant_full_name: 'Suresh Babu (test)',
    phone_number: '9777777777',
    card_status: 'Pending',
    submission_date: '2026-08-12T00:00:00.000Z',
    address_line: 'Test Village, Test District',
  },
];

app.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'Ration Card System (mock external department) is running' });
});

// GET /api/ration-cards?phone=9999999999
app.get('/api/ration-cards', (req, res) => {
  const { phone } = req.query;
  const results = phone ? rationCards.filter((c) => c.phone_number === phone) : rationCards;
  res.json({ data: results });
});

app.get('/api/ration-cards/:cardId', (req, res) => {
  const card = rationCards.find((c) => c.card_id === req.params.cardId);
  if (!card) {
    return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Ration card record not found' } });
  }
  res.json({ data: card });
});

if (require.main === module) {
  const PORT = process.env.PORT || 4001;
  app.listen(PORT, () => {
    console.log(`Ration Card mock system running at http://localhost:${PORT}`);
  });
}

module.exports = app;
