const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { db, ready } = require('../db');

const router = express.Router();

// POST /api/v1/auth/login
// body: { username, password }
router.post('/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: { code: 'MISSING_FIELDS', message: 'Username and password are required' } });
  }

  await ready;
  const result = await db.execute({
    sql: 'SELECT * FROM officers WHERE username = ?',
    args: [username],
  });
  const officer = result.rows[0];

  if (!officer) {
    return res.status(401).json({ error: { code: 'INVALID_CREDENTIALS', message: 'Invalid username or password' } });
  }

  const valid = bcrypt.compareSync(password, officer.password_hash);
  if (!valid) {
    return res.status(401).json({ error: { code: 'INVALID_CREDENTIALS', message: 'Invalid username or password' } });
  }

  const token = jwt.sign(
    { id: officer.id, username: officer.username, officeId: officer.office_id },
    process.env.JWT_SECRET,
    { expiresIn: '8h' }
  );

  res.json({ data: { token, officer: { id: officer.id, name: officer.name, username: officer.username } } });
});

module.exports = router;
