// ---- Config ----
const SERVER_HTTP = 'http://localhost:3000';
const SERVER_WS   = 'ws://localhost:3000';

// ---- State ----
let ws        = null;
let myToken   = localStorage.getItem('playerToken') || null;
let lobbyCode = null;
let myName    = '';
let gameState = null;   // last full game_state from server
let myHole    = [];     // private hole cards

// ---- Screens ----
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

// ---- Lobby Screen ----
document.getElementById('btn-join').addEventListener('click', onJoinClick);
document.getElementById('input-code').addEventListener('input', e => {
  e.target.value = e.target.value.toUpperCase();
});

async function onJoinClick() {
  const name = document.getElementById('input-name').value.trim();
  const code = document.getElementById('input-code').value.trim().toUpperCase();
  const errEl = document.getElementById('lobby-error');
  errEl.classList.add('hidden');

  if (!name) { showError(errEl, 'Enter your name.'); return; }

  myName = name;
  let targetCode = code;

  if (!targetCode) {
    // Create lobby
    try {
      const r = await fetch(`${SERVER_HTTP}/lobby`, { method: 'POST' });
      if (!r.ok) throw new Error('Server error');
      const data = await r.json();
      targetCode = data.code;
    } catch (e) {
      showError(errEl, 'Could not reach server.'); return;
    }
  }

  connectWS(targetCode, name);
}

function showError(el, msg) {
  el.textContent = msg;
  el.classList.remove('hidden');
}

// ---- WebSocket ----
function connectWS(code, name) {
  lobbyCode = code;
  const tokenParam = myToken ? `&token=${myToken}` : '';
  const url = `${SERVER_WS}/game/${code}?name=${encodeURIComponent(name)}${tokenParam}`;
  ws = new WebSocket(url);

  ws.addEventListener('open', () => {
    // Transition to waiting room immediately
    document.getElementById('waiting-code').textContent = code;
    showScreen('screen-waiting');
  });

  ws.addEventListener('message', e => {
    let msg;
    try { msg = JSON.parse(e.data); } catch { return; }
    handleMessage(msg);
  });

  ws.addEventListener('close', () => {
    // Simple reconnect attempt after 2s
    setTimeout(() => {
      if (lobbyCode) connectWS(lobbyCode, myName);
    }, 2000);
  });

  ws.addEventListener('error', () => ws.close());
}

function send(obj) {
  if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(obj));
}

// ---- Message Handling ----
function handleMessage(msg) {
  switch (msg.type) {
    case 'your_token':
      myToken = msg.token;
      localStorage.setItem('playerToken', myToken);
      break;

    case 'lobby_state':
      renderWaitingRoom(msg);
      break;

    case 'game_state':
      gameState = msg.state;
      renderGame();
      break;

    case 'your_hand':
      myHole = msg.holeCards ?? [];
      renderMyCards();
      break;

    case 'event':
      handleEvent(msg);
      break;

    case 'game_over':
      renderGameOver(msg);
      break;

    case 'error':
      console.warn('[server error]', msg.message);
      break;
  }
}

function handleEvent(msg) {
  // Events trigger a re-render if we have game state
  if (gameState) renderGame();
}

// ---- Waiting Room ----
document.getElementById('btn-ready').addEventListener('click', () => {
  send({ type: 'ready' });
  document.getElementById('btn-ready').disabled = true;
  document.getElementById('waiting-status').textContent = 'Waiting for others…';
});

document.getElementById('btn-copy-code').addEventListener('click', () => {
  navigator.clipboard?.writeText(lobbyCode).catch(() => {});
});

function renderWaitingRoom(msg) {
  const list = document.getElementById('player-list');
  list.innerHTML = '';
  const players = msg.players ?? [];
  for (const p of players) {
    const li = document.createElement('li');
    const dot = document.createElement('span');
    dot.className = `ready-dot ${p.ready ? 'player-ready' : 'player-waiting'}`;
    li.appendChild(dot);
    const nameSpan = document.createElement('span');
    nameSpan.textContent = p.name + (p.ready ? ' ✓' : '');
    nameSpan.className = p.ready ? 'player-ready' : '';
    li.appendChild(nameSpan);
    list.appendChild(li);
  }
  const total = players.length;
  const ready = players.filter(p => p.ready).length;
  document.getElementById('waiting-status').textContent =
    total < 2 ? 'Need at least 2 players.' : `${ready} / ${total} ready`;
}

