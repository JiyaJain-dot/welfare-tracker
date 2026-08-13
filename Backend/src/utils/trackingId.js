const { customAlphabet } = require('nanoid');

// Only uppercase letters and digits, no ambiguous characters (0/O, 1/I),
// so a citizen reading it aloud over the phone or typing it into an SMS
// is unlikely to make a mistake.
const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const nanoid = customAlphabet(alphabet, 8);

function generateTrackingId() {
  return `WLF-${nanoid()}`;
}

module.exports = { generateTrackingId };
