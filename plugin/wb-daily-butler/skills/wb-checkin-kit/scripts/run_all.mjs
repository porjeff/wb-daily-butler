// WorkBuddy 每日签到 + 派猫（跨平台：Windows / Linux / macOS / 云主机 / box）
// 原理：复用浏览器里已登录的会话，调用 WorkBuddy 网页接口。不读取、不保存任何密码或 token。
//
// 用法：
//   node run_all.mjs --login         # 首次用：打开登录页，等你扫码，扫完自动继续
//   node run_all.mjs                 # 跑 accounts.json 里的所有账号
//   node run_all.mjs --dry           # 只查询状态，不领取、不派猫
//
// 环境变量：
//   WB_HOME         工作目录（默认本脚本所在目录），accounts.json 与 log/ 都放这里
//   WB_ACCOUNTS     指定账号表路径
//   WB_LOGIN_TIMEOUT  --login 等待秒数，默认 300

import { readFile, appendFile, mkdir } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const HOME = process.env.WB_HOME || __dirname;
const APP_URL = 'https://www.workbuddy.cn/app';
const ACCOUNTS_FILE = process.env.WB_ACCOUNTS || path.join(HOME, 'accounts.json');
const LOG_DIR = path.join(HOME, 'log');
const DRY = process.argv.includes('--dry');
const LOGIN = process.argv.includes('--login');
const LOGIN_TIMEOUT = Math.max(30, Number(process.env.WB_LOGIN_TIMEOUT || 300)) * 1000;

// ---------- 页面内执行的逻辑：签到 + 派猫 ----------
const EXPR = `(async () => {
  const post = async (p, body) => {
    const r = await fetch(p, {method:'POST', headers:{'content-type':'application/json','accept':'application/json'}, body:JSON.stringify(body||{}), credentials:'include'});
    let j = null; try { j = await r.json() } catch(e) {}
    if (r.status === 401 || (r.status === 403 && j?.msg === 'not login')) return {status:r.status, code:-1, msg:'NOT_LOGIN'};
    return {status:r.status, code:j?.code, msg:j?.msg, data:j?.data};
  };
  const get = async (p) => {
    const r = await fetch(p, {credentials:'include'});
    let j = null; try { j = await r.json() } catch(e) {}
    if (r.status === 401) return {status:r.status, code:-1, msg:'NOT_LOGIN'};
    return {status:r.status, code:j?.code, msg:j?.msg, data:j?.data};
  };

  // 1) 签到
  const st = await post('/billing/meter/checkin-activity-status');
  if (st.code === -1) return {ok:false, err:'NOT_LOGIN'};
  if (st.code !== 0) return {ok:false, err:'STATUS_FAIL', msg:st.msg};
  const d = st.data || {};
  const out = {ok:true, already:d.today_checked_in===true, streak_days:d.streak_days,
               today_credit:d.today_credit, total_credits:d.total_credits};
  if (!d.today_checked_in && !${DRY}) {
    const ck = await post('/billing/meter/daily-checkin');
    out.claimed = ck.code === 0;
    out.claim_code = ck.code;
    out.claim_msg = ck.msg;
    const st2 = await post('/billing/meter/checkin-activity-status');
    out.after_total = st2.data?.total_credits;
    out.after_streak = st2.data?.streak_days;
  }

  // 2) 派猫：先领回带回的奖励，猫在家则派出去
  const tr = await post('/activity/growth/buddy/travel/claim');
  out.travel = tr.code === 0 ? 'claimed' : (tr.msg || ('code ' + tr.code));
  const ts = await get('/activity/growth/buddy/travel/status');
  const tstate = ts.data?.state || '';
  out.travel_state = tstate;
  if (${DRY}) {
    out.travel_depart = 'dry-run';
  } else if (tstate === 'idle') {
    const dp = await post('/activity/growth/buddy/travel/depart', {location_id: 1});
    if (dp.code === 0) {
      out.travel_depart = 'departed';
      out.travel_loc = dp.data?.location?.name || '';
      out.travel_hours = dp.data?.location?.duration_hours || 0;
      out.travel_arrive_at = dp.data?.arrive_at || 0;
    } else {
      out.travel_depart = dp.msg || ('code ' + dp.code);
    }
  } else if (tstate) {
    out.travel_depart = 'skip:' + tstate;
  }
  return out;
})()`;