// ---- Game Rendering ----
function renderGame() {
  if (!gameState) return;
  showScreen('screen-game');

  renderCommunity();
  renderOpponents();
  renderMyCards();
  renderActionArea();
  renderShowdown();
  renderPot();
}

function renderPot() {
  const pot = gameState.pot ?? 0;
  document.getElementById('pot-display').textContent = pot > 0 ? `Pot: ${pot}` : '';
  document.getElementById('phase-label').textContent = gameState.phase ?? '';
}

function renderCommunity() {
  const el = document.getElementById('community-cards');
  el.innerHTML = '';
  const cards = gameState.community ?? [];
  for (let i = 0; i < 5; i++) {
    if (cards[i]) {
      el.appendChild(makeCard(cards[i]));
    } else {
      const ph = document.createElement('div');
      ph.className = 'card-placeholder';
      el.appendChild(ph);
    }
  }
}

function renderOpponents() {
  const el = document.getElementById('opponents');
  el.innerHTML = '';
  const players = gameState.players ?? [];
  for (const p of players) {
    if (p.token === myToken) continue;
    el.appendChild(makeOpponentSeat(p));
  }
}

function makeOpponentSeat(p) {
  const seat = document.createElement('div');
  seat.className = 'opponent-seat';
  if (p.folded || p.sittingOut) seat.classList.add('folded');
  if (gameState.actionIdx !== -1 &&
      gameState.players[gameState.actionIdx]?.token === p.token) {
    seat.classList.add('active-turn');
  }

  // Dealer / blind badge
  const dealerIdx = gameState.dealerIdx ?? -1;
  const players = gameState.players ?? [];
  const myIdx = players.findIndex(x => x.token === p.token);
  if (myIdx === dealerIdx) {
    const badge = document.createElement('div');
    badge.className = 'seat-badge';
    badge.textContent = 'D';
    seat.appendChild(badge);
  }

  const nameEl = document.createElement('div');
  nameEl.className = 'opponent-name';
  nameEl.textContent = p.name;
  seat.appendChild(nameEl);

  const chipsEl = document.createElement('div');
  chipsEl.className = 'opponent-chips';
  chipsEl.textContent = `$${p.chips}`;
  seat.appendChild(chipsEl);

  if (p.bet > 0) {
    const betEl = document.createElement('div');
    betEl.className = 'opponent-bet';
    betEl.textContent = `bet $${p.bet}`;
    seat.appendChild(betEl);
  }

  if (p.allIn) {
    const ai = document.createElement('div');
    ai.className = 'allin-badge';
    ai.textContent = 'ALL IN';
    seat.appendChild(ai);
  }

  // Small hole cards (back-face unless showdown reveals them)
  const cardRow = document.createElement('div');
  cardRow.className = 'opponent-cards';
  const cardCount = p.holeCards?.length > 0 ? p.holeCards.length : (p.sittingOut ? 0 : 2);
  for (let i = 0; i < cardCount; i++) {
    const c = document.createElement('div');
    if (p.holeCards?.[i] && gameState.phase === 'showdown') {
      c.className = `card-sm revealed ${isRed(p.holeCards[i]) ? 'red' : ''}`;
      c.textContent = formatCard(p.holeCards[i]);
    } else {
      c.className = 'card-sm';
    }
    cardRow.appendChild(c);
  }
  seat.appendChild(cardRow);

  return seat;
}

function renderMyCards() {
  const el = document.getElementById('hole-cards');
  el.innerHTML = '';
  const cards = myHole;
  if (!cards || cards.length === 0) {
    // Try from gameState showdown reveal
    const me = (gameState?.players ?? []).find(p => p.token === myToken);
    if (me?.holeCards?.length) {
      for (const c of me.holeCards) el.appendChild(makeCard(c));
      return;
    }
  }
  for (const c of cards) el.appendChild(makeCard(c));
}

