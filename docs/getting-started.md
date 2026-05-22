# Getting Started

## Install

```bash
npm install @kittentts/web
```

## Browser

```ts
import {
  KittenTTS,
  createBrowserAudioPlayer,
} from '@kittentts/web';

const tts = await KittenTTS.create({
  model: 'nano-int8',
  player: createBrowserAudioPlayer(),
});

await tts.speak('Hello from the browser.');
```

The first run downloads the selected ONNX model, `voices.npz`, and CE
phonemizer dictionaries. Browser caching uses Cache API when available. The SDK
also configures ONNX Runtime Web wasm assets automatically, so Vite and other
frontend apps do not need app-side ONNX setup.

## Node.js

```ts
import { writeFile } from 'node:fs/promises';
import { KittenTTS } from '@kittentts/web';

const tts = await KittenTTS.create();
const result = await tts.generate('Hello from Node.');

await writeFile('hello.wav', result.wavData());
await writeFile('hello.mp3', await result.mp3Data());
await tts.dispose();
```

Node.js uses a filesystem cache by default. Pass `storageDirectory` to choose
where model and phonemizer assets are stored.

## Analytics

The SDK sends anonymous generation metadata to the KittenTTS ingest API. It
does not send input text, generated audio, or initialize PostHog in the SDK.
Streaming calls send one `stream` analytics event per stream invocation, not
one event per generated chunk.

```ts
const tts = await KittenTTS.create({
  analytics: false,
});
```

## Progress

```ts
const tts = await KittenTTS.create({}, (progress, info) => {
  console.log(progress, info?.stage, info?.asset);
});
```

## Streaming

```ts
for await (const chunk of tts.stream(longText)) {
  await tts.play(chunk);
}
```

## Example App

The plain HTML example is in [`examples/html`](../examples/html).
The first browser example is in [`examples/vite-react`](../examples/vite-react).
The read-aloud highlighting example is in
[`examples/vite-react-word-timings`](../examples/vite-react-word-timings).
The backend playback example is in
[`examples/node-express`](../examples/node-express).

```bash
npm run example:html
```

Open `http://127.0.0.1:5173`, or open `examples/html/index.html` directly in a
browser. Direct `file://` usage falls back to in-memory asset storage, so a
refresh may download model assets again.
