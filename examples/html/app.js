const {
  ALL_VOICE_IDS,
  KittenTTS,
  KittenTTSResult,
  createBrowserAudioPlayer,
  MemoryAssetStorage,
  modelDisplayName,
  voiceDisplayName,
} = window.KittenTTSWeb;

const modelOptions = [
  'nano-int8',
  'nano',
  'micro',
  'mini',
];

const elements = {
  initializeButton: document.querySelector('#initialize-button'),
  generateButton: document.querySelector('#generate-button'),
  speakButton: document.querySelector('#speak-button'),
  stopButton: document.querySelector('#stop-button'),
  downloadButton: document.querySelector('#download-button'),
  downloadFormatInputs: document.querySelectorAll('input[name="download-format"]'),
  modelSelect: document.querySelector('#model-select'),
  voiceSelect: document.querySelector('#voice-select'),
  pitchSelect: document.querySelector('#pitch-select'),
  speedInput: document.querySelector('#speed-input'),
  speedValue: document.querySelector('#speed-value'),
  textInput: document.querySelector('#text-input'),
  status: document.querySelector('#status'),
  cacheStatus: document.querySelector('#cache-status'),
  busyPanel: document.querySelector('#busy-panel'),
  busyLabel: document.querySelector('#busy-label'),
  progressFill: document.querySelector('#progress-fill'),
  progressLabel: document.querySelector('#progress-label'),
  resultPanel: document.querySelector('#result-panel'),
  durationValue: document.querySelector('#duration-value'),
  sampleRateValue: document.querySelector('#sample-rate-value'),
  wordTimingsValue: document.querySelector('#word-timings-value'),
};

const player = createBrowserAudioPlayer();
const assetStorage =
  window.location.protocol === 'file:' ? new MemoryAssetStorage() : undefined;
let tts = null;
let result = null;
let objectUrl = null;
let isReady = false;
let isBusy = false;
let cacheCheckId = 0;

for (const model of modelOptions) {
  elements.modelSelect.append(new Option(modelDisplayName(model), model));
}

for (const voice of ALL_VOICE_IDS) {
  elements.voiceSelect.append(new Option(voiceDisplayName(voice), voice));
}

elements.modelSelect.value = 'nano-int8';
elements.voiceSelect.value = 'bella';

elements.initializeButton.addEventListener('click', initialize);
elements.generateButton.addEventListener('click', generate);
elements.speakButton.addEventListener('click', speak);
elements.stopButton.addEventListener('click', stop);
elements.downloadButton.addEventListener('click', downloadAudio);
elements.modelSelect.addEventListener('change', () => {
  resetEngine();
  checkCache();
});
elements.voiceSelect.addEventListener('change', clearGeneratedResult);
elements.speedInput.addEventListener('input', () => {
  elements.speedValue.textContent = `${speed().toFixed(2)}x`;
  clearGeneratedResult();
});
elements.pitchSelect.addEventListener('change', updateResultMetrics);
elements.textInput.addEventListener('input', clearGeneratedResult);

window.addEventListener('beforeunload', () => {
  tts?.dispose();
  revokeObjectUrl();
});

checkCache();
setControls();

async function initialize() {
  setBusy(true, 'Preparing model and phonemizer');
  setStatus('Initializing');
  setProgress(0);
  setResult(null);
  await waitForPaint();

  try {
    await tts?.dispose();
    tts = await KittenTTS.create(
      {
        model: model(),
        defaultVoice: voice(),
        speed: speed(),
        player,
        ...(assetStorage ? { storage: assetStorage } : {}),
      },
      (nextProgress, info) => {
        setProgress(nextProgress, info);
      },
    );
    isReady = true;
    elements.cacheStatus.textContent = 'Cached';
    setStatus('Ready');
  } catch (error) {
    isReady = false;
    setStatus(error instanceof Error ? error.message : String(error));
  } finally {
    setBusy(false);
  }
}

async function generate() {
  if (!tts) return;

  setBusy(true, 'Generating audio');
  setStatus('Generating');
  await waitForPaint();

  try {
    setResult(await tts.generate(text(), { voice: voice(), speed: speed() }));
    setStatus('Generated');
  } catch (error) {
    setStatus(error instanceof Error ? error.message : String(error));
  } finally {
    setBusy(false);
  }
}

async function ensureGenerated() {
  if (!tts) {
    await initialize();
    if (!tts) return false;
  }

  if (result) return true;

  setBusy(true, 'Generating audio');
  setStatus('Generating');
  await waitForPaint();

  try {
    setResult(await tts.generate(text(), { voice: voice(), speed: speed() }));
    setStatus('Generated');
    return true;
  } catch (error) {
    setStatus(error instanceof Error ? error.message : String(error));
    return false;
  } finally {
    setBusy(false);
  }
}

async function speak() {
  const hasAudio = await ensureGenerated();
  if (!hasAudio || !tts || !result) return;

  setBusy(true, 'Playing audio');
  setStatus('Speaking');
  await waitForPaint();

  try {
    await tts.play(pitchedResult(result));
    setStatus('Done');
  } catch (error) {
    setStatus(error instanceof Error ? error.message : String(error));
  } finally {
    setBusy(false);
  }
}

async function stop() {
  await tts?.stopSpeaking();
  setStatus(isReady ? 'Ready' : 'Idle');
}

async function checkCache() {
  const checkId = ++cacheCheckId;
  elements.cacheStatus.textContent = 'Checking';

  try {
    const info = await withTimeout(
      KittenTTS.cacheInfo({
        model: model(),
        ...(assetStorage ? { storage: assetStorage } : {}),
      }),
      3000,
      'Cache status unavailable',
    );
    if (checkId !== cacheCheckId) return;
    elements.cacheStatus.textContent = info.isCached ? 'Cached' : 'Not cached';
  } catch (error) {
    if (checkId !== cacheCheckId) return;
    elements.cacheStatus.textContent = error instanceof Error ? error.message : String(error);
  }
}

