import { state } from './state.js';
import { showScreen } from './ui.js';
import { makeCard, makeSmCard, formatCard } from './cards.js';
import { renderJokerHand, renderArmedJokers, addWinFeedEntry } from './jokers.js';
import { send } from './ws.js';

export function renderGame() {
  if (!state.gameState) return;
  showScreen('screen-game');
  renderCommunity();
  renderOpponents();
  renderMyCards();
  renderJokerHand();
  renderArmedJokers();
  renderActionArea();
  renderShowdown();
  renderPot();
}

const renderPot = () => {
  const pot = state.gameState.pot ?? 0;
  document.getElementById('pot-display').textContent = pot > 0 ? `Pot: ${pot}` : '';
  document.getElementById('phase-label').textContent = state.gameState.phase ?? '';
};

const renderCommunity = () => {
  const el    = document.getElementById('community-cards');
  const cards = state.gameState.community ?? [];
  el.innerHTML = '';
  for (let i = 0; i < 5; i++) {
    if (cards[i]) {
      el.appendChild(makeCard(cards[i]));
    } else {
      const ph = document.createElement('div');
      ph.className = 'card-placeholder';
      el.appendChild(ph);
    }
  }
};

const renderOpponents = () => {
  const el = document.getElementById('opponents');
  el.innerHTML = '';
  (state.gameState.players ?? [])
    .filter(p => p.token !== state.myToken)
    .forEach(p => el.appendChild(makeOpponentSeat(p)));
};

function makeOpponentSeat(p) {
  const players = state.gameState.players ?? [];
  const myIdx   = players.findIndex(x => x.token === p.token);
  const seat    = document.createElement('div');
  seat.className = 'opponent-seat';

  if (p.folded || p.sittingOut) seat.classList.add('folded');
  if (state.gameState.actionIdx !== -1 &&
      players[state.gameState.actionIdx]?.token === p.token) {
    seat.classList.add('active-turn');
  }

  if (myIdx === (state.gameState.dealerIdx ?? -1)) {
    const badge = document.createElement('div');
    badge.className   = 'seat-badge';
    badge.textContent = 'D';
    seat.appendChild(badge);
  }

  const nameEl = document.createElement('div');
  nameEl.className   = 'opponent-name';
  nameEl.textContent = p.name;
  seat.appendChild(nameEl);

  const chipsEl = document.createElement('div');
  chipsEl.className   = 'opponent-chips';
  chipsEl.textContent = `$${p.chips}`;
  seat.appendChild(chipsEl);

  if (p.bet > 0) {
    const betEl = document.createElement('div');
    betEl.className   = 'opponent-bet';
    betEl.textContent = `bet $${p.bet}`;
    seat.appendChild(betEl);
  }

  if (p.allIn) {
    const ai = document.createElement('div');
    ai.className   = 'allin-badge';
    ai.textContent = 'ALL IN';
    seat.appendChild(ai);
  }

  const cardRow    = document.createElement('div');
  cardRow.className = 'opponent-cards';
  const cardCount  = p.holeCards?.length > 0 ? p.holeCards.length : (p.sittingOut ? 0 : 2);
  for (let i = 0; i < cardCount; i++) {
    const c = document.createElement('div');
    if (p.holeCards?.[i] && state.gameState.phase === 'showdown') {
      cardRow.appendChild(makeSmCard(p.holeCards[i]));
    } else {
      c.className = 'card-sm';
      cardRow.appendChild(c);
    }
  }
  seat.appendChild(cardRow);
  return seat;
}

export function renderMyCards() {
  const el    = document.getElementById('hole-cards');
  const cards = state.myHole;
  el.innerHTML = '';

  if (!cards || cards.length === 0) {
    const me = (state.gameState?.players ?? []).find(p => p.token === state.myToken);
    if (me?.holeCards?.length) {
      me.holeCards.forEach(c => el.appendChild(makeCard(c)));
      return;
    }
  }
  cards.forEach(c => el.appendChild(makeCard(c)));
}