// ---------- 登录态探测（--login 用） ----------
// 只发一个查询请求：401 / 403 not login 说明这个 profile 还没登录，code 0 说明登录态已生效
const PROBE = `(async () => {
  try {
    const r = await fetch('/billing/meter/checkin-activity-status', {
      method:'POST', headers:{'content-type':'application/json','accept':'application/json'},
      body:'{}', credentials:'include'
    });
    let j = null; try { j = await r.json() } catch (e) {}
    if (r.status === 401 || (r.status === 403 && j?.msg === 'not login')) return {state:'need_login'};
    if (j && j.code === 0) return {state:'logged_in', total_credits: j.data?.total_credits,
                                    streak_days: j.data?.streak_days, today_checked_in: j.data?.today_checked_in};
    return {state:'pending', status:r.status, code:j?.code, msg:j?.msg};
  } catch (e) { return {state:'error', msg:String(e)} }
})()`;

// ---------- 浏览器探测 ----------
function detectChrome() {
  const cands = [];
  if (process.platform === 'win32') {
    cands.push(
      'C:/Program Files/Google/Chrome/Application/chrome.exe',
      'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
      process.env.LOCALAPPDATA ? path.join(process.env.LOCALAPPDATA, 'Google/Chrome/Application/chrome.exe') : '',
      'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
      'C:/Program Files/Microsoft/Edge/Application/msedge.exe'
    );
  } else if (process.platform === 'darwin') {
    cands.push(
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge'
    );
  } else {
    cands.push(
      '/opt/google/chrome/chrome',
      '/usr/bin/google-chrome',
      '/usr/bin/google-chrome-stable',
      '/usr/bin/chromium',
      '/usr/bin/chromium-browser',
      '/snap/bin/chromium'
    );
  }
  return cands.find(p => p && existsSync(p)) || null;
}

const CHROME = process.env.WB_CHROME || detectChrome();

function safeName(s) {
  return String(s).replace(/[\\/:*?"<>|\s]+/g, '_').slice(0, 40) || 'account';
}

// ---------- CDP ----------
async function cdp(port, p, method = 'GET') {
  const r = await fetch(`http://127.0.0.1:${port}${p}`, { method });
  return r.json();
}

async function ensureChrome(acc) {
  try { await cdp(acc.port, '/json/version'); return true; } catch {}

  if (!CHROME) throw new Error('CHROME_NOT_FOUND');
  if (!existsSync(acc.profile)) await mkdir(acc.profile, { recursive: true });

  const args = [
    '--remote-debugging-port=' + acc.port,
    '--remote-debugging-address=127.0.0.1',
    '--user-data-dir=' + acc.profile,
    '--no-first-run',
    '--no-default-browser-check',
    '--password-store=basic',
    '--force-renderer-accessibility'
  ];
  // 无桌面环境（云主机）用无头模式；本机默认带界面，方便首次扫码
  if (acc.headless || process.env.WB_HEADLESS === '1') args.push('--headless=new', '--disable-gpu');
  args.push(APP_URL);

  const env = { ...process.env };
  if (process.platform === 'linux' && !env.DISPLAY) env.DISPLAY = ':0';

  const child = spawn(CHROME, args, { detached: true, stdio: 'ignore', env, windowsHide: false });
  child.unref();

  for (let i = 0; i < 40; i++) {
    await new Promise(r => setTimeout(r, 500));
    try { await cdp(acc.port, '/json/version'); return true; } catch {}
  }
  return false;
}

async function pickPage(port) {
  const findApp = async () => {
    const list = await cdp(port, '/json/list');
    return list.find(x => x.type === 'page' && /workbuddy\.cn/.test(x.url)) || null;
  };
  let page = await findApp();
  if (page) return page;
  try { await cdp(port, '/json/new?' + encodeURIComponent(APP_URL), 'PUT'); } catch {}
  // 等页面真正落到 workbuddy.cn，避免拿到 about:blank 导致相对请求全部失败
  for (let i = 0; i < 24; i++) {
    await new Promise(r => setTimeout(r, 500));
    page = await findApp();
    if (page) return page;
  }
  return null;
}

function evalIn(page, expr) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(page.webSocketDebuggerUrl);
    const timer = setTimeout(() => { try { ws.close(); } catch {} reject(new Error('timeout')); }, 40000);
    ws.onopen = () => ws.send(JSON.stringify({ id: 1, method: 'Runtime.evaluate',
      params: { expression: expr, awaitPromise: true, returnByValue: true } }));
    ws.onmessage = (e) => {
      const m = JSON.parse(e.data);
      if (m.id === 1) { clearTimeout(timer); resolve(m.result?.result?.value ?? m.result); try { ws.close(); } catch {} }
    };
    ws.onerror = () => { clearTimeout(timer); reject(new Error('ws error')); };
  });
}

function wsSend(page, payload) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(page.webSocketDebuggerUrl);
    const timer = setTimeout(() => { try { ws.close(); } catch {} reject(new Error('timeout')); }, 20000);
    ws.onopen = () => ws.send(JSON.stringify(payload));
    ws.onmessage = (e) => {
      const m = JSON.parse(e.data);
      if (m.id === payload.id) { clearTimeout(timer); resolve(m); try { ws.close(); } catch {} }
    };
    ws.onerror = () => { clearTimeout(timer); reject(new Error('ws error')); };
  });
}