async function downloadAudio() {
  const format = downloadFormat();
  const hasAudio = await ensureGenerated();
  if (!hasAudio || !result) return;

  setBusy(true, `Preparing ${format.toUpperCase()} download`);
  setStatus('Preparing download');
  await waitForPaint();

  try {
    revokeObjectUrl();
    const audioResult = pitchedResult(result);
    const isMp3 = format === 'mp3';
    const bytes = isMp3 ? await audioResult.mp3Data({ bitRate: 128 }) : audioResult.wavData();
    const blob = new Blob([toArrayBuffer(bytes)], {
      type: isMp3 ? 'audio/mpeg' : 'audio/wav',
    });
    objectUrl = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = `kittentts-output.${format}`;
    link.style.display = 'none';
    document.body.append(link);
    link.click();
    link.remove();
    setStatus('Download ready');
  } catch (error) {
    setStatus(error instanceof Error ? error.message : String(error));
  } finally {
    setBusy(false);
  }
}

function setBusy(nextBusy, label = '') {
  isBusy = nextBusy;
  elements.busyPanel.classList.toggle('is-visible', nextBusy);
  elements.busyLabel.textContent = label;
  setControls();
}

function setControls() {
  elements.initializeButton.disabled = isBusy;
  elements.generateButton.disabled = !isReady || isBusy;
  elements.speakButton.disabled = isBusy;
  elements.downloadButton.disabled = isBusy;
  elements.downloadFormatInputs.forEach((input) => {
    input.disabled = isBusy;
  });
  elements.stopButton.disabled = !isReady;
}

function setProgress(progress, info = null) {
  const percent = Math.round(progress * 100);
  const parts = [`${percent}%`];

  if (info?.asset) parts.push(info.asset);
  if (info?.stage) parts.push(info.stage);

  elements.progressFill.style.width = `${percent}%`;
  elements.progressLabel.textContent = parts.join(' ');

  if (info?.stage === 'downloading' || info?.stage === 'retrying') {
    elements.cacheStatus.textContent = `Downloading (${percent}%)`;
  } else if (info?.stage === 'checking-cache') {
    elements.cacheStatus.textContent = 'Checking';
  } else if (info?.stage === 'complete' || info?.stage === 'cached') {
    elements.cacheStatus.textContent = 'Cached';
  }
}

function setResult(nextResult) {
  result = nextResult;
  elements.resultPanel.classList.toggle('is-visible', Boolean(result));
  updateResultMetrics();
}

function updateResultMetrics() {
  if (!result) return;

  const audioResult = pitchedResult(result);
  elements.durationValue.textContent = `${audioResult.duration.toFixed(2)}s`;
  elements.sampleRateValue.textContent = `${audioResult.sampleRate.toLocaleString()} Hz`;
  elements.wordTimingsValue.textContent = String(result.wordTimings.length);
}

function setStatus(status) {
  elements.status.textContent = status;
}

function resetEngine() {
  tts?.dispose().catch(() => {});
  tts = null;
  isReady = false;
  clearGeneratedResult();
  setStatus('Idle');
  setControls();
}

function clearGeneratedResult() {
  setResult(null);
  revokeObjectUrl();
}

function model() {
  return elements.modelSelect.value;
}

function voice() {
  return elements.voiceSelect.value;
}

function speed() {
  return Number(elements.speedInput.value);
}

function pitchRatio() {
  return Math.max(0.25, 1 + Number(elements.pitchSelect.value) / 100);
}

function pitchedResult(sourceResult) {
  const ratio = pitchRatio();
  if (Math.abs(ratio - 1) < 0.001) return sourceResult;

  return new KittenTTSResult(
    resampleForPitch(sourceResult.samples, ratio),
    sourceResult.sampleRate,
    sourceResult.voice,
    sourceResult.effectiveSpeed,
    sourceResult.inputText,
    sourceResult.wordTimings.map((timing) => ({
      ...timing,
      startTime: timing.startTime / ratio,
      endTime: timing.endTime / ratio,
    })),
  );
}

function resampleForPitch(samples, ratio) {
  const nextLength = Math.max(1, Math.floor(samples.length / ratio));
  const nextSamples = new Float32Array(nextLength);

  for (let index = 0; index < nextLength; index += 1) {
    const sourceIndex = index * ratio;
    const leftIndex = Math.floor(sourceIndex);
    const rightIndex = Math.min(leftIndex + 1, samples.length - 1);
    const mix = sourceIndex - leftIndex;
    nextSamples[index] = samples[leftIndex] * (1 - mix) + samples[rightIndex] * mix;
  }

  return nextSamples;
}

function downloadFormat() {
  return document.querySelector('input[name="download-format"]:checked')?.value ?? 'wav';
}

function text() {
  return elements.textInput.value;
}

function revokeObjectUrl() {
  if (objectUrl) URL.revokeObjectURL(objectUrl);
  objectUrl = null;
}

function toArrayBuffer(bytes) {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
}

function withTimeout(promise, timeoutMs, message) {
  let timeoutId;
  const timeout = new Promise((_, reject) => {
    timeoutId = window.setTimeout(() => reject(new Error(message)), timeoutMs);
  });

  return Promise.race([promise, timeout]).finally(() => {
    window.clearTimeout(timeoutId);
  });
}

function waitForPaint() {
  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      setTimeout(resolve, 0);
    });
  });
}
