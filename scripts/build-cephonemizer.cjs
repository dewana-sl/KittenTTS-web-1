#!/usr/bin/env node

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const vendorDir = path.join(root, 'vendor', 'cephonemizer');

// The vendored C++ stays close to the Swift SDK. swift_bridge.cpp is the small
// stable C ABI that Emscripten exposes to JavaScript.
const outFile = path.join(
  root,
  'src',
  'phonemizer',
  'generated',
  'cephonemizer-runtime.js',
);

const sources = [
  path.join(vendorDir, 'phonemizer.cpp'),
  path.join(vendorDir, 'swift_bridge.cpp'),
];

for (const source of sources) {
  if (!fs.existsSync(source)) {
    throw new Error(`Missing CEPhonemizer source file: ${source}`);
  }
}

const emccPath = findEmcc();
const emcc = spawnSync(emccPath, ['--version'], {
  encoding: 'utf8',
  env: buildEnv(),
});
if (emcc.error || emcc.status !== 0) {
  throw new Error(
    'emcc is required to build the CEPhonemizer JS runtime. Install Emscripten, then rerun npm run build:phonemizer.',
  );
}

fs.mkdirSync(path.dirname(outFile), { recursive: true });

const args = [
  ...sources,
  '-O3',
  '-std=c++17',
  '-fexceptions',
  // Emit asm.js so browser bundlers, workers, and Node runtimes can load the
  // phonemizer as plain JavaScript without a separate wasm asset.
  '-sWASM=0',
  '-sMODULARIZE=1',
  '-sEXPORT_ES6=1',
  '-sEXPORT_NAME=createCEPhonemizerModule',
  '-sENVIRONMENT=web,worker,shell',
  // The original C++ reads dictionary files by path. Emscripten MEMFS lets the
  // Web adapter provide those files in memory at runtime.
  '-sFILESYSTEM=1',
  '-sALLOW_MEMORY_GROWTH=1',
  '-sDISABLE_EXCEPTION_CATCHING=0',
  "-sEXPORTED_FUNCTIONS=['_phonemizer_create','_phonemizer_destroy','_phonemizer_phonemize','_phonemizer_free_string']",
  "-sEXPORTED_RUNTIME_METHODS=['cwrap','UTF8ToString','FS']",
  '-o',
  outFile,
];

const result = spawnSync(emccPath, args, {
  cwd: root,
  encoding: 'utf8',
  env: buildEnv(),
  stdio: 'inherit',
});

if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status ?? 1);

console.log(`Built ${path.relative(root, outFile)}`);

function findEmcc() {
  const candidates = [
    process.env.EMCC,
    'emcc',
    '/opt/homebrew/bin/emcc',
    '/usr/local/bin/emcc',
  ].filter(Boolean);

  for (const candidate of candidates) {
    const result = spawnSync(candidate, ['--version'], {
      encoding: 'utf8',
      env: buildEnv(),
    });
    if (!result.error && result.status === 0) return candidate;
  }

  return 'emcc';
}

function buildEnv() {
  const python = process.env.EMSDK_PYTHON || findPython();
  return python
    ? { ...process.env, EMSDK_PYTHON: python }
    : process.env;
}

function findPython() {
  const candidates = [
    process.env.PYTHON,
    '/opt/homebrew/opt/python@3.14/bin/python3.14',
    '/opt/homebrew/bin/python3',
    '/usr/local/bin/python3',
  ].filter(Boolean);

  for (const candidate of candidates) {
    const result = spawnSync(candidate, ['--version'], { encoding: 'utf8' });
    if (!result.error && result.status === 0) return candidate;
  }

  return null;
}
