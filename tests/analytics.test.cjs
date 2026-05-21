const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');

async function analyticsModule() {
  return import('../lib/analytics.js');
}

test('analytics disabled sends no request', async () => {
  const { AnalyticsClient } = await analyticsModule();
  const calls = [];
  const client = new AnalyticsClient({
    selectedModel: 'kitten-tts-nano',
    modelVersion: '0.8',
    assetSource: 'cache',
    enabled: false,
    postJson: (...args) => calls.push(args),
    asyncDelivery: false,
  });

  await client.trackGeneration({ selectedVoice: 'bella', generation: 'wav' });

  assert.deepEqual(calls, []);
});

test('success event contains required analytics fields', async () => {
  const { AnalyticsClient, ANALYTICS_ENDPOINT } = await analyticsModule();
  const calls = [];
  const anonymousIdPath = path.join(await fs.mkdtemp(path.join(os.tmpdir(), 'kittentts-web-')), 'analytics_id');
  const client = new AnalyticsClient({
    selectedModel: 'kitten-tts-nano',
    modelVersion: '0.8',
    assetSource: 'cache',
    anonymousIdPath,
    postJson: (...args) => calls.push(args),
    asyncDelivery: false,
  });

  await client.trackGeneration({ selectedVoice: 'bella', generation: 'wav' });

  assert.equal(calls.length, 1);
  const [endpoint, payload, timeout] = calls[0];
  assert.equal(endpoint, ANALYTICS_ENDPOINT);
  assert.equal(timeout, 3);
  for (const key of [
    'anonymous_id',
    'client_event_id',
    'timestamp',
    'sdk_version',
    'sdk_type',
    'platform',
    'runtime_version',
    'selected_model',
    'model_version',
    'selected_voice',
    'generation',
    'asset_source',
  ]) {
    assert.ok(payload[key], key);
  }
  assert.equal(payload.sdk_type, 'web');
  assert.equal(payload.selected_model, 'kitten-tts-nano');
  assert.equal(payload.model_version, '0.8');
  assert.equal(payload.selected_voice, 'bella');
  assert.equal(payload.generation, 'wav');
  assert.equal(payload.asset_source, 'cache');
  assert.equal(payload.ip_address, undefined);
  assert.equal(payload.ip_location, undefined);
});

test('failure event includes sdk error code', async () => {
  const { AnalyticsClient } = await analyticsModule();
  const calls = [];
  const client = new AnalyticsClient({
    selectedModel: 'kitten-tts-nano',
    modelVersion: '0.8',
    assetSource: 'runtime-download',
    postJson: (...args) => calls.push(args),
    asyncDelivery: false,
  });

  await client.trackGeneration({
    selectedVoice: 'jasper',
    generation: 'speak',
    sdkErrorCode: 'PLAYBACK_FAILED',
  });

  assert.equal(calls[0][1].sdk_error_code, 'PLAYBACK_FAILED');
});

test('network errors do not reject analytics calls', async () => {
  const { AnalyticsClient } = await analyticsModule();
  const client = new AnalyticsClient({
    selectedModel: 'kitten-tts-nano',
    modelVersion: '0.8',
    assetSource: 'cache',
    postJson: () => {
      throw new Error('network failed');
    },
    asyncDelivery: false,
  });

  await assert.doesNotReject(
    client.trackGeneration({ selectedVoice: 'bella', generation: 'wav' }),
  );
});

test('analytics transport posts JSON through fetch', async () => {
  const { postJsonRequest } = await analyticsModule();
  const originalFetch = globalThis.fetch;
  let request;

  globalThis.fetch = async (endpoint, init) => {
    request = { endpoint, init };
    return { ok: true, status: 202 };
  };

  try {
    await postJsonRequest('https://example.test/v1/track', {
      sdk_version: '0.1.0',
      selected_voice: 'bella',
    }, 3);
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.equal(request.endpoint, 'https://example.test/v1/track');
  assert.equal(request.init.method, 'POST');
  assert.equal(request.init.headers['Content-Type'], 'application/json');
  assert.equal(request.init.headers.Accept, 'application/json');
  assert.equal(request.init.keepalive, undefined);
  assert.equal(request.init.body, JSON.stringify({
    sdk_version: '0.1.0',
    selected_voice: 'bella',
  }));
});

test('anonymous id is stable across analytics clients', async () => {
  const { AnalyticsClient } = await analyticsModule();
  const anonymousIdPath = path.join(await fs.mkdtemp(path.join(os.tmpdir(), 'kittentts-web-')), 'analytics_id');
  const calls = [];
  const makeClient = () => new AnalyticsClient({
    selectedModel: 'kitten-tts-nano',
    modelVersion: '0.8',
    assetSource: 'cache',
    anonymousIdPath,
    postJson: (...args) => calls.push(args),
    asyncDelivery: false,
  });

  await makeClient().trackGeneration({ selectedVoice: 'bella', generation: 'wav' });
  await makeClient().trackGeneration({ selectedVoice: 'bella', generation: 'wav' });

  assert.equal(calls[0][1].anonymous_id, calls[1][1].anonymous_id);
  assert.equal(calls[0][1].anonymous_id, (await fs.readFile(anonymousIdPath, 'utf8')).trim());
});

test('model metadata uses provider-stable names and versions', async () => {
  const { analyticsModelInfo } = await analyticsModule();

  assert.deepEqual(
    analyticsModelInfo('nano-int8'),
    { selectedModel: 'kitten-tts-nano', modelVersion: '0.8-int8' },
  );
});

test('SDK source does not import or initialize PostHog', async () => {
  const srcDir = path.join(__dirname, '..', 'src');
  const files = await listTypeScriptFiles(srcDir);

  for (const file of files) {
    const source = await fs.readFile(file, 'utf8');
    assert.equal(source.toLowerCase().includes('posthog'), false, file);
  }
});

async function listTypeScriptFiles(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await listTypeScriptFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith('.ts')) {
      files.push(fullPath);
    }
  }
  return files;
}
