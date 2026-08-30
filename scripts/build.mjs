import { mkdir, readFile } from 'node:fs/promises';
import { build } from 'esbuild';

const outfile = 'dist/terminal-cards.js';
const packageJson = JSON.parse(await readFile('package.json', 'utf8'));
const version = packageJson.version;

await mkdir('dist', { recursive: true });
await build({
  entryPoints: ['src/index.js'],
  outfile,
  bundle: true,
  minify: true,
  format: 'esm',
  target: ['es2022'],
  legalComments: 'none',
  define: { __TERMINAL_CARDS_VERSION__: JSON.stringify(version) },
  banner: {
    js: `/* Terminal Cards v${version} | MIT | github.com/agrestisdavid/terminal-cards */`,
  },
});

const output = await readFile(outfile, 'utf8');
for (const element of [
  'terminal-card-wrapper',
  'terminal-title-card',
  'terminal-light-card',
  'terminal-switch-card',
  'terminal-sensor-card',
  'terminal-calendar-card',
  'terminal-waste-card',
  'terminal-alarm-card',
  'terminal-shutter-card',
  'terminal-navigation-card',
  'terminal-entity-popup',
]) {
  if (!output.includes(element)) {
    throw new Error(`Build output is missing ${element}`);
  }
}

console.log(`Built ${outfile} (${Buffer.byteLength(output)} bytes)`);
