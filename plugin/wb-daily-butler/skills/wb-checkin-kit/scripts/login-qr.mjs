// 把当前登录页截成图片，方便在无桌面环境（云主机 / box）里扫码登录
// 用法：一边跑 `node run_all.mjs --login`（它会停住等扫码），另一边跑 `node login-qr.mjs [端口]`
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const port = process.argv[2] || '9222';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const HOME = process.env.WB_HOME || __dirname;
const outPath = path.join(HOME, 'login-qr.png');

const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
const page = list.find(x => x.type === 'page' && /workbuddy\.cn/.test(x.url)) || list.find(x => x.type === 'page');
if (!page) {
  console.log(JSON.stringify({ ok: false, err: 'NO_PAGE', hint: '先运行 node run_all.mjs --login 启动浏览器' }));
  process.exit(2);
}

const shot = await new Promise((resolve, reject) => {
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  const timer = setTimeout(() => { try { ws.close(); } catch {} reject(new Error('timeout')); }, 30000);
  ws.onopen = () => ws.send(JSON.stringify({ id: 1, method: 'Page.captureScreenshot', params: { format: 'png' } }));
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data);
    if (m.id === 1) { clearTimeout(timer); resolve(m.result); try { ws.close(); } catch {} }
  };
  ws.onerror = () => { clearTimeout(timer); reject(new Error('ws error')); };
});

if (!shot?.data) {
  console.log(JSON.stringify({ ok: false, err: 'SCREENSHOT_FAILED' }));
  process.exit(3);
}

await writeFile(outPath, Buffer.from(shot.data, 'base64'));
console.log(JSON.stringify({ ok: true, file: outPath, url: page.url, hint: '把这张图发给用户扫，扫完再跑一次 --dry 确认已登录' }, null, 1));