function renderActionArea() {
  const area    = document.getElementById('action-area');
  const buttons = area.querySelector('.action-buttons');
  const status  = document.getElementById('action-status');
  const me      = (state.gameState?.players ?? []).find(p => p.token === state.myToken);

  if (!me || state.gameState.phase === 'showdown' || state.gameState.phase === 'waiting') {
    area.classList.add('hidden'); return;
  }

  area.classList.remove('hidden');

  const isMyTurn = state.gameState.actionIdx !== -1 &&
    state.gameState.players[state.gameState.actionIdx]?.token === state.myToken;

  if (!isMyTurn) {
    buttons.classList.add('invisible');
    document.getElementById('play-joker-area')?.classList.add('hidden');
    document.getElementById('action-bet-to-call').textContent = '';
    status.classList.remove('hidden');
    if (me.sittingOut) {
      status.textContent = 'Joined - playing next hand.';
    } else if (me.folded) {
      status.textContent = 'You folded.';
    } else if (me.allIn) {
      status.textContent = 'All in - waiting for showdown.';
    } else if (state.gameState.actionIdx === -1) {
      status.textContent = 'Waiting…';
    } else {
      const acting = state.gameState.players[state.gameState.actionIdx];
      status.textContent = `Waiting for ${acting?.name ?? '…'}`;
    }
    return;
  }

  status.classList.add('hidden');
  buttons.classList.remove('invisible');

  const toCall   = Math.max(0, (state.gameState.currentBet ?? 0) - (me.bet ?? 0));
  const canCheck = toCall === 0;

  document.getElementById('btn-check').style.display = canCheck ? '' : 'none';
  document.getElementById('btn-call').style.display  = canCheck ? 'none' : '';
  document.getElementById('btn-call').textContent    = `Call $${toCall}`;
  document.getElementById('action-bet-to-call').textContent = canCheck
    ? ''
    : `Current bet: $${state.gameState.currentBet}  (call $${toCall})`;

  const minRaise   = (state.gameState.currentBet ?? 0) + (state.gameState.minRaise ?? state.gameState.currentBet ?? 50);
  const raiseInput = document.getElementById('raise-amount');
  if (!raiseInput.value || parseInt(raiseInput.value) < minRaise) raiseInput.value = minRaise;
  raiseInput.min = minRaise;
}

function renderShowdown() {
  const banner = document.getElementById('showdown-banner');
  if (state.gameState.phase !== 'showdown' || !state.gameState.awards?.length) {
    banner.classList.add('hidden'); return;
  }
  banner.classList.add('hidden');
  if (!state.showdownFeedAdded) {
    addWinFeedEntry(state.gameState.awards, state.gameState.players ?? []);
    state.showdownFeedAdded = true;
  }
}

export function renderGameOver(msg) {
  state.gameOverShowing = true;
  const banner = document.getElementById('showdown-banner');
  banner.classList.remove('hidden');
  const sorted = (msg.players ?? []).sort((a, b) => b.chips - a.chips);
  const winner = sorted[0];
  const standings = sorted.map((p, i) => `${i + 1}. ${p.name} - $${p.chips}`).join('<br>');
  banner.innerHTML =
    `<div class="game-over-winner">${winner?.name ?? 'Someone'} wins!</div>` +
    `<div class="game-over-standings">${standings}</div>` +
    `<button id="btn-play-again" class="btn-primary game-over-btn">Play Again</button>`;
  document.getElementById('action-area').classList.add('hidden');
  document.getElementById('btn-play-again').addEventListener('click', () => {
    state.gameOverShowing = false;
    send({ type: 'play_again' });
    showScreen('screen-waiting');
  });
}

document.getElementById('btn-fold').addEventListener('click',  () => { console.log('[action] fold'); send({ type: 'action', action: 'fold' }); });
document.getElementById('btn-check').addEventListener('click', () => { console.log('[action] check'); send({ type: 'action', action: 'check' }); });
document.getElementById('btn-call').addEventListener('click',  () => { console.log('[action] call'); send({ type: 'action', action: 'call' }); });
document.getElementById('btn-raise').addEventListener('click', () => {
  const amount = parseInt(document.getElementById('raise-amount').value);
  if (!isNaN(amount)) { console.log(`[action] raise $${amount}`); send({ type: 'action', action: 'raise', amount }); }
});
