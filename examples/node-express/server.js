import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  KittenTTS,
  errorMessage,
} from '@kittentts/web';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const port = Number(process.env.PORT || 3010);

const defaultConfig = {
  model: 'nano-int8',
  defaultVoice: 'bella',
  storageDirectory: path.join(__dirname, '.cache', 'kittentts'),
};

let ttsPromise = null;

app.use(express.json({ limit: '64kb' }));
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/cache', async (_request, response) => {
  try {
    const info = await KittenTTS.cacheInfo(defaultConfig);
    response.json(info);
  } catch (error) {
    response.status(500).json({ error: errorMessage(error) });
  }
});

app.post('/api/generate', async (request, response) => {
  const text = typeof request.body?.text === 'string' ? request.body.text.trim() : '';
  const voice = typeof request.body?.voice === 'string'
    ? request.body.voice
    : defaultConfig.defaultVoice;
  const speed = Number.isFinite(Number(request.body?.speed))
    ? Number(request.body.speed)
    : 1;

  if (!text) {
    response.status(400).json({ error: 'Text is required.' });
    return;
  }

  try {
    const tts = await getTts();
    const result = await tts.generate(text, { voice, speed });
    response.json({
      audioBase64: result.wavBase64(),
      mimeType: 'audio/wav',
      duration: result.duration,
      sampleRate: result.sampleRate,
      voice: result.voice,
      wordTimings: result.wordTimings,
    });
  } catch (error) {
    response.status(500).json({ error: errorMessage(error) });
  }
});

app.listen(port, () => {
  console.log(`KittenTTS Express example running at http://localhost:${port}`);
  void getTts().catch((error) => {
    console.error('Failed to initialize KittenTTS:', errorMessage(error));
  });
});

function getTts() {
  if (!ttsPromise) {
    ttsPromise = KittenTTS.create(
      defaultConfig,
      (progress, info) => {
        const percent = Math.round(progress * 100);
        const label = info?.asset ? ` ${info.asset}` : '';
        const stage = info?.stage ? ` ${info.stage}` : '';
        console.log(`Preparing KittenTTS: ${percent}%${label}${stage}`);
      },
    ).catch((error) => {
      ttsPromise = null;
      throw error;
    });
  }
  return ttsPromise;
}
