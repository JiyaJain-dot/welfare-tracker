// Vercel treats every file inside /api as its own serverless function.
// This one just re-exports your whole Express app, and vercel.json
// routes every incoming request to it - so all your existing routes
// (/api/v1/auth, /api/v1/applications, /api/v1/officer) keep working
// exactly as they do locally, without you needing to restructure them.
module.exports = require('../src/server');
