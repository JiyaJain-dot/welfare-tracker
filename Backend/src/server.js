require('dotenv').config();
const express = require('express');
const cors = require('cors');

const authRoutes = require('./routes/auth');
const publicRoutes = require('./routes/public');
const officerRoutes = require('./routes/officer');

const app = express();

// Allow your frontend (web portal) and officer dashboard to call this
// API from the browser. Add your deployed frontend URLs here once your
// teammates have them.
app.use(cors({
  origin: [
    'http://localhost:3000',
    'http://localhost:5173'
  ]
}));

app.use(express.json());

app.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'Welfare tracker API is running' });
});

app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/applications', publicRoutes);
app.use('/api/v1/officer', officerRoutes);

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Something went wrong' } });
});

// Only start a real, continuously-running server when this file is run
// directly (local development: `npm run dev` / `npm start`). When
// Vercel imports this file as a serverless function via api/index.js,
// it calls the exported `app` itself on each request - so app.listen()
// must NOT run in that case, or the deploy will fail.
if (require.main === module) {
  const PORT = process.env.PORT || 4000;
  app.listen(PORT, () => {
    console.log(`Welfare tracker API running at http://localhost:${PORT}`);
  });
}

module.exports = app;
