// 调试用：在已登录的页面上下文里执行一段 JS，把结果打印出来
// 用法：node cdp.mjs "表达式" [端口，默认 9222]
const port = process.argv[3] || '9222';
const expr = process.argv[2];
if (!expr) { console.error('用法: node cdp.mjs "JS表达式" [端口]'); process.exit(1); }

const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
const page = list.find(x => x.type === 'page' && /workbuddy\.cn/.test(x.url));
if (!page) {
  console.log(JSON.stringify({ err: 'NO_WORKBUDDY_PAGE', urls: list.map(x => x.url).slice(0, 8) }, null, 1));
  process.exit(2);
}

const out = await new Promise((resolve, reject) => {
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  const timer = setTimeout(() => { try { ws.close(); } catch {} reject(new Error('timeout')); }, 30000);
  ws.onopen = () => ws.send(JSON.stringify({ id: 1, method: 'Runtime.evaluate',
    params: { expression: expr, awaitPromise: true, returnByValue: true } }));
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data);
    if (m.id === 1) { clearTimeout(timer); resolve(m.result?.result?.value ?? m.result); try { ws.close(); } catch {} }
  };
  ws.onerror = () => { clearTimeout(timer); reject(new Error('ws error')); };
});
console.log(JSON.stringify(out, null, 1));
