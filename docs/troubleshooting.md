# Troubleshooting

## Downloads Fail

Check network access to Hugging Face, or pass `modelBaseURL` to use your own
asset host. Use `redownloadModel()` after an interrupted first download.

## Browser Playback Fails

Browsers may block audio until a user gesture. Trigger `speak()` from a click or
tap, or call `generate()` first and play later.

## Page Looks Frozen During Generation

Generation is CPU-heavy. The SDK yields at setup and inference boundaries so
browser UI can paint loading states, but long text can still use significant
CPU while ONNX Runtime runs. Set your loading state before awaiting
`KittenTTS.create()`, `generate()`, or `speak()`. For long text, use
`tts.stream()` to synthesize sentence by sentence and update the UI between
results.

## ONNX Runtime Backend Fails In A Frontend App

Reload the page after SDK updates. The SDK configures ONNX Runtime Web wasm
assets before the first session is created. If your app self-hosts ORT assets,
pass `ortWasmPath` to `KittenTTS.create()`.

## Node Cannot Load Model Paths

Path-based `modelFiles` are supported in Node.js. Browser apps should pass
`onnxData` and `voicesData`, use normal downloads, or provide custom storage.

## Build Cannot Find Emscripten

`npm run build:phonemizer` requires `emcc`. Install Emscripten and make sure
`emcc --version` works, or set `EMCC` to the compiler path.
