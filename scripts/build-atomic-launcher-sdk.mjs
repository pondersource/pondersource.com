import { copyFile, mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';

const [checkout, destination] = process.argv.slice(2);
if (!checkout || !destination) throw new Error('Usage: build-atomic-launcher-sdk.mjs <atomic-server> <destination>');
const browser = resolve(checkout, 'browser');
const directory = resolve(destination);
const fromBrowser = createRequire(join(browser, 'package.json'));
const fromLibrary = createRequire(join(browser, 'lib', 'package.json'));
const esbuild = fromBrowser('esbuild');
const loro = fromLibrary.resolve('loro-crdt/web');

await mkdir(directory, { recursive: true });
await esbuild.build({
  stdin: {
    contents: `export { Agent, Client, LoroLoader, Store, agentSubjectFromPublicKey, collections,
      connectAgentUrl, core, decodeB64, decodeGenesisCert, genesisSignerDid, resolveDriveOrigins,
      server, verifyGenesisCert } from './lib/src/index.ts';`,
    resolveDir: browser,
    sourcefile: 'launcher-atomic-sdk.ts'
  },
  outfile: join(directory, 'index.mjs'),
  target: 'es2022',
  platform: 'browser',
  format: 'esm',
  bundle: true,
  minify: true,
  plugins: [{
    name: 'loro-browser',
    setup(build) {
      // LoroLoader uses its web entry in a browser. The bare import is the
      // Node fallback, whose bundler entry has a circular WASM/JS import.
      build.onResolve({ filter: /^loro-crdt$/ }, args => ({ path: args.path, external: true }));
    }
  }]
});
await copyFile(join(dirname(loro), 'loro_wasm_bg.wasm'), join(directory, 'loro_wasm_bg.wasm'));
await copyFile(resolve(checkout, 'LICENSE'), join(directory, 'LICENSE'));
