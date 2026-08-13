const jwt = require('jsonwebtoken');

// Any route using this middleware requires a valid officer login token.
// The frontend sends it as: Authorization: Bearer <token>
function requireOfficer(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: { code: 'NO_TOKEN', message: 'Login required' } });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.officer = payload; // { id, username, officeId }
    next();
  } catch (err) {
    return res.status(401).json({ error: { code: 'INVALID_TOKEN', message: 'Session expired, please log in again' } });
  }
}

module.exports = { requireOfficer };
