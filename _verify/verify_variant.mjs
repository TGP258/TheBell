const PORT = Number(process.argv[2] ?? 9386);
const EXPECT = {
  appName: process.argv[3] ?? 'TheBell Beta',
  version: process.argv[4] ?? 'Dev0.4.2204',
  ringDark: (process.argv[5] ?? 'dark') === 'dark',
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let failures = 0;
const check = (name, ok, extra = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${ok ? '' : ' ' + extra}`);
  if (!ok) failures += 1;
};
const targets = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json();
const page = targets.filter((t) => t.type === 'page')[0];
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
let callId = 0;
const pending = new Map();
ws.onmessage = (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) {
    pending.get(m.id)(m.result);
    pending.delete(m.id);
  }
};
function send(method, params = {}) {
  return new Promise((resolve) => {
    callId += 1;
    pending.set(callId, resolve);
    ws.send(JSON.stringify({ id: callId, method, params }));
  });
}
const evaluate = async (expr) => {
  const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
  return r?.result?.value;
};
let ready = false;
for (let i = 0; i < 40; i += 1) {
  if (await evaluate('!!document.querySelector(".tasks-card")')) { ready = true; break; }
  await sleep(500);
}
check('应用已渲染首页', ready);
check(`窗口标题含 ${EXPECT.appName}`, (await evaluate('document.title')).includes(EXPECT.appName));
check(
  `侧栏品牌为 ${EXPECT.appName}`,
  (await evaluate("document.querySelector('.brand-text b')?.textContent.trim()")) === EXPECT.appName
);
check(
  `侧栏版本为 ${EXPECT.version}`,
  (await evaluate("document.querySelector('.brand-text span')?.textContent.trim()")).includes(EXPECT.version)
);
const svg = await evaluate("fetch('/brand-icon.svg').then((r) => r.text())");
check(
  EXPECT.ringDark ? 'LOGO 为黑金（变体 dev）' : 'LOGO 为蓝黄（变体 stable）',
  EXPECT.ringDark
    ? svg.includes('#000000') && svg.includes('#B8860B') && !svg.includes('2563EB')
    : svg.includes('2563EB') && svg.includes('FBBF24')
);
await evaluate(
  "[...document.querySelectorAll('.side-nav button, .bottom-nav button')].find((b) => b.textContent.includes('设置'))?.click()"
);
await sleep(600);
check(
  `关于卡 ${EXPECT.appName} + ${EXPECT.version}`,
  await evaluate(
    `document.querySelector('.about-brand b')?.textContent.trim() === '${EXPECT.appName}' && document.querySelector('.version-tag')?.textContent.trim() === '${EXPECT.version}'`
  )
);
const platform = await evaluate(
  "[...document.querySelectorAll('.about-meta li')].find((li) => li.textContent.includes('平台'))?.textContent.trim()"
);
console.log('平台显示:', platform);
check('平台行正常', /Android\s*\d/.test(platform ?? '') && !/PadOS/.test(platform ?? ''), platform);
ws.close();
process.exit(failures ? 1 : 0);