// 确保页面已加载完成，否则重新导航并等待
// 返回 null 表示成功；否则返回最后一次观测到的 href|readyState，用于报错定位
async function prepPage(page) {
  let last = 'unknown';
  for (let i = 0; i < 8; i++) {
    let href = '', rs = '';
    try {
      const r = await evalIn(page, `({href: location.href, rs: document.readyState})`);
      href = r?.href || ''; rs = r?.rs || '';
    } catch (e) { last = 'eval_fail:' + (e.message || e); }
    if (href) last = href.slice(0, 90) + ' | ' + rs;
    // 只要 DOM 可用就够（能执行 JS、能发 fetch）。SPA 有长连接，readyState 常常停在 interactive 不到 complete
    if (/^https?:\/\//.test(href) && /workbuddy\.cn/.test(href) && (rs === 'complete' || rs === 'interactive')) return null;
    try { await wsSend(page, { id: 99, method: 'Page.navigate', params: { url: APP_URL } }); } catch {}
    await new Promise(r => setTimeout(r, 2500));
  }
  return last;
}

// ---------- 等待扫码登录（--login） ----------
// 打开登录页后就停在这里轮询，用户扫完码自动继续，不需要重跑命令
async function waitLogin(page, acc) {
  const deadline = Date.now() + LOGIN_TIMEOUT;
  let last = {};
  let tick = 0;

  console.error('');
  console.error(`[${acc.name}] 登录窗口已经打开（调试端口 ${acc.port}）。`);
  console.error(`[${acc.name}] 手机微信扫窗口里的二维码，扫完这里会自动继续，不用重跑命令。`);
  console.error(`[${acc.name}] 看不到窗口（云主机 / 远程桌面）时，另开一个终端执行：node login-qr.mjs ${acc.port}`);
  console.error(`[${acc.name}] 再把生成的 login-qr.png 打开，用手机扫那张图。`);
  console.error('');

  while (Date.now() < deadline) {
    try { last = await evalIn(page, PROBE); }
    catch (e) { last = { state: 'eval_fail', msg: String(e.message || e) }; }

    if (last.state === 'logged_in') {
      return {
        ok: true, login: 'ok', just_logged_in: tick > 0,
        total_credits: last.total_credits, streak_days: last.streak_days,
        today_checked_in: last.today_checked_in,
        next: 'node run_all.mjs'
      };
    }
    if (tick % 5 === 0) {
      console.error(`[${acc.name}] 等待扫码… 还剩 ${Math.round((deadline - Date.now()) / 1000)} 秒（当前状态 ${last.state}）`);
    }
    tick++;
    await new Promise(r => setTimeout(r, 3000));
  }

  return {
    ok: false, err: 'LOGIN_TIMEOUT',
    hint: '登录窗口还开着。扫完直接再跑一次 node run_all.mjs --login 就行，不用重装任何东西。'
  };
}

// ---------- 主流程 ----------
let ACCOUNTS;
try {
  ACCOUNTS = JSON.parse(await readFile(ACCOUNTS_FILE, 'utf8'));
} catch (e) {
  console.error(JSON.stringify({ ok: false, err: 'ACCOUNTS_FILE_MISSING', file: ACCOUNTS_FILE }, null, 1));
  process.exit(2);
}

const results = [];
for (const acc of ACCOUNTS) {
  const profile = acc.profile || path.join(HOME, 'profiles', safeName(acc.name));
  const rec = { name: acc.name, port: acc.port };
  try {
    if (!(await ensureChrome({ ...acc, profile }))) throw new Error('CHROME_START_FAIL');
    const page = await pickPage(acc.port);
    if (!page) throw new Error('NO_PAGE');
    const notReady = await prepPage(page);
    if (notReady) throw new Error('PAGE_NOT_READY: ' + notReady);
    if (LOGIN) {
      Object.assign(rec, await waitLogin(page, { ...acc, profile }));
    } else {
      Object.assign(rec, await evalIn(page, EXPR));
    }
  } catch (e) {
    rec.ok = false; rec.err = String(e.message || e);
  }
  results.push(rec);
}

const day = new Date().toISOString().slice(0, 10);
try {
  await mkdir(LOG_DIR, { recursive: true });
  await appendFile(path.join(LOG_DIR, `${day}.jsonl`), JSON.stringify({ ts: new Date().toISOString(), results }) + '\n');
} catch {}

console.log(JSON.stringify({ ok: results.every(r => r.ok !== false), dry: DRY, login: LOGIN, count: results.length, results }, null, 1));
process.exit(results.every(r => r.ok !== false) ? 0 : 1);
