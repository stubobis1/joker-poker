import { SERVER_HTTP } from './config.js';
import { state } from './state.js';
import { showError } from './ui.js';
import { connectWS } from './ws.js';

const params  = new URLSearchParams(window.location.search);
const urlCode = params.get('code');
if (urlCode) document.getElementById('input-code').value = urlCode.toUpperCase();

document.getElementById('btn-join').addEventListener('click', onJoinClick);
document.getElementById('input-code').addEventListener('input', e => {
  e.target.value = e.target.value.toUpperCase();
});

// Server box
const serverInput   = document.getElementById('input-server-url');
const btnSaveServer = document.getElementById('btn-save-server');
const serverSaveMsg = document.getElementById('server-save-msg');
serverInput.value = localStorage.getItem('serverUrl') || '';
btnSaveServer.addEventListener('click', () => {
  let val = serverInput.value.trim().replace(/\/$/, '');
  if (val && !/^wss?:\/\//i.test(val)) val = 'ws://' + val;
  if (val) {
    serverInput.value = val;
    localStorage.setItem('serverUrl', val);
  } else {
    localStorage.removeItem('serverUrl');
  }
  pingServer(val || 'ws://localhost:3777');
});

function pingServer(wsBase) {
  serverSaveMsg.textContent = 'Checking...';
  serverSaveMsg.className = 'server-save-msg';
  const timeout = setTimeout(() => {
    ws.close();
    serverSaveMsg.textContent = 'No response (timeout)';
    serverSaveMsg.className = 'server-save-msg server-save-msg--error';
  }, 4000);
  const ws = new WebSocket(`${wsBase}/ping`);
  ws.addEventListener('message', e => {
    clearTimeout(timeout);
    try {
      const msg = JSON.parse(e.data);
      if (msg.type === 'pong') {
        serverSaveMsg.textContent = 'Connected';
        serverSaveMsg.className = 'server-save-msg server-save-msg--ok';
      }
    } catch { /* ignore */ }
  });
  ws.addEventListener('error', () => {
    clearTimeout(timeout);
    serverSaveMsg.textContent = 'Could not connect';
    serverSaveMsg.className = 'server-save-msg server-save-msg--error';
  });
}

async function onJoinClick() {
  const name  = document.getElementById('input-name').value.trim();
  const code  = document.getElementById('input-code').value.trim().toUpperCase();
  const errEl = document.getElementById('lobby-error');
  errEl.classList.add('hidden');

  if (!name) { showError(errEl, 'Enter your name.'); return; }

  state.myName = name;
  let targetCode = code;

  if (!targetCode) {
    try {
      const r = await fetch(`${SERVER_HTTP}/lobby`, { method: 'POST' });
      if (!r.ok) throw new Error('Server error');
      const data = await r.json();
      targetCode = data.code;
    } catch {
      showError(errEl, 'Could not reach server.'); return;
    }
  }

  const newUrl = new URL(window.location.href);
  newUrl.searchParams.set('code', targetCode);
  history.replaceState({}, '', newUrl);

  connectWS(targetCode, name);
}
