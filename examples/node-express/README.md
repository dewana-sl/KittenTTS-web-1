# KittenTTS Node Express Example

This example runs KittenTTS in a Node.js Express backend and sends WAV audio
back to the browser for playback.

## Run

```bash
cd examples/node-express
npm install
npm start
```

Open `http://localhost:3010`.

The first run downloads the model, voices, and phonemizer files into
`.cache/kittentts`. Later runs use that server-side filesystem cache.
