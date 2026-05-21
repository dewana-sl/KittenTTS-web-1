const test = require('node:test');
const assert = require('node:assert/strict');

async function sdkModule() {
  return import('../lib/index.js');
}

test('PlaybackQueue plays generated results sequentially', async () => {
  const { KittenTTS, KittenTTSResult } = await sdkModule();
  const plays = [];
  const completions = [];
  const player = {
    async play(samples, sampleRate, options) {
      plays.push({ samples, sampleRate });
      options.onPlaybackStart?.();
      await new Promise((resolve) => completions.push(resolve));
    },
    async stop() {},
  };
  const tts = new KittenTTS(
    { async generate() {}, async dispose() {} },
    { defaultVoice: 'bella', model: 'nano-int8', phonemizer: { dispose() {} }, speed: 1 },
    { trackGeneration() {} },
    player,
  );
  const queue = tts.createPlaybackQueue();
  const first = new KittenTTSResult(new Float32Array([0.1]), 24000, 'bella', 1, 'one');
  const second = new KittenTTSResult(new Float32Array([0.2]), 24000, 'bella', 1, 'two');

  const firstDone = queue.enqueue(first);
  const secondDone = queue.enqueue(second);
  await waitFor(() => plays.length === 1);

  assert.equal(queue.length, 2);
  assert.equal(queue.pendingCount, 1);
  assert.equal(queue.isPlaying, true);

  completions.shift()();
  await firstDone;
  await waitFor(() => plays.length === 2);

  assert.equal(queue.length, 1);
  assert.equal(queue.pendingCount, 0);

  completions.shift()();
  await secondDone;
  assert.equal(queue.length, 0);
  assert.equal(queue.isPlaying, false);
});

test('PlaybackQueue enqueueText generates only when item reaches the front', async () => {
  const { KittenTTS } = await sdkModule();
  const events = [];
  const completions = [];
  const engine = {
    async generate(text) {
      events.push(`generate:${text}`);
      return { samples: new Float32Array([0]), durations: [], phonemes: '' };
    },
    async dispose() {},
  };
  const player = {
    async play() {
      events.push('play');
      await new Promise((resolve) => completions.push(resolve));
    },
    async stop() {},
  };
  const tts = new KittenTTS(
    engine,
    { defaultVoice: 'bella', model: 'nano-int8', phonemizer: { dispose() {} }, speed: 1 },
    { trackGeneration() {} },
    player,
  );
  const queue = tts.createPlaybackQueue();

  const first = queue.enqueueText('first');
  const second = queue.enqueueText('second');
  await waitFor(() => events.length === 2);

  assert.deepEqual(events, ['generate:first', 'play']);

  completions.shift()();
  await first;
  await waitFor(() => events.length === 4);

  assert.deepEqual(events, ['generate:first', 'play', 'generate:second', 'play']);
  completions.shift()();
  await second;
});

async function waitFor(predicate) {
  const deadline = Date.now() + 1000;
  while (Date.now() < deadline) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  assert.fail('Timed out waiting for condition');
}
