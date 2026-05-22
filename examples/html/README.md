# HTML Example

Plain browser example for `@kittentts/web` using static HTML, CSS, and
JavaScript.

## Run

Open `index.html` directly in a browser, or serve the folder from the SDK root:

```bash
npm run example:html
```

When using the server command, open `http://127.0.0.1:5173`. Initialize the SDK,
then generate or speak.

The direct `file://` flow uses in-memory model storage because browser Cache API
support is inconsistent for local files. Refreshing a directly opened file may
download model assets again. Use `npm run example:html` when you want normal
browser cache behavior.

The example loads `./assets/kittentts-web.js`, a generated browser bundle of the
SDK and runtime dependencies. No example-local package install or bundler is
required to run it.

`dist/` is not part of this example. If it exists locally, it is a stale ignored
build output from an earlier bundled run and can be deleted.
