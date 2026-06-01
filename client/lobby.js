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
