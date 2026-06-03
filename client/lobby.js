import { SERVER_HTTP } from './config.js';
import { COMMIT_HASH } from './version.js';
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
const defaultProto = location.protocol === 'https:' ? 'wss' : 'ws';
const defaultServer = `${defaultProto}://localhost:3777`;

function upgradeProto(url) {
  return location.protocol === 'https:' ? url.replace(/^ws:\/\//i, 'wss://') : url;
}

serverInput.value = upgradeProto(localStorage.getItem('serverUrl') || '');
btnSaveServer.addEventListener('click', () => {
  let val = serverInput.value.trim().replace(/\/$/, '');
  if (val && !/^wss?:\/\//i.test(val)) val = defaultProto + '://' + val;
  if (val && !/:\d+$/.test(val.replace(/^wss?:\/\//, ''))) val = val + ':3777';
  val = upgradeProto(val);
  if (val) {
    serverInput.value = val;
    localStorage.setItem('serverUrl', val);
  } else {
    localStorage.removeItem('serverUrl');
  }
  console.log(`joker-poker ${COMMIT_HASH} — connecting to ${val || defaultServer}`);
  pingServer(val || defaultServer);
});

function pingServer(wsBase, attempt = 1, maxAttempts = 5) {
  if (location.protocol === 'https:' && /^ws:\/\//i.test(wsBase)) {
    serverSaveMsg.textContent = 'Blocked: use wss:// on HTTPS';
    serverSaveMsg.className = 'server-save-msg server-save-msg--error';
    return;
  }
  serverSaveMsg.textContent = `Checking... (${attempt}/${maxAttempts})`;
  serverSaveMsg.className = 'server-save-msg';
  let ws;
  const timeout = setTimeout(() => {
    ws.close();
    if (attempt < maxAttempts) {
      pingServer(wsBase, attempt + 1, maxAttempts);
    } else {
      serverSaveMsg.textContent = 'No response (timeout)';
      serverSaveMsg.className = 'server-save-msg server-save-msg--error';
    }
  }, 4000);
  ws = new WebSocket(`${wsBase}/ping`);
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
    if (attempt < maxAttempts) {
      pingServer(wsBase, attempt + 1, maxAttempts);
    } else {
      serverSaveMsg.textContent = 'Could not connect';
      serverSaveMsg.className = 'server-save-msg server-save-msg--error';
    }
  });
}

const CODE_RE = /^[A-Z0-9]{4,8}$/;

async function createLobby(errEl, code = null) {
  const body = code ? JSON.stringify({ code }) : undefined;
  const r = await fetch(`${SERVER_HTTP}/lobby`, {
    method: 'POST',
    headers: code ? { 'Content-Type': 'application/json' } : {},
    body,
  });
  if (!r.ok) {
    const data = await r.json().catch(() => ({}));
    showError(errEl, data.error ?? 'Server error'); return null;
  }
  return (await r.json()).code;
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
    try { targetCode = await createLobby(errEl); } catch { showError(errEl, 'Could not reach server.'); return; }
    if (!targetCode) return;
  } else {
    if (!CODE_RE.test(code)) { showError(errEl, 'Lobby codes are 4–8 letters/numbers.'); return; }

    // Check if lobby exists
    let exists = false;
    try {
      const r = await fetch(`${SERVER_HTTP}/lobby/${code}`);
      exists = r.ok;
    } catch { showError(errEl, 'Could not reach server.'); return; }

    if (!exists) {
      if (!confirm(`No lobby found with code "${code}".\nCreate a new lobby with this code?`)) return;
      try { targetCode = await createLobby(errEl, code); } catch { showError(errEl, 'Could not reach server.'); return; }
      if (!targetCode) return;
    }
  }

  const newUrl = new URL(window.location.href);
  newUrl.searchParams.set('code', targetCode);
  history.replaceState({}, '', newUrl);

  connectWS(targetCode, name);
}
