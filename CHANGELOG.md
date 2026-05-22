# Changelog

## 0.1.0

- Initial Web and Node.js SDK for KittenTTS.
- Added RN-style `KittenTTS.create()`, `generate()`, `generateStreaming()`, `speak()`, `play()`, and model cache helpers.
- Added ONNX Runtime Web inference support.
- Added CE phonemizer support with the vendored C++ phonemizer compiled to asm.js.
- Added browser Cache API, Node filesystem, memory, and custom asset storage support.
- Added browser playback helper and custom `AudioPlayer` interface.
- Added WAV, base64 WAV, and word timing result helpers.
- Added a Vite React browser example.
- Added SDK-side ONNX Runtime Web wasm defaults for frontend apps.
- Added a Vite React word-timing highlight example.
- Added a Node Express backend example that generates WAV audio on the server and plays it in the browser.
- Fixed Node.js ONNX Runtime Web initialization by loading the local WASM backend instead of fetching it.
