const test = require('node:test');
const assert = require('node:assert/strict');

const { KittenTTSResult } = require('../lib/KittenTTSResult');

test('mp3Data returns an MP3 byte stream', async () => {
  const samples = new Float32Array(24000);
  for (let i = 0; i < samples.length; i += 1) {
    samples[i] = Math.sin((2 * Math.PI * 440 * i) / 24000) * 0.25;
  }

  const result = new KittenTTSResult(samples, 24000, 'bella', 1, 'tone');
  const mp3 = await result.mp3Data({ bitRate: 64 });

  assert.ok(mp3.length > 0);
  assert.ok(
    (mp3[0] === 0xff && (mp3[1] & 0xe0) === 0xe0) ||
      (mp3[0] === 0x49 && mp3[1] === 0x44 && mp3[2] === 0x33),
  );
  assert.equal((await result.mp3Base64({ bitRate: 64 })).length > 0, true);
});
