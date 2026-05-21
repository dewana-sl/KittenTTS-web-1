# Development

## Commands

```bash
npm install
npm run typecheck
npm test
npm run build
```

`npm run build` regenerates the CE phonemizer runtime, compiles TypeScript, and
copies generated JavaScript assets into `lib/`.

## Phonemizer

The CE phonemizer source lives in `vendor/cephonemizer/`. The generated runtime
is `src/phonemizer/generated/cephonemizer-runtime.js`.

Do not edit generated output directly. Change the vendored source or wrapper,
then run:

```bash
npm run build:phonemizer
```

## Public API

Keep the API close to `@kittentts/react-native` unless the Web runtime requires
a different abstraction. Document public changes in `README.md` and `docs/`.
