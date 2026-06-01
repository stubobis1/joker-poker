// ---- Config ----
const SERVER_HTTP = 'http://localhost:3000';
const SERVER_WS   = 'ws://localhost:3000';

// ---- State ----
let ws            = null;
let myToken       = localStorage.getItem('playerToken') || null;
let lobbyCode     = null;
let myName        = '';
let gameState     = null;   // last full game_state from server
let myHole        = [];     // private hole cards
let myJokers      = [];     // available jokers (from your_hand)
let myCommitted   = [];     // committed jokers (from your_hand)
let selectedToArm = new Set(); // joker ids selected in commit phase
let pendingJoker  = null;   // { id } waiting for target selection
let commitDeadline = null;  // Date for countdown timer

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
      if (gameState.phase === 'committing') {
        renderCommitScreen();
      } else {
        renderGame();
      }
      break;

    case 'your_hand':
      myHole      = msg.holeCards ?? [];
      myJokers    = msg.jokers    ?? [];
      myCommitted = msg.committed ?? [];
      renderMyCards();
      renderJokerHand();
      break;

    case 'event':
      handleEvent(msg);
      break;

    case 'joker_reveal':
      showJokerReveal(msg);
      break;

    case 'joker_played':
      showJokerPlayedBanner(msg);
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
  renderJokerHand();
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
  renderPlayJokerArea();

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

// ---- Commit Screen ----

function renderCommitScreen() {
  showScreen('screen-commit');
  selectedToArm.clear();
  updateCommitCount();

  const list = document.getElementById('commit-joker-list');
  list.innerHTML = '';
  for (const j of myJokers) {
    const card = makeJokerCard(j, false);
    card.addEventListener('click', () => {
      if (selectedToArm.has(j.id)) { selectedToArm.delete(j.id); card.classList.remove('selected'); }
      else { selectedToArm.add(j.id); card.classList.add('selected'); }
      updateCommitCount();
    });
    list.appendChild(card);
  }

  // Start countdown (15s)
  commitDeadline = Date.now() + 15000;
  startCommitCountdown();

  document.getElementById('commit-waiting').classList.add('hidden');
}

function updateCommitCount() {
  document.getElementById('commit-count').textContent = selectedToArm.size;
}

