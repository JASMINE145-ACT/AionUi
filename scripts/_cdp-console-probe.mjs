import http from 'node:http';
import WebSocket from 'ws';

const list = await new Promise((resolve, reject) => {
  http.get('http://127.0.0.1:9230/json/list', (res) => {
    let data = '';
    res.on('data', (c) => (data += c));
    res.on('end', () => resolve(JSON.parse(data)));
  }).on('error', reject);
});

const page = list.find((p) => p.type === 'page');
if (!page) {
  console.log(JSON.stringify({ error: 'NO_PAGE' }));
  process.exit(1);
}

const events = [];
const ws = new WebSocket(page.webSocketDebuggerUrl);
let step = 0;

const send = (id, method, params = {}) => ws.send(JSON.stringify({ id, method, params }));

ws.on('open', () => {
  send(1, 'Runtime.enable');
  send(2, 'Log.enable');
});

ws.on('message', (raw) => {
  const msg = JSON.parse(String(raw));
  if (msg.method === 'Runtime.exceptionThrown') {
    events.push({ kind: 'exception', ...msg.params });
  }
  if (msg.method === 'Log.entryAdded') {
    const e = msg.params.entry;
    if (e.level === 'error' || e.level === 'warning') {
      events.push({ kind: 'log', level: e.level, text: e.text, source: e.source });
    }
  }
  if (msg.id === 1 && step === 0) {
    step = 1;
    send(3, 'Runtime.evaluate', {
      expression: `(function(){
        return JSON.stringify({
          href: location.href,
          hash: location.hash,
          title: document.title,
          bodyTextLen: (document.body && document.body.innerText) ? document.body.innerText.length : 0,
          spin: !!document.querySelector('.arco-spin'),
          textarea: !!document.querySelector('textarea'),
          chatLayout: !!document.querySelector('.chat-layout'),
          messageList: !!document.querySelector('[class*="message"]'),
          rootChildren: document.getElementById('root') ? document.getElementById('root').children.length : 0,
          viteOverlay: !!document.querySelector('vite-error-overlay')
        });
      })()`,
      returnByValue: true,
    });
  }
  if (msg.id === 3) {
    const dom = msg.result?.result?.value ?? null;
    setTimeout(() => {
      console.log(JSON.stringify({ pageUrl: page.url, domProbe: dom ? JSON.parse(dom) : null, events }, null, 2));
      ws.close();
      process.exit(0);
    }, 2000);
  }
});

ws.on('error', (e) => {
  console.log(JSON.stringify({ error: e.message }));
  process.exit(1);
});

setTimeout(() => {
  console.log(JSON.stringify({ pageUrl: page.url, timeout: true, events }, null, 2));
  process.exit(0);
}, 10000);
