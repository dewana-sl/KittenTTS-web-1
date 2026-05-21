# Offline Assets

You can skip downloads by passing model and voice data directly.

```ts
const tts = await KittenTTS.create({
  modelFiles: {
    onnxData,
    voicesData,
  },
});
```

In Node.js you can also pass file paths:

```ts
const tts = await KittenTTS.create({
  modelFiles: {
    onnxPath: './models/kitten_tts_nano_v0_8.onnx',
    voicesPath: './models/voices.npz',
  },
});
```

For custom browser caching, implement `AssetStorage` and pass it as `storage`.
This is useful for IndexedDB, service workers, app-managed downloads, or
framework-specific storage.