function startCommitCountdown() {
  const fill = document.getElementById('commit-timer-fill');
  const total = 15000;
  const tick = () => {
    const remaining = Math.max(0, commitDeadline - Date.now());
    fill.style.width = `${(remaining / total) * 100}%`;
    if (remaining > 0 && gameState?.phase === 'committing') requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

document.getElementById('btn-commit').addEventListener('click', () => {
  send({ type: 'commit_jokers', joker_ids: [...selectedToArm] });
  document.getElementById('btn-commit').disabled = true;
  document.getElementById('commit-waiting').textContent = 'Waiting for other players…';
  document.getElementById('commit-waiting').classList.remove('hidden');
  // Disable all joker cards
  document.querySelectorAll('#commit-joker-list .joker-card').forEach(c => c.style.pointerEvents = 'none');
});

// ---- Joker Hand (during game) ----

function renderJokerHand() {
  const area = document.getElementById('joker-hand-area');
  const list = document.getElementById('joker-hand-list');
  list.innerHTML = '';

  if (!myJokers.length && !myCommitted.length) { area.classList.add('hidden'); return; }
  area.classList.remove('hidden');

  for (const j of myJokers) {
    const card = makeJokerCard(j, false);
    card.title = `${j.name}: ${j.desc}`;
    list.appendChild(card);
  }
  for (const j of myCommitted) {
    const card = makeJokerCard(j, true);
    card.title = `[ARMED] ${j.name}: ${j.desc}`;
    list.appendChild(card);
  }
}

function renderPlayJokerArea() {
  const area = document.getElementById('play-joker-area');
  if (!myCommitted.length) { area.classList.add('hidden'); return; }

  const isMyTurn = gameState?.actionIdx !== -1 &&
    gameState?.players?.[gameState.actionIdx]?.token === myToken;
  if (!isMyTurn) { area.classList.add('hidden'); return; }

  area.classList.remove('hidden');
  const list = document.getElementById('committed-joker-list');
  list.innerHTML = '';

  for (const j of myCommitted) {
    const card = makeJokerCard(j, false);
    card.classList.add('playable');
    card.addEventListener('click', () => onPlayJokerClick(j));
    list.appendChild(card);
  }
}

function onPlayJokerClick(joker) {
  if (joker.target === 'opponent') {
    // Need to pick a target
    pendingJoker = joker;
    showTargetSelector();
  } else {
    send({ type: 'play_joker', joker_id: joker.id, target: null });
  }
}

function showTargetSelector() {
  const opponents = (gameState?.players ?? []).filter(
    p => p.token !== myToken && !p.folded && !p.sittingOut
  );
  const overlay = document.createElement('div');
  overlay.className = 'target-overlay';
  overlay.innerHTML = `<h3>Choose target for ${pendingJoker.name}</h3>`;
  for (const opp of opponents) {
    const btn = document.createElement('button');
    btn.className = 'target-btn';
    btn.textContent = `${opp.name}  ($${opp.chips})`;
    btn.addEventListener('click', () => {
      document.body.removeChild(overlay);
      send({ type: 'play_joker', joker_id: pendingJoker.id, target: opp.token });
      pendingJoker = null;
    });
    overlay.appendChild(btn);
  }
  const cancel = document.createElement('button');
  cancel.className = 'target-cancel';
  cancel.textContent = 'Cancel';
  cancel.addEventListener('click', () => { document.body.removeChild(overlay); pendingJoker = null; });
  overlay.appendChild(cancel);
  document.body.appendChild(overlay);
}

function makeJokerCard(j, isCommitted) {
  const card = document.createElement('div');
  card.className = `joker-card${isCommitted ? ' committed' : ''}`;
  const rarityClass = `joker-rarity-${j.rarity ?? 'common'}`;
  card.innerHTML = `
    <div class="joker-name ${rarityClass}">${j.name}</div>
    <div class="joker-cat">${j.category ?? ''}</div>
    <div class="joker-desc">${j.desc ?? ''}</div>
    <div class="joker-timing">${(j.timing ?? []).join(', ')}</div>
  `;
  return card;
}

// ---- Joker reveal popup ----

function showJokerReveal(msg) {
  const popup = document.createElement('div');
  popup.className = 'reveal-popup';

  let html = '';
  switch (msg.type) {
    case 'oracle':
      html = `<strong>Oracle</strong><br>Next card: ${msg.cards.map(formatCard).join(', ') || '?'}`;
      break;
    case 'tell':
      html = `<strong>Tell</strong><br>${msg.targetName}'s cards: ${(msg.cards ?? []).map(formatCard).join(', ')}`;
      break;
    case 'x_ray':
      html = `<strong>X-Ray</strong><br>${(msg.opponents ?? []).map(o => `${o.name}: ${o.cards.map(formatCard).join(' ')}`).join('<br>')}`;
      break;
    case 'bloodhound':
      html = `<strong>Bloodhound</strong><br>${msg.leaderName} leads with ${msg.handName}`;
      break;
    case 'second_look':
      html = `<strong>Second Look</strong><br>Top 3 deck: ${(msg.cards ?? []).map(formatCard).join(', ')}`;
      break;
    default:
      html = JSON.stringify(msg);
  }
  popup.innerHTML = html;
  document.body.appendChild(popup);
  setTimeout(() => popup.remove(), 6000);
}

function showJokerPlayedBanner(msg) {
  const popup = document.createElement('div');
  popup.className = 'reveal-popup';
  popup.style.borderColor = '#7b1fa2';
  popup.innerHTML = `<strong>${msg.playerName}</strong> played <em>${msg.jokerId.replace(/_/g, ' ')}</em>`;
  document.body.appendChild(popup);
  setTimeout(() => popup.remove(), 3000);
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
