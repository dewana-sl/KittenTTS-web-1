const test = require('node:test');
const assert = require('node:assert/strict');

async function sdkModule() {
  return import('../lib/index.js');
}

test('speak analytics fires when playback starts', async () => {
  const { KittenTTS } = await sdkModule();
  const calls = [];
  let resolvePlayback;

  const engine = {
    async generate() {
      return {
        samples: new Float32Array(24),
        durations: [],
        phonemes: '',
      };
    },
    async dispose() {},
  };
  const analytics = {
    trackGeneration(input) {
      calls.push(input);
    },
  };
  const player = {
    async play(samples, sampleRate, options) {
      options.onPlaybackStart?.();
      await new Promise((resolve) => {
        resolvePlayback = resolve;
      });
    },
    async stop() {},
  };

  const tts = new KittenTTS(
    engine,
    {
      defaultVoice: 'bella',
      model: 'nano-int8',
      phonemizer: { dispose() {} },
      speed: 1,
    },
    analytics,
    player,
  );

  const speakPromise = tts.speak('hello');
  await waitFor(() => calls.length > 0);

  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0], {
    selectedVoice: 'bella',
    generation: 'speak',
    sdkErrorCode: undefined,
  });

  resolvePlayback();
  await speakPromise;
  assert.equal(calls.length, 1);
});

test('stream analytics fires once for a multi-chunk stream', async () => {
  const { KittenTTS } = await sdkModule();
  const calls = [];
  let generateCalls = 0;

  const engine = {
    async generate() {
      generateCalls += 1;
      return {
        samples: new Float32Array(24),
        durations: [],
        phonemes: '',
      };
    },
    async dispose() {},
  };
  const analytics = {
    trackGeneration(input) {
      calls.push(input);
    },
  };

  const tts = new KittenTTS(
    engine,
    {
      defaultVoice: 'bella',
      model: 'nano-int8',
      phonemizer: { dispose() {} },
      speed: 1,
    },
    analytics,
  );

  const chunks = [];
  const longText = `${'Hello. '.repeat(40)}${'Goodbye. '.repeat(40)}`;
  for await (const chunk of tts.stream(longText)) {
    chunks.push(chunk);
  }

  assert.ok(generateCalls > 1);
  assert.ok(chunks.length > 1);
  assert.deepEqual(calls, [{
    selectedVoice: 'bella',
    generation: 'stream',
    sdkErrorCode: undefined,
  }]);
});

async function waitFor(predicate) {
  const deadline = Date.now() + 1000;
  while (Date.now() < deadline) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}
