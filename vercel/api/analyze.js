const { formidable } = require('formidable');
const fs = require('fs');
const { callClaude } = require('../lib/smc-prompt');

module.exports.config = {
  api: { bodyParser: false }
};

function first(v) {
  return Array.isArray(v) ? v[0] : v;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const apiKey = req.headers['x-anthropic-key'];
    if (!apiKey) {
      res.status(400).json({ error: 'Missing Anthropic API key. Add it in Settings first.' });
      return;
    }

    // Vercel Functions cap the request body at 4.5MB total, so images must already
    // be compressed client-side (the app does this before upload).
    const form = formidable({ maxFileSize: 4 * 1024 * 1024 });
    const [fields, files] = await form.parse(req);

    const htfFile = first(files.htf);
    const ltfFile = first(files.ltf);
    if (!htfFile || !ltfFile) {
      res.status(400).json({ error: 'Both a higher-timeframe and lower-timeframe chart image are required.' });
      return;
    }

    const pair = (first(fields.pair) || '').trim();
    const userNote = (first(fields.note) || '').trim();

    const analysis = await callClaude({
      apiKey,
      pair,
      userNote,
      htfB64: fs.readFileSync(htfFile.filepath).toString('base64'),
      htfMime: htfFile.mimetype || 'image/jpeg',
      ltfB64: fs.readFileSync(ltfFile.filepath).toString('base64'),
      ltfMime: ltfFile.mimetype || 'image/jpeg'
    });

    res.status(200).json({ analysis });
  } catch (err) {
    console.error(err);
    res.status(err.status || 500).json({ error: err.message || 'Server error while analyzing charts.' });
  }
};