function renderActionArea() {
  const area = document.getElementById('action-area');
  const me = (gameState?.players ?? []).find(p => p.token === myToken);

  if (!me || gameState.phase === 'showdown' || gameState.phase === 'waiting') {
    area.classList.add('hidden'); return;
  }

  const isMyTurn = gameState.actionIdx !== -1 &&
    gameState.players[gameState.actionIdx]?.token === myToken;

  if (!isMyTurn) { area.classList.add('hidden'); return; }

  area.classList.remove('hidden');

  const toCall = Math.max(0, (gameState.currentBet ?? 0) - (me.bet ?? 0));
  const canCheck = toCall === 0;

  document.getElementById('btn-check').style.display = canCheck ? '' : 'none';
  document.getElementById('btn-call').style.display  = canCheck ? 'none' : '';
  document.getElementById('btn-call').textContent = `Call $${toCall}`;

  const infoEl = document.getElementById('action-bet-to-call');
  infoEl.textContent = canCheck ? '' : `Current bet: $${gameState.currentBet}  (call $${toCall})`;

  // Pre-fill raise input with min raise
  const minRaise = (gameState.currentBet ?? 0) + (gameState.minRaise ?? gameState.currentBet ?? 50);
  const raiseInput = document.getElementById('raise-amount');
  if (!raiseInput.value || parseInt(raiseInput.value) < minRaise) {
    raiseInput.value = minRaise;
  }
  raiseInput.min = minRaise;
}

function renderShowdown() {
  const banner = document.getElementById('showdown-banner');
  if (gameState.phase !== 'showdown' || !gameState.awards?.length) {
    banner.classList.add('hidden'); return;
  }
  banner.classList.remove('hidden');
  const lines = gameState.awards.map(a => {
    const names = a.tokens.map(t => {
      const p = (gameState.players ?? []).find(x => x.token === t);
      return p?.name ?? t;
    }).join(' & ');
    return `${names} wins $${a.amount}` + (a.handName ? ` — ${a.handName}` : '');
  });
  banner.innerHTML = lines.map(l => `<div>${l}</div>`).join('');
}

// ---- Action Buttons ----
document.getElementById('btn-fold').addEventListener('click', () =>
  send({ type: 'action', action: 'fold' }));

document.getElementById('btn-check').addEventListener('click', () =>
  send({ type: 'action', action: 'check' }));

document.getElementById('btn-call').addEventListener('click', () =>
  send({ type: 'action', action: 'call' }));

document.getElementById('btn-raise').addEventListener('click', () => {
  const amount = parseInt(document.getElementById('raise-amount').value);
  if (!isNaN(amount)) send({ type: 'action', action: 'raise', amount });
});

// ---- Card Helpers ----
const SUIT_SYMBOL = { h: '♥', d: '♦', c: '♣', s: '♠' };
const RED_SUITS   = new Set(['h', 'd']);

function isRed(card) { return RED_SUITS.has(card.slice(-1)); }

function formatCard(card) {
  if (!card || card.length < 2) return card;
  const rank = card.slice(0, -1);
  const suit = card.slice(-1);
  return (rank === 'T' ? '10' : rank) + (SUIT_SYMBOL[suit] ?? suit);
}

function renderGameOver(msg) {
  const banner = document.getElementById('showdown-banner');
  banner.classList.remove('hidden');
  const standings = (msg.players ?? [])
    .sort((a, b) => b.chips - a.chips)
    .map((p, i) => `${i + 1}. ${p.name} — $${p.chips}`)
    .join('<br>');
  banner.innerHTML = `<strong>Game Over</strong><br>${standings}`;
  document.getElementById('action-area').classList.add('hidden');
}

function makeCard(card) {
  const el = document.createElement('div');
  el.className = `card${isRed(card) ? ' red' : ''}`;
  const rank = card.slice(0, -1);
  const suit = card.slice(-1);
  const rankEl = document.createElement('div');
  rankEl.className = 'rank';
  rankEl.textContent = rank === 'T' ? '10' : rank;
  const suitEl = document.createElement('div');
  suitEl.className = 'suit';
  suitEl.textContent = SUIT_SYMBOL[suit] ?? suit;
  el.appendChild(rankEl);
  el.appendChild(suitEl);
  return el;
}
