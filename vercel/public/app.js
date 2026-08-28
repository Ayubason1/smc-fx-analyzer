const htfInput = document.getElementById('htfInput');
const ltfInput = document.getElementById('ltfInput');
const htfPreview = document.getElementById('htfPreview');
const ltfPreview = document.getElementById('ltfPreview');
const analyzeBtn = document.getElementById('analyzeBtn');
const statusMsg = document.getElementById('statusMsg');
const resultsEl = document.getElementById('results');
const pairInput = document.getElementById('pairInput');
const noteInput = document.getElementById('noteInput');

const settingsDialog = document.getElementById('settingsDialog');
const settingsBtn = document.getElementById('settingsBtn');
const apiKeyInput = document.getElementById('apiKeyInput');

let htfFile = null;
let ltfFile = null;

// ---- Register service worker ----
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/service-worker.js'));
}

// ---- Settings (API key stored locally on-device only) ----
apiKeyInput.value = localStorage.getItem('anthropicApiKey') || '';
settingsBtn.addEventListener('click', () => settingsDialog.showModal());
settingsDialog.addEventListener('close', () => {
  if (settingsDialog.returnValue === 'default') {
    localStorage.setItem('anthropicApiKey', apiKeyInput.value.trim());
  }
});

// Prompt for API key on first load if missing
if (!localStorage.getItem('anthropicApiKey')) {
  setTimeout(() => settingsDialog.showModal(), 400);
}

// ---- Image handling ----
// Screenshots straight from a phone camera/gallery can be several MB each.
// Resize + re-encode client-side before upload — keeps requests fast and
// safely under hosting limits (e.g. Vercel's 4.5MB request body cap).
function compressImage(file, maxDim = 1600, quality = 0.82) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      let { width, height } = img;
      if (width > maxDim || height > maxDim) {
        const scale = maxDim / Math.max(width, height);
        width = Math.round(width * scale);
        height = Math.round(height * scale);
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      canvas.getContext('2d').drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => {
          URL.revokeObjectURL(url);
          if (!blob) return reject(new Error('Compression failed'));
          resolve(new File([blob], file.name.replace(/\.\w+$/, '.jpg'), { type: 'image/jpeg' }));
        },
        'image/jpeg',
        quality
      );
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Could not read image')); };
    img.src = url;
  });
}

function handleFile(input, previewEl, setFile) {
  input.addEventListener('change', async () => {
    const raw = input.files[0];
    if (!raw) return;
    const emptyLabel = previewEl.parentElement.querySelector('.drop-empty');
    if (emptyLabel) emptyLabel.textContent = 'Processing…';
    try {
      const file = await compressImage(raw);
      setFile(file);
      const url = URL.createObjectURL(file);
      previewEl.src = url;
      previewEl.hidden = false;
      if (emptyLabel) emptyLabel.style.display = 'none';
    } catch (e) {
      console.error(e);
      setFile(raw); // fall back to original if compression fails
      const url = URL.createObjectURL(raw);
      previewEl.src = url;
      previewEl.hidden = false;
      if (emptyLabel) emptyLabel.style.display = 'none';
    }
    updateAnalyzeState();
  });
}

handleFile(htfInput, htfPreview, (f) => (htfFile = f));
handleFile(ltfInput, ltfPreview, (f) => (ltfFile = f));

function updateAnalyzeState() {
  analyzeBtn.disabled = !(htfFile && ltfFile);
}

// ---- Analyze ----
analyzeBtn.addEventListener('click', async () => {
  const apiKey = localStorage.getItem('anthropicApiKey');
  if (!apiKey) {
    settingsDialog.showModal();
    return;
  }

  analyzeBtn.disabled = true;
  statusMsg.textContent = 'Reading market structure…';
  resultsEl.hidden = true;

  const formData = new FormData();
  formData.append('htf', htfFile);
  formData.append('ltf', ltfFile);
  formData.append('pair', pairInput.value);
  formData.append('note', noteInput.value);

  try {
    const res = await fetch('/api/analyze', {
      method: 'POST',
      headers: { 'x-anthropic-key': apiKey },
      body: formData
    });
    const data = await res.json();

    if (!res.ok) {
      statusMsg.textContent = data.error || 'Analysis failed.';
      analyzeBtn.disabled = false;
      return;
    }

    renderResults(data.analysis);
    statusMsg.textContent = '';
  } catch (err) {
    console.error(err);
    statusMsg.textContent = 'Network error — check your connection and try again.';
  } finally {
    analyzeBtn.disabled = false;
  }
});

function biasBadgeClass(bias) {
  if (bias === 'bullish') return 'badge-bullish';
  if (bias === 'bearish') return 'badge-bearish';
  return 'badge-neutral';
}

function renderResults(a) {
  const biasBadge = document.getElementById('biasBadge');
  const recBadge = document.getElementById('recBadge');
  const confBadge = document.getElementById('confBadge');

  biasBadge.textContent = `HTF: ${(a.htf_bias || 'n/a').toUpperCase()}`;
  biasBadge.className = `badge ${biasBadgeClass(a.htf_bias)}`;

  recBadge.textContent = a.trade_recommendation || 'NO_TRADE';
  recBadge.className = `badge ${a.trade_recommendation === 'LONG' ? 'badge-bullish' : a.trade_recommendation === 'SHORT' ? 'badge-bearish' : 'badge-neutral'}`;

  confBadge.textContent = `Confidence: ${a.confidence || 'n/a'}`;

  document.getElementById('htfNotes').textContent = a.htf_notes || '—';
  document.getElementById('ltfSetup').textContent = a.ltf_setup || '—';
  document.getElementById('entryVal').textContent = a.entry_zone || '—';
  document.getElementById('slVal').textContent = a.stop_loss || '—';
  document.getElementById('tp1Val').textContent = a.take_profit_1 || '—';
  document.getElementById('tp2Val').textContent = a.take_profit_2 || '—';
  document.getElementById('rrVal').textContent = a.risk_reward_estimate || '—';
  document.getElementById('invalText').textContent = a.invalidation || '—';
  document.getElementById('disclaimerText').textContent = a.disclaimer || 'This is an automated technical read, not financial advice.';

  resultsEl.hidden = false;
  resultsEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
