// Chạy sau expo export web. Browser/profile riêng; chỉ API giả lập trong trang.
// Không khởi động json-server, không đọc token thật, không ghi CSDL.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve, extname, sep } from 'node:path';

const root = resolve(process.env.FITLOG_QA_WEB_DIR || '.expo/statistics-phase7-export');
assert.ok(existsSync(resolve(root, 'index.html')), 'Cần export web trước khi chạy.');
const browserPath = process.env.FITLOG_QA_BROWSER || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
assert.ok(existsSync(browserPath), 'Không tìm thấy Chrome; dùng FITLOG_QA_BROWSER để chọn Chromium/Edge.');
const profile = resolve(`.expo/statistics-phase7-browser-${Date.now()}`);
mkdirSync(profile, { recursive: true });
const server = createServer((req, res) => {
  const path = resolve(root, '.' + decodeURIComponent(new URL(req.url, 'http://localhost').pathname));
  if (path !== root && !path.startsWith(root + sep)) { res.writeHead(403).end(); return; }
  const file = existsSync(path) && extname(path) ? path : resolve(root, 'index.html');
  try {
    const type = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.png': 'image/png', '.ttf': 'font/ttf', '.json': 'application/json' }[extname(file)];
    res.writeHead(200, { 'Content-Type': type ?? 'application/octet-stream' }).end(readFileSync(file));
  } catch { res.writeHead(404).end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = spawn(browserPath, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank'], { windowsHide: true, stdio: 'ignore' });
let socket, rpc, nextId = 0;
const pending = new Map();
const errors = [];
const passed = [];
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
async function waitFor(fn, label, timeout = 20000) {
  const end = Date.now() + timeout;
  do { if (await fn()) return; await sleep(100); } while (Date.now() < end);
  throw new Error(`Quá thời gian: ${label}`);
}
function fixtureScript() {
  const day = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
  const run = { id: 1, userId: 1, clientId: 'qa-run-1', date: day, startedAt: day + 'T01:00:00Z', endedAt: day + 'T01:30:00Z',
    durationSec: 1800, pausedSec: 0, distanceKm: 3, steps: 4500, calories: 200 };
  const profile = { id: 1, userId: 1, heightCm: 175, weightKg: 60, sessionsPerWeek: 4 };
  const user = { id: 1, fullName: 'FitLog QA', email: 'qa@example.test', role: 'user' };
  const state = window.__statsQA = { offline: false, requests: [], run, data: {
    '/runs': [run], '/profiles': [profile], '/weightHistory': [{ userId: 1, date: day, weightKg: 60 }],
    '/workouts': [{ id: 1, userId: 1, date: day, status: 'done', durationMin: 30, caloriesBurned: 200 }],
    '/userGoals': [{ userId: 1, minMinutesPerWeek: 150, targetWeightKg: 65 }],
  } };
  const original = window.fetch.bind(window);
  window.fetch = async (input, options = {}) => {
    const url = new URL(typeof input === 'string' ? input : input.url, location.href);
    if (url.port === '3000') {
      const path = url.pathname;
      const method = options.method ?? 'GET';
      state.requests.push({ path, method });
      if (state.offline) throw new TypeError('QA offline');
      if (state.unauthorized) return Response.json({ message: 'QA expired session' }, { status: 401 });
      if (path === '/login' && method === 'POST') return Response.json({ user,
        token: btoa(JSON.stringify({ id: 1, exp: Date.now() + 3600000 })).replaceAll('=', '') + '.qa-signature' });
      if (method !== 'GET') throw new Error('QA chặn mọi API ghi ngoài đăng nhập giả lập');
      return Response.json(path === '/users/1' ? user : state.data[path] ?? []);
    }
    if (url.origin !== location.origin) throw new Error('QA chặn mạng ngoài');
    return original(input, options);
  };
  window.__qaVisible = element => !!element && element.getClientRects().length > 0 && getComputedStyle(element).visibility !== 'hidden';
  window.__qaButton = text => [...document.querySelectorAll('[role="button"],[role="tab"]')]
    .find(element => window.__qaVisible(element) && (element.getAttribute('aria-label') === text || element.textContent.trim().replace(/[‹›]$/, '').trim() === text));
  window.__qaHeader = text => [...document.querySelectorAll('[role="heading"]')]
    .some(element => window.__qaVisible(element) && element.textContent.trim() === text);
}
try {
  await waitFor(() => existsSync(resolve(profile, 'DevToolsActivePort')), 'Chrome khởi động', 15000);
  const port = readFileSync(resolve(profile, 'DevToolsActivePort'), 'utf8').split('\n')[0].trim();
  const pages = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  socket = new WebSocket(pages.find(page => page.type === 'page').webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
  socket.onmessage = event => {
    const message = JSON.parse(event.data);
    if (message.id) { const job = pending.get(message.id); if (job) { pending.delete(message.id); clearTimeout(job.timer);
      if (message.error) job.reject(new Error(JSON.stringify(message.error))); else job.resolve(message.result); } }
    if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails.exception?.description ?? message.params.exceptionDetails.text);
  };
  rpc = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++nextId;
    const timer = setTimeout(() => { pending.delete(id); reject(new Error('CDP timeout: ' + method)); }, 20000);
    pending.set(id, { resolve, reject, timer }); socket.send(JSON.stringify({ id, method, params }));
  });
  const evaluate = async expression => {
    const result = await rpc('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text);
    return result.result.value;
  };
  const check = async (name, fn) => { await fn(); passed.push(name); console.log('PASS ' + name); };
  const click = async text => {
    await waitFor(() => evaluate(`!!window.__qaButton?.(${JSON.stringify(text)})`), 'nút ' + text);
    await evaluate(`window.__qaButton(${JSON.stringify(text)}).click()`);
  };
  const header = title => waitFor(() => evaluate(`!!window.__qaHeader?.(${JSON.stringify(title)})`), 'màn ' + title);
  const screenshot = async name => {
    const result = await rpc('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
    writeFileSync(resolve(`docs/statistics/${name}.png`), Buffer.from(result.data, 'base64'));
  };
  await rpc('Page.enable'); await rpc('Runtime.enable');
  await rpc('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await rpc('Emulation.setTimezoneOverride', { timezoneId: 'Asia/Ho_Chi_Minh' });
  await rpc('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'light' }] });
  await rpc('Page.addScriptToEvaluateOnNewDocument', { source: `(${fixtureScript.toString()})()` });
  await rpc('Page.navigate', { url: origin });
  await check('Đăng nhập qua form thật với API giả lập', async () => {
    await waitFor(() => evaluate('!!document.querySelector(\'input[aria-label="Email"]\')'), 'form đăng nhập');
    await evaluate(`for (const [label,value] of [['Email','qa@example.test'],['Mật khẩu','QaOnly123!']]) {
      const input=document.querySelector('input[aria-label="'+label+'"]');
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,value);
      input.dispatchEvent(new Event('input',{bubbles:true})); input.dispatchEvent(new Event('change',{bubbles:true}));
    }`);
    await click('Đăng nhập');
    await waitFor(() => evaluate('!!window.__qaButton("Thống kê")'), '5 tab sau đăng nhập');
  });
  await check('Trang tóm tắt có dữ liệu thật từ tầng đọc, bố cục mobile 390px', async () => {
    await click('Thống kê'); await header('Tóm tắt');
    await waitFor(() => evaluate('document.body.textContent.includes("200kcal")'), 'số liệu tóm tắt');
    assert.equal(await evaluate('document.scrollingElement.scrollWidth <= innerWidth'), true);
    await screenshot('phase7-summary-light');
  });
  const cards = [['Cam kết thời gian tuần này','Tiến độ mục tiêu'],['Calo theo lịch','Calo luyện tập'],['Quãng đường chạy','Chạy bộ'],
    ['Buổi hoàn thành','Lịch tập và mức độ hoàn thành'],['Cân nặng gần nhất','Cân nặng và BMI'],['Chuỗi hoàn thành','Thói quen luyện tập'],['Phút tập theo lịch','Thời gian luyện tập']];
  for (const [card,title] of cards) await check('Thẻ → ' + title + ' → quay lại tóm tắt', async () => {
    await evaluate(`(()=>{const card=[...document.querySelectorAll('[role="button"][aria-label]')].find(e=>window.__qaVisible(e)&&e.getAttribute('aria-label').startsWith(${JSON.stringify(card + '.')})); if(!card)throw Error('Thiếu thẻ');card.click();})()`);
    await header(title);
    assert.equal(await evaluate('document.scrollingElement.scrollWidth <= innerWidth'), true);
    const category = await evaluate('location.pathname.split("/").at(-1)');
    await screenshot('phase7-detail-' + category);
    await rpc('Emulation.setDeviceMetricsOverride', { width: 320, height: 740, deviceScaleFactor: 1, mobile: true });
    await waitFor(() => evaluate('document.scrollingElement.scrollWidth <= innerWidth'), title + ' ở 320px');
    await rpc('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
    if (title === 'Chạy bộ') {
      await evaluate(`[...document.querySelectorAll('[role="button"][aria-label^="Chạy bộ."]')].find(window.__qaVisible).click()`);
      await header('Chi tiết buổi chạy');
      await click('Đóng chi tiết buổi chạy');
      await waitFor(() => evaluate('!document.querySelector(\'[aria-modal="true"]\')'), 'đóng modal chạy');
    }
    for (const kind of ['ngày','tuần','tháng','năm']) await click('Xem theo ' + kind);
    await click('Quay lại'); await header('Tóm tắt');
  });
  await click('Xem tất cả danh mục'); await header('Tất cả danh mục');
  const titles = ['Thời gian luyện tập','Calo luyện tập','Chạy bộ','Lịch tập và mức độ hoàn thành','Cân nặng và BMI','Tiến độ mục tiêu','Thói quen luyện tập'];
  for (const title of titles) await check('Danh mục → ' + title + ' → quay lại danh mục', async () => {
    await click(title + '. Xem chi tiết'); await header(title);
    await click('Quay lại'); await header('Tất cả danh mục');
  });
  await click('Quay lại'); await header('Tóm tắt');
  await check('Theme tối phản hồi theo hệ thống, không đổi route', async () => {
    await rpc('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'dark' }] });
    await waitFor(() => evaluate(`getComputedStyle([...document.querySelectorAll('[role="heading"]')].find(e=>window.__qaVisible(e)&&e.textContent==='Tóm tắt')).color==='rgb(248, 250, 252)'`), 'theme tối');
    await screenshot('phase7-summary-dark');
  });
  await check('Offline + queue có chủ, đồng bộ lại không tăng trùng tổng', async () => {
    await evaluate(`window.__statsQA.offline=true;localStorage.setItem('@figlog/run_queue_v1',JSON.stringify([{...window.__statsQA.run,id:2,clientId:'qa-run-2',distanceKm:4}]));`);
    await click('Làm mới thống kê');
    await waitFor(() => evaluate('document.body.textContent.includes("7km")&&document.body.textContent.includes("chờ đồng bộ")'), 'offline 7km');
    await evaluate(`window.__statsQA.offline=false;window.__statsQA.data['/runs'].push({...window.__statsQA.run,id:2,clientId:'qa-run-2',distanceKm:4});localStorage.removeItem('@figlog/run_queue_v1');`);
    await click('Làm mới thống kê');
    await waitFor(() => evaluate('document.body.textContent.includes("7km")&&!document.body.textContent.includes("chờ đồng bộ")'), 'online tổng giữ nguyên');
  });
  await check('HTTP 401 chuyển về đăng nhập; quay lại không phục hồi thống kê riêng tư', async () => {
    await evaluate('window.__statsQA.unauthorized=true');
    await click('Làm mới thống kê');
    const loginVisible = '!![...document.querySelectorAll(\'input[aria-label="Email"]\')].find(window.__qaVisible)';
    await waitFor(() => evaluate(loginVisible), 'đăng nhập sau 401');
    assert.equal(await evaluate('window.__qaHeader("Tóm tắt")'), false);
    await evaluate('history.back()');
    await waitFor(() => evaluate(loginVisible), 'guard sau browser back');
    assert.equal(await evaluate('window.__qaHeader("Tóm tắt")'), false);
  });
  await check('Không có exception runtime hoặc API ghi dữ liệu thống kê', async () => {
    assert.deepEqual(errors, []);
    const writes = await evaluate('window.__statsQA.requests.filter(r=>r.method!=="GET"&&r.path!=="/login")');
    assert.deepEqual(writes, []);
  });
  writeFileSync('docs/statistics/phase7-browser-result.json', JSON.stringify({ passed, errors, viewports: ['320x740', '390x844'], backend: 'fetch fixture, no real server' }, null, 2));
  console.log(`PASS ${passed.length}/${passed.length} browser smoke scenarios`);
} catch (error) {
  writeFileSync('docs/statistics/phase7-browser-result.json', JSON.stringify({ passed, errors, failed: error.message }, null, 2));
  console.error(error); process.exitCode = 1;
} finally {
  if (rpc && socket?.readyState === WebSocket.OPEN) { try { await rpc('Browser.close'); } catch { /* Browser đã đóng. */ } }
  socket?.close(); browser.kill(); server.closeAllConnections(); await new Promise(resolve => server.close(resolve));
}
