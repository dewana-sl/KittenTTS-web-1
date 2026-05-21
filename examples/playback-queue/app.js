const {
  ALL_VOICE_IDS,
  KittenTTS,
  MemoryAssetStorage,
  createBrowserAudioPlayer,
  modelDisplayName,
  voiceDisplayName,
} = window.KittenTTSWeb;

const modelOptions = ['nano-int8', 'nano', 'micro', 'mini'];

const elements = {
  modelSelect: document.querySelector('#model-select'),
  voiceSelect: document.querySelector('#voice-select'),
  speedSelect: document.querySelector('#speed-select'),
  queueButton: document.querySelector('#queue-button'),
  stopButton: document.querySelector('#stop-button'),
  status: document.querySelector('#status'),
  progressLabel: document.querySelector('#progress-label'),
  progressFill: document.querySelector('#progress-fill'),
  cacheStatus: document.querySelector('#cache-status'),
  busyPanel: document.querySelector('#busy-panel'),
  busyLabel: document.querySelector('#busy-label'),
  pendingCount: document.querySelector('#pending-count'),
  playingState: document.querySelector('#playing-state'),
  completedCount: document.querySelector('#completed-count'),
  queueLog: document.querySelector('#queue-log'),
  clips: [
    document.querySelector('#clip-1'),
    document.querySelector('#clip-2'),
    document.querySelector('#clip-3'),
  ],
};

const assetStorage =
  window.location.protocol === 'file:' ? new MemoryAssetStorage() : undefined;
const player = createBrowserAudioPlayer();

let tts = null;
let queue = null;
let busy = false;
let completed = 0;
let cacheCheckId = 0;
let pollId = null;

for (const model of modelOptions) {
  elements.modelSelect.append(new Option(modelDisplayName(model), model));
}

for (const voice of ALL_VOICE_IDS) {
  elements.voiceSelect.append(new Option(voiceDisplayName(voice), voice));
}

elements.modelSelect.value = 'nano-int8';
elements.voiceSelect.value = 'bella';
elements.queueButton.addEventListener('click', queueClips);
elements.stopButton.addEventListener('click', stopQueue);
elements.modelSelect.addEventListener('change', async () => {
  await resetEngine();
  checkCache();
});

window.addEventListener('beforeunload', () => {
  stopPolling();
  tts?.dispose();
});

checkCache();
setControls();

async function queueClips() {
  const clips = elements.clips
    .map((clip) => clip.value.trim())
    .filter(Boolean);
  if (clips.length === 0) {
    setStatus('Add at least one clip');
    return;
  }

  clearLog();
  completed = 0;
  setBusy(true, 'Preparing queue');
  setStatus('Preparing');
  setProgress(0);
  await waitForPaint();

  try {
    const instance = await ensureTTS();
    queue = instance.createPlaybackQueue();
    refreshQueueState();
    startPolling();

    const jobs = clips.map((clip, index) =>
      queue.enqueueText(clip, {
        voice: voice(),
        speed: speed(),
        onPlaybackStart: () => {
          log(`Playing clip ${index + 1}`);
          refreshQueueState();
        },
      }).then((result) => {
        completed += 1;
        log(`Finished clip ${index + 1} (${result.duration.toFixed(2)}s)`);
        refreshQueueState();
        return result;
      }),
    );

    setBusy(false);
    setStatus('Queue running');
    refreshQueueState();

    await Promise.all(jobs);
    setStatus('Queue complete');
  } catch (error) {
    setStatus(error instanceof Error ? error.message : String(error));
  } finally {
    setBusy(false);
    stopPolling();
    refreshQueueState();
  }
}

async function ensureTTS() {
  if (tts) return tts;

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
  elements.cacheStatus.textContent = 'Cached';
  return tts;
}

async function stopQueue() {
  await queue?.stop();
  stopPolling();
  setStatus('Stopped');
  refreshQueueState();
}

async function resetEngine() {
  await queue?.stop().catch(() => {});
  queue = null;
  await tts?.dispose();
  tts = null;
  completed = 0;
  setStatus('Idle');
  refreshQueueState();
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

function setBusy(nextBusy, label = '') {
  busy = nextBusy;
  elements.busyPanel.classList.toggle('is-visible', nextBusy);
  elements.busyLabel.textContent = label;
  setControls();
}

function setControls() {
  elements.queueButton.disabled = busy;
  elements.stopButton.disabled = busy || !queue || queue.length === 0;
  elements.modelSelect.disabled = busy || Boolean(queue?.length);
  elements.voiceSelect.disabled = busy || Boolean(queue?.length);
  elements.speedSelect.disabled = busy || Boolean(queue?.length);
}

function setProgress(progress, info = null) {
  const percent = Math.round(progress * 100);
  elements.progressLabel.textContent = `${percent}%`;
  elements.progressFill.style.width = `${percent}%`;

  if (info?.stage === 'downloading') {
    elements.cacheStatus.textContent = `Downloading (${percent}%)`;
  } else if (info?.stage === 'checking-cache') {
    elements.cacheStatus.textContent = 'Checking';
  } else if (info?.stage === 'complete' || info?.stage === 'cached') {
    elements.cacheStatus.textContent = 'Cached';
  }
}

function refreshQueueState() {
  elements.pendingCount.textContent = String(queue?.pendingCount ?? 0);
  elements.playingState.textContent = queue?.isPlaying ? 'Yes' : 'No';
  elements.completedCount.textContent = String(completed);
  setControls();
}

function startPolling() {
  stopPolling();
  pollId = window.setInterval(refreshQueueState, 200);
}

function stopPolling() {
  if (pollId) {
    window.clearInterval(pollId);
    pollId = null;
  }
}

function log(message) {
  const item = document.createElement('li');
  item.textContent = message;
  elements.queueLog.append(item);
}

function clearLog() {
  elements.queueLog.replaceChildren();
}

function model() {
  return elements.modelSelect.value;
}

function voice() {
  return elements.voiceSelect.value;
}

function speed() {
  return Number.parseFloat(elements.speedSelect.value);
}

function setStatus(message) {
  elements.status.textContent = message;
}

function waitForPaint() {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

function withTimeout(promise, ms, message) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}
