# AGENTS.md

Guidance for coding agents working on `@kittentts/web`.

## Project Overview

This package is a Web and Node.js SDK for on-device KittenTTS speech synthesis.
The public API mirrors `@kittentts/react-native`: it downloads/caches model
assets, prepares the CE phonemizer, runs ONNX Runtime Web, and optionally plays
generated WAV audio through a user-provided `AudioPlayer`.

Main flow:

1. `KittenTTS.create()` resolves config, prepares the phonemizer, downloads any
   missing model files, loads `voices.npz`, and creates the ONNX engine.
2. `tts.generate()` preprocesses text, phonemizes it, tokenizes IPA symbols,
   runs ONNX inference, and returns `KittenTTSResult`.
3. `tts.speak()` calls `generate()` and sends the result to an `AudioPlayer`.

## Important Paths

- `src/index.ts`: public exports.
- `src/KittenTTS.ts`: main SDK class and lifecycle.
- `src/KittenTTSConfig.ts`: user config and defaults.
- `src/KittenTTSError.ts`: SDK error codes and helpers.
- `src/KittenModel.ts`: model names, download URLs, sizes, speed priors.
- `src/KittenVoice.ts`: voice enum and display helpers.
- `src/loader/ModelDownloader.ts`: model cache and Hugging Face downloads.
- `src/loader/NPZLoader.ts`: `voices.npz` ZIP/NPY parsing.
- `src/engine/TTSEngine.ts`: text-to-token-to-ONNX inference.
- `src/phonemizer/CEPhonemizer.ts`: JS/Emscripten phonemizer adapter.
- `src/storage/AssetStorage.ts`: browser, Node, and custom cache abstraction.
- `src/audio/AudioOutput.ts`: optional playback interfaces and browser player.
- `examples/html/`: plain HTML browser example app. Run it with
  `npm run example:html` or open `index.html` directly; direct `file://` usage
  falls back to memory storage.
- `examples/vite-react/`: first browser example app.
- `examples/vite-react-word-timings/`: word-level timing/highlight example.
- `examples/node-express/`: Node Express backend-to-browser playback example.
- `vendor/cephonemizer/`: vendored C++ phonemizer source.
- `scripts/build-cephonemizer.cjs`: builds generated phonemizer runtime.

## Build And Validation

Use these from the repository root:

```bash
npm install
npm run typecheck
npm test
npm run build
```

`npm run build` writes compiled output to `lib/` and regenerates the
phonemizer runtime. Do not hand-edit `lib/`.

`npm run build:phonemizer` requires Emscripten and regenerates
`src/phonemizer/generated/cephonemizer-runtime.js`.

## Dependency Notes

- Runtime dependencies are `onnxruntime-web` and `pako`.
- Playback is optional. Users can pass `createBrowserAudioPlayer()` in browsers
  or their own `AudioPlayer`.
- Browser model caching uses Cache API when available and falls back to memory.
- Node model caching uses a filesystem cache under the OS cache directory by
  default.

## Editing Rules

- Keep public API changes close to `@kittentts/react-native`.
- Keep browser and Node usage both viable.
- Keep generated phonemizer output untouched unless rebuilding the phonemizer.
- Update README and docs when public API or platform behavior changes.
