# Playback

Playback is optional. `generate()` works without an audio player.

## Generate Without Playing

```ts
const result = await tts.generate('Save this as audio.');

const wavBytes = result.wavData();
const wavBase64 = result.wavBase64();
const mp3Bytes = await result.mp3Data();
const mp3Base64 = await result.mp3Base64();
```

Use this when your app uploads audio, stores files, or has its own playback
pipeline.

## Browser Audio

```ts
import { KittenTTS, createBrowserAudioPlayer } from '@kittentts/web';

const tts = await KittenTTS.create({
  player: createBrowserAudioPlayer(),
});

await tts.speak('This plays through an HTMLAudioElement.');
```

Browser autoplay rules still apply. Call `speak()` from a user gesture when the
browser requires it.

## Queue Playback

```ts
const queue = tts.createPlaybackQueue();

queue.enqueue(firstResult);
queue.enqueue(secondResult);
queue.enqueueText('Generate this when the previous clips finish.');
```

The queue plays one item at a time. `enqueueText()` waits to generate until the
item reaches the front, so playback order stays stable for short and long input.
`queue.clear()` removes pending items, and `await queue.stop()` clears pending
items and stops active playback.

For strict sequencing, custom `AudioPlayer.play()` implementations should
resolve after playback finishes.

## Custom Player

```ts
import type { AudioPlayer } from '@kittentts/web';

const player: AudioPlayer = {
  async play(samples, sampleRate, options) {
    options?.onPlaybackStart?.();
    // Send Float32 PCM to your own audio system.
  },
  async stop() {
    // Stop active playback.
  },
};
```

Use a custom player for Web Audio, server-side audio pipelines, Electron, game
engines, or framework-specific audio components.
