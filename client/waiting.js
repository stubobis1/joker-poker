import { state } from './state.js';
import { showScreen } from './ui.js';
import { send, leaveGame } from './ws.js';

let settingsDebounce = null;

document.getElementById('btn-leave').addEventListener('click', () => leaveGame());

document.getElementById('btn-ready').addEventListener('click', () => {
  state.isReady = !state.isReady;
  send({ type: 'ready' });
  const btn = document.getElementById('btn-ready');
  btn.textContent = state.isReady ? 'Not Ready' : 'Ready';
  btn.classList.toggle('is-ready', state.isReady);
});

document.getElementById('btn-start').addEventListener('click', () => send({ type: 'start_game' }));

document.getElementById('btn-copy-code').addEventListener('click', () =>
  navigator.clipboard?.writeText(state.lobbyCode).catch(() => {}));

document.getElementById('btn-copy-link').addEventListener('click', () =>
  navigator.clipboard?.writeText(window.location.href).catch(() => {}));

for (const id of ['setting-bb', 'setting-chips', 'setting-starting-jokers', 'setting-jokers-per-round', 'setting-max-jokers', 'setting-max-per-round', 'setting-blind-double-rounds']) {
  document.getElementById(id).addEventListener('input', onSettingChange);
}
document.getElementById('setting-late-join').addEventListener('change', onSettingChange);

function onSettingChange() {
  clearTimeout(settingsDebounce);
  settingsDebounce = setTimeout(() => {
    send({
      type:              'update_settings',
      bb:                parseInt(document.getElementById('setting-bb').value),
      startingChips:     parseInt(document.getElementById('setting-chips').value),
      startingJokers:    parseInt(document.getElementById('setting-starting-jokers').value),
      jokersPerRound:    parseInt(document.getElementById('setting-jokers-per-round').value),
      maxJokers:          parseInt(document.getElementById('setting-max-jokers').value),
      maxJokersPerRound:  parseInt(document.getElementById('setting-max-per-round').value),
      blindDoubleRounds:  parseInt(document.getElementById('setting-blind-double-rounds').value),
      allowLateJoin:      document.getElementById('setting-late-join').checked,
    });
  }, 400);
}

export function renderWaitingRoom(msg) {
  showScreen('screen-waiting');
  document.getElementById('waiting-code').textContent = state.lobbyCode ?? '';

  const players   = msg.players ?? [];
  const hostToken = msg.hostToken ?? state.lobbyHostToken;
  const amHost    = hostToken === state.myToken;
  const settings  = msg.settings ?? state.lobbySettings;

  document.getElementById('host-settings').classList.toggle('hidden', !amHost);
  document.getElementById('guest-settings').classList.toggle('hidden', amHost);

  if (amHost) {
    const ids = {
      'setting-bb':               settings.bb,
      'setting-chips':            settings.startingChips,
      'setting-starting-jokers':  settings.startingJokers   ?? 3,
      'setting-jokers-per-round': settings.jokersPerRound   ?? 1,
      'setting-max-jokers':             settings.maxJokers          ?? 3,
      'setting-max-per-round':          settings.maxJokersPerRound  ?? 3,
      'setting-blind-double-rounds':    settings.blindDoubleRounds  ?? 4,
    };
    for (const [id, val] of Object.entries(ids)) {
      const el = document.getElementById(id);
      if (document.activeElement !== el) el.value = val;
    }
    const lateEl = document.getElementById('setting-late-join');
    if (document.activeElement !== lateEl) lateEl.checked = settings.allowLateJoin ?? false;
  } else {
    document.getElementById('display-bb').textContent              = settings.bb;
    document.getElementById('display-chips').textContent           = settings.startingChips;
    document.getElementById('display-starting-jokers').textContent = settings.startingJokers    ?? 3;
    document.getElementById('display-jokers-per-round').textContent = settings.jokersPerRound   ?? 1;
    document.getElementById('display-max-jokers').textContent      = settings.maxJokers         ?? 3;
    document.getElementById('display-max-per-round').textContent        = settings.maxJokersPerRound  ?? 3;
    const bdr = settings.blindDoubleRounds ?? 4;
    document.getElementById('display-blind-double-rounds').textContent  = bdr === 0 ? 'Off' : bdr;
    document.getElementById('display-late-join').textContent            = (settings.allowLateJoin ?? false) ? 'On' : 'Off';
  }

  const total  = players.length;
  const ready  = players.filter(p => p.ready).length;

  document.getElementById('btn-start').classList.toggle('hidden', !amHost);
  document.getElementById('btn-start').disabled = total < 2;

  const list = document.getElementById('player-list');
  list.innerHTML = '';
  players.forEach(p => list.appendChild(makePlayerItem(p, amHost, hostToken)));
  const status = total < 2
    ? 'Need at least 2 players.'
    : amHost
      ? `${ready} / ${total} ready - click Start Game when ready.`
      : `${ready} / ${total} ready - waiting for host to start.`;
  document.getElementById('waiting-status').textContent = status;
}

function makePlayerItem(p, amHost, hostToken) {
  const li  = document.createElement('li');
  const dot = document.createElement('span');
  dot.className = `ready-dot ${p.ready ? 'player-ready' : 'player-waiting'}`;
  li.appendChild(dot);

  const nameSpan = document.createElement('span');
  nameSpan.className   = p.ready ? 'player-ready' : '';
  nameSpan.textContent = p.name;

  if (p.token === hostToken) {
    const badge = document.createElement('span');
    badge.className   = 'host-badge';
    badge.textContent = 'HOST';
    nameSpan.appendChild(document.createTextNode(' '));
    nameSpan.appendChild(badge);
  }
  li.appendChild(nameSpan);

  if (amHost && p.token !== state.myToken) {
    const kickBtn = document.createElement('button');
    kickBtn.className   = 'kick-btn';
    kickBtn.textContent = '✕';
    kickBtn.title       = `Kick ${p.name}`;
    kickBtn.addEventListener('click', () => send({ type: 'kick_player', target_token: p.token }));
    li.appendChild(kickBtn);
  }
  return li;
}
