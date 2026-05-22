# Contributing

## Setup

```bash
npm install
npm run typecheck
npm test
```

## Build

```bash
npm run build
```

The build runs TypeScript, rebuilds the CE phonemizer runtime, and copies the
generated runtime into `lib/`. Do not hand-edit `lib/`; edit `src/` and rebuild.

## Phonemizer Runtime

The checked-in phonemizer runtime is generated from `vendor/cephonemizer`.
Rebuild it only when the C++ source changes:

```bash
npm run build:phonemizer
npm run build
```

`build:phonemizer` requires Emscripten.

## Examples

Run the examples from the repository root:

```bash
npm run example:html
npm run example:vite
npm run example:word-timings
npm run example:express
```

Only run the examples needed for the change you are testing.

## Local Package

After SDK changes that should be tested as an installable package, regenerate a
local tarball:

```bash
npm --cache /tmp/kittentts-npm-cache pack
```
