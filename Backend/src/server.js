require('dotenv').config();
const express = require('express');
const cors = require('cors');

require('./db'); // creates tables if they don't exist yet

const authRoutes = require('./routes/auth');
const publicRoutes = require('./routes/public');
const officerRoutes = require('./routes/officer');

const app = express();

// Allow your frontend (web portal) and officer dashboard dev servers to
// call this API from the browser. Add your real domains here later too.
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

// Catch-all error handler so the server never crashes silently on a bad request
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Something went wrong' } });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Welfare tracker API running at http://localhost:${PORT}`);
});
