// 用无头 Chrome 把 resources/*.svg 精确光栅化到 Android / iOS 目录
// 用法: node scripts/render_icons.mjs
import { spawn } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PORT = 9336;
const PROFILE = path.join(ROOT, '_icon_render_profile');

const IOS = path.join(ROOT, 'ios/App/App/Assets.xcassets/AppIcon.appiconset');
// 启动图标属于变体资源：dev（黑金）与 stable（蓝黄）各自输出到 flavor source set
const FLAVORS = [
  { res: 'android/app/src/dev/res', icon: 'icon.svg', round: 'icon-round.svg' },
  { res: 'android/app/src/stable/res', icon: 'stable/icon.svg', round: 'stable/icon-round.svg' },
];

const jobs = [];
for (const flavor of FLAVORS) {
  for (const [density, size] of Object.entries({
    mdpi: 48,
    hdpi: 72,
    xhdpi: 96,
    xxhdpi: 144,
    xxxhdpi: 192,
  })) {
    jobs.push({ svg: flavor.icon, size, out: path.join(ROOT, flavor.res, `mipmap-${density}/ic_launcher.png`) });
    jobs.push({
      svg: flavor.round,
      size,
      out: path.join(ROOT, flavor.res, `mipmap-${density}/ic_launcher_round.png`),
    });
  }
}
jobs.push({ svg: 'icon.svg', size: 1024, out: path.join(ROOT, 'resources/icon.png') });
jobs.push({ svg: 'icon.svg', size: 1500, out: path.join(ROOT, 'resources/icon-1500.png') });
jobs.push({ svg: 'icon-bw.svg', size: 1500, out: path.join(ROOT, 'resources/icon-bw-1500.png') });
jobs.push({ svg: 'logo.svg', size: 1024, out: path.join(ROOT, 'resources/logo.png') });
jobs.push({ svg: 'icon-square.svg', size: 1024, out: path.join(IOS, 'AppIcon-512@2x.png') });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

await mkdir(PROFILE, { recursive: true });
const chrome = spawn(
  CHROME,
  [
    '--headless=new',
    '--disable-gpu',
    '--no-sandbox',
    '--hide-scrollbars',
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${PROFILE}`,
    'about:blank',
  ],
  { stdio: 'ignore' }
);

let targets = null;
for (let attempt = 0; attempt < 40; attempt += 1) {
  try {
    const res = await fetch(`http://127.0.0.1:${PORT}/json`);
    targets = await res.json();
    if (targets.some((t) => t.type === 'page')) break;
  } catch {
    /* retry */
  }
  await sleep(150);
}
if (!targets) throw new Error('无法启动无头 Chrome');

const page = targets.find((t) => t.type === 'page');
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  ws.onopen = resolve;
  ws.onerror = reject;
});

let id = 0;
const pending = new Map();
ws.onmessage = (event) => {
  const msg = JSON.parse(event.data);
  if (msg.id && pending.has(msg.id)) {
    const { resolve, reject } = pending.get(msg.id);
    pending.delete(msg.id);
    if (msg.error) reject(new Error(msg.error.message));
    else resolve(msg.result);
  }
};
function send(method, params = {}) {
  const callId = ++id;
  ws.send(JSON.stringify({ id: callId, method, params }));
  return new Promise((resolve, reject) => pending.set(callId, { resolve, reject }));
}

await send('Page.enable');
await send('Runtime.enable');

const cache = new Map();
async function svgText(name) {
  if (!cache.has(name)) cache.set(name, await readFile(path.join(ROOT, 'resources', name), 'utf8'));
  return cache.get(name);
}

for (const job of jobs) {
  const svg = await svgText(job.svg);
  const html =
    '<!doctype html><html><head><meta charset="utf-8"><style>' +
    'html,body{margin:0;padding:0;width:100%;height:100%;background:transparent;overflow:hidden}' +
    'svg{width:100%;height:100%;display:block}' +
    '</style></head><body>' +
    svg.replace('<svg ', '<svg preserveAspectRatio="xMidYMid meet" ') +
    '</body></html>';

  await send('Emulation.setDeviceMetricsOverride', {
    width: job.size,
    height: job.size,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await send('Emulation.setDefaultBackgroundColorOverride', {
    color: { r: 0, g: 0, b: 0, a: 0 },
  });
  await send('Page.navigate', {
    url: 'data:text/html;charset=utf-8,' + encodeURIComponent(html),
  });
  await sleep(220);
  const shot = await send('Page.captureScreenshot', {
    format: 'png',
    captureBeyondViewport: false,
  });
  await mkdir(path.dirname(job.out), { recursive: true });
  await writeFile(job.out, Buffer.from(shot.data, 'base64'));
  console.log(`  ${job.size}px -> ${path.relative(ROOT, job.out)}`);
}

ws.close();
chrome.kill();

// iOS 图标不能带 alpha 通道
const { execFileSync } = await import('node:child_process');
const iosIcon = path.join(IOS, 'AppIcon-512@2x.png');
if (existsSync(iosIcon)) {
  execFileSync('python', [
    '-c',
    [
      'from PIL import Image',
      `p=r"${iosIcon}"`,
      'im=Image.open(p).convert("RGB")',
      'im.save(p)',
      'print("ios icon alpha stripped")',
    ].join('\n'),
  ]);
}

console.log('done');
