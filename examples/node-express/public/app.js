const textInput = document.querySelector('#text');
const speedInput = document.querySelector('#speed');
const speedValue = document.querySelector('#speed-value');
const generateButton = document.querySelector('#generate');
const statusText = document.querySelector('#status');
const cacheText = document.querySelector('#cache');
const busy = document.querySelector('#busy');
const audio = document.querySelector('#audio');
const reader = document.querySelector('#reader');
const durationText = document.querySelector('#duration');
const wordsText = document.querySelector('#words');

let currentAudioUrl = '';

checkCache();

speedInput.addEventListener('input', () => {
  speedValue.textContent = `${Number(speedInput.value).toFixed(2)}x`;
});

generateButton.addEventListener('click', async () => {
  setBusy(true);
  setStatus('Generating on backend');
  await waitForPaint();

  try {
    const response = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: textInput.value,
        speed: Number(speedInput.value),
      }),
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || 'Generation failed.');

    setAudio(payload.audioBase64, payload.mimeType);
    renderTimings(payload.wordTimings || []);
    durationText.textContent = `${Number(payload.duration || 0).toFixed(2)}s`;
    wordsText.textContent = String(payload.wordTimings?.length || 0);
    setStatus('Generated');
    await audio.play();
  } catch (error) {
    setStatus(error instanceof Error ? error.message : String(error));
  } finally {
    setBusy(false);
  }
});

async function checkCache() {
  try {
    const response = await fetch('/api/cache');
    const info = await response.json();
    if (!response.ok) throw new Error(info.error || 'Cache check failed.');
    cacheText.textContent = info.isCached ? 'Cached' : 'Not cached';
  } catch (error) {
    cacheText.textContent = error instanceof Error ? error.message : String(error);
  }
}

function setAudio(audioBase64, mimeType) {
  if (currentAudioUrl) URL.revokeObjectURL(currentAudioUrl);
  const bytes = Uint8Array.from(atob(audioBase64), (char) => char.charCodeAt(0));
  const blob = new Blob([bytes], { type: mimeType || 'audio/wav' });
  currentAudioUrl = URL.createObjectURL(blob);
  audio.src = currentAudioUrl;
}

function renderTimings(wordTimings) {
  reader.replaceChildren();
  if (wordTimings.length === 0) {
    reader.textContent = 'No word timings returned.';
    return;
  }

  for (const timing of wordTimings) {
    const word = document.createElement('span');
    word.textContent = timing.word;
    word.title = `${timing.startTime.toFixed(2)}s - ${timing.endTime.toFixed(2)}s`;
    reader.append(word);
  }
}

function setBusy(isBusy) {
  busy.hidden = !isBusy;
  generateButton.disabled = isBusy;
}

function setStatus(message) {
  statusText.textContent = message;
}

function waitForPaint() {
  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      setTimeout(resolve, 0);
    });
  });
}
