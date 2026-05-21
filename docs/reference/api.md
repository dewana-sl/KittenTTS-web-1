# API Reference

## KittenTTS.create

```ts
const tts = await KittenTTS.create(options, onProgress);
```

Options include `model`, `defaultVoice`, `speed`, `storageDirectory`,
`modelBaseURL`, `modelFiles`, `downloadRetries`, ONNX tuning fields,
`phonemizer`, `storage`, `fetch`, `ortWasmPath`, `analytics`, and optional
`player`.

In browsers, `ortWasmPath` defaults to the matching ONNX Runtime Web CDN wasm
asset. Pass a directory string, a `{ wasm, mjs }` mapping, or `false` if your
app configures ONNX Runtime itself.

Set `analytics: false` to disable anonymous generation analytics for a session.
Analytics events go to the KittenTTS ingest API and do not include input text or
generated audio.

Generation analytics use `wav` for `generate()`, `speak` for `speak()`, and
`stream` for `stream()`. Streaming sends one event per stream invocation, not
one event per generated chunk.

## generate

```ts
const result = await tts.generate(text, { voice: 'luna', speed: 1.1 });
```

Returns `KittenTTSResult` with PCM samples, sample rate, selected voice, speed,
input text, WAV and MP3 helpers, and word timings.

```ts
const wav = result.wavData();
const mp3 = await result.mp3Data({ bitRate: 128 });
```

## speak

```ts
const result = await tts.speak(text, { voice: 'bella', speed: 1.0 });
```

Calls `generate()` and plays the result through the configured `AudioPlayer`.

## createPlaybackQueue

```ts
const queue = tts.createPlaybackQueue();

await queue.enqueue(result);
await queue.enqueueText('Play this after earlier queued audio.', {
  voice: 'luna',
});
```

Returns a FIFO `PlaybackQueue` for serial playback. `enqueue(result)` queues an
existing `KittenTTSResult`. `enqueueText(text, options)` queues generation and
playback together, and generation starts when that item reaches the front of the
queue. Use `queue.clear()` to reject pending items or `await queue.stop()` to
clear pending items and stop active playback.

## stream

```ts
for await (const chunk of tts.stream(text)) {
  await tts.play(chunk);
}
```

Splits long text into sentence groups and yields generated chunks.

## Cache Helpers

```ts
await KittenTTS.cacheInfo(config);
await KittenTTS.predownload(config, onProgress);
await KittenTTS.validateAssets(config);
await KittenTTS.redownloadModel(config, onProgress);
await KittenTTS.clearModelCache(config);
```

## Phonemizer

`CEPhonemizer` is the default phonemizer. It uses the same vendored C++
phonemizer source compiled to asm.js and loads dictionary files into Emscripten
MEMFS at runtime.
