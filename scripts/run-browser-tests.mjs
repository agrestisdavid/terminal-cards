import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';

const tests = [
  'wrapper',
  'title',
  'light',
  'switch',
  'sensor',
  'calendar',
  'waste',
  'waste-status',
  'alarm',
  'shutter',
  'vacuum',
  'vacuum-mobile',
  'navigation',
  'popup',
  'popup-mobile',
  'editors',
];
const candidates = [
  process.env.CHROME_PATH,
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].filter(Boolean);

for (const directory of (process.env.PATH || '').split(delimiter)) {
  for (const executable of ['google-chrome', 'google-chrome-stable', 'chromium', 'chrome']) {
    candidates.push(join(directory, executable));
  }
}

const chrome = candidates.find((candidate) => {
  if (!existsSync(candidate)) return false;
  return spawnSync(candidate, ['--version'], { encoding: 'utf8' }).status === 0;
});

if (!chrome) {
  throw new Error('Chrome/Chromium not found. Set CHROME_PATH to run browser tests.');
}

const userDataDir = mkdtempSync(join(tmpdir(), 'terminal-cards-chrome-'));
try {
  for (const test of tests) {
    const url = pathToFileURL(join(process.cwd(), 'tests', `${test}.test.html`)).href;
    const result = spawnSync(
      chrome,
      [
        '--headless=new',
        '--disable-gpu',
        '--no-sandbox',
        '--allow-file-access-from-files',
        '--run-all-compositor-stages-before-draw',
        test === 'vacuum-mobile'
          ? '--window-size=390,844'
          : test === 'popup-mobile'
            ? '--window-size=500,844'
            : '--window-size=800,600',
        '--virtual-time-budget=6000',
        `--user-data-dir=${userDataDir}`,
        '--dump-dom',
        url,
      ],
      { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 }
    );

    if (result.status !== 0 || !result.stdout.includes('data-test-status="PASS"')) {
      console.error(result.stdout);
      console.error(result.stderr);
      throw new Error(`${test}.test.html failed`);
    }
    console.log(`PASS tests/${test}.test.html`);
  }
} finally {
  rmSync(userDataDir, { recursive: true, force: true });
}
