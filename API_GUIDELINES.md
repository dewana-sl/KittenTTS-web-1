# KittenTTS Web API Guidelines

Use the same public shape as the other SDKs: typed string IDs plus config and options objects.

```ts
const tts = await KittenTTS.create({
  model: 'mini',
  defaultVoice: 'luna',
  speed: 1.1,
  player: createBrowserAudioPlayer(),
});

const result = await tts.generate('Hello', {
  voice: 'luna',
  speed: 1.1,
});

await tts.play(result);
await tts.speak('Hello', { voice: 'bella', speed: 1.0 });

for await (const chunk of tts.stream(longText, { voice: 'luna' })) {
  await tts.play(chunk);
}

const cache = await KittenTTS.cacheInfo({ model: 'mini' });
await KittenTTS.predownload({ model: 'mini' });
await KittenTTS.validateAssets({ model: 'mini' });
```

Public IDs:

```ts
type KittenTTSModelId = 'nano' | 'nano-int8' | 'micro' | 'mini';
type KittenTTSVoiceId = 'bella' | 'jasper' | 'luna' | 'bruno' | 'rosie' | 'hugo' | 'kiki' | 'leo';
```

Do not expose repository IDs, model filenames, or voice embedding keys in app-facing examples.
