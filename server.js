require('dotenv').config();
const express = require('express');
const multer = require('multer');
const path = require('path');
const basicAuth = require('express-basic-auth');

const app = express();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

const { callClaude } = require('./lib/smc-prompt');

const PORT = process.env.PORT || 3000;

// ---- Optional basic-auth gate for the whole app (recommended once deployed live) ----
if (process.env.APP_USER && process.env.APP_PASSWORD) {
  app.use(basicAuth({
    users: { [process.env.APP_USER]: process.env.APP_PASSWORD },
    challenge: true,
    realm: 'SMC FX Analyzer'
  }));
}

app.use(express.json({ limit: '2mb' }));
app.use(express.static(path.join(__dirname, 'public')));

app.post('/api/analyze', upload.fields([{ name: 'htf', maxCount: 1 }, { name: 'ltf', maxCount: 1 }]), async (req, res) => {
  try {
    const apiKey = req.header('x-anthropic-key');
    if (!apiKey) {
      return res.status(400).json({ error: 'Missing Anthropic API key. Add it in Settings first.' });
    }
    const htfFile = req.files?.htf?.[0];
    const ltfFile = req.files?.ltf?.[0];
    if (!htfFile || !ltfFile) {
      return res.status(400).json({ error: 'Both a higher-timeframe and lower-timeframe chart image are required.' });
    }

    const analysis = await callClaude({
      apiKey,
      pair: req.body.pair || '',
      userNote: req.body.note || '',
      htfB64: htfFile.buffer.toString('base64'),
      htfMime: htfFile.mimetype,
      ltfB64: ltfFile.buffer.toString('base64'),
      ltfMime: ltfFile.mimetype
    });

    res.json({ analysis });
  } catch (err) {
    console.error(err);
    res.status(err.status || 500).json({ error: err.message || 'Server error while analyzing charts.' });
  }
});

app.listen(PORT, () => {
  console.log(`SMC FX Analyzer running on port ${PORT}`);
});
