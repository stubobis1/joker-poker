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
  const gs  = state.gameState;
  const pot = gs.pot ?? 0;
  const potEl = document.getElementById('pot-display');
  const pots  = gs.pots ?? [];
  if (pots.length > 1) {
    const main = pots[0].amount;
    const sides = pots.slice(1).map((p, i) => `Side Pot ${i + 1}: $${p.amount}`).join('  ');
    potEl.textContent = `Pot: $${main}  ${sides}`;
  } else {
    potEl.textContent = pot > 0 ? `Pot: $${pot}` : '';
  }

  const PHASES = ['preflop', 'flop', 'turn', 'river', 'showdown'];
  const cur    = gs.phase ?? '';
  const phaseEl = document.getElementById('phase-label');
  phaseEl.innerHTML = PHASES
    .map(p => p === cur ? `<strong class="phase-current">${p}</strong>` : p)
    .join(' – ');

  const bbEl = document.getElementById('bb-display');
  if (gs.phase !== 'waiting') {
    bbEl.textContent = `Big Blind: $${gs.bb ?? '?'}`;
    bbEl.classList.remove('hidden');
  } else {
    bbEl.classList.add('hidden');
  }

  const counterEl = document.getElementById('blind-double-counter');
  const handsUntil = gs.handsUntilBlindDouble ?? null;
  if (handsUntil != null) {
    counterEl.textContent = `Rounds until blinds double: ${handsUntil}`;
    counterEl.classList.remove('hidden');
  } else {
    counterEl.classList.add('hidden');
  }

  const deckEl    = document.getElementById('deck-counter');
  const deckCount = gs.deckCount ?? null;
  const deckTotal = gs.deckTotal ?? null;
  if (deckCount != null && deckTotal != null && gs.phase !== 'waiting') {
    deckEl.textContent = `Deck: ${deckCount} / ${deckTotal}`;
    deckEl.classList.remove('hidden');
  } else {
    deckEl.classList.add('hidden');
  }

  const betsEl = document.getElementById('player-bets-display');
  const activePlayers = (gs.players ?? []).filter(p => !p.sittingOut);
  if (gs.phase !== 'waiting' && gs.phase !== 'committing' && activePlayers.length > 0) {
    betsEl.textContent = activePlayers.map(p => `${p.name}: $${p.bet}`).join('  ');
    betsEl.classList.remove('hidden');
  } else {
    betsEl.classList.add('hidden');
  }
};

const renderCommunity = () => {
  const el    = document.getElementById('community-cards');
  const cards = state.gameState.community ?? [];
  const wilds = new Set(state.gameState.wilds ?? []);
  el.innerHTML = '';
  for (let i = 0; i < 5; i++) {
    if (cards[i]) {
      el.appendChild(makeCard(cards[i], wilds.has(cards[i])));
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

  if (p.commitCount > 0 || p.jokerCount > 0) {
    const jokerRow = document.createElement('div');
    jokerRow.className = 'opponent-joker-row';
    if (p.commitCount > 0) {
      const armed = document.createElement('span');
      armed.className   = 'opp-joker-badge opp-joker-armed';
      armed.textContent = `⚡ ${p.commitCount}`;
      armed.title       = `${p.commitCount} armed joker${p.commitCount !== 1 ? 's' : ''}`;
      jokerRow.appendChild(armed);
    }
    if (p.jokerCount > 0) {
      const reserved = document.createElement('span');
      reserved.className   = 'opp-joker-badge opp-joker-reserved';
      reserved.textContent = `🃏 ${p.jokerCount}`;
      reserved.title       = `${p.jokerCount} joker${p.jokerCount !== 1 ? 's' : ''} in hand`;
      jokerRow.appendChild(reserved);
    }
    seat.appendChild(jokerRow);
  }

  const cardRow    = document.createElement('div');
  cardRow.className = 'opponent-cards';
  const wilds      = new Set(state.gameState.wilds ?? []);
  const revealed   = state.revealedOpponents.find(r => r.token === p.token);
  const knownCards = (p.holeCards?.length ? p.holeCards : revealed?.cards) ?? [];
  const showCards  = knownCards.length > 0;
  const cardCount  = p.holeCards?.length > 0 ? p.holeCards.length : (p.sittingOut ? 0 : (p.holeCardCount ?? 2));
  for (let i = 0; i < cardCount; i++) {
    if (knownCards[i] && showCards) {
      cardRow.appendChild(makeSmCard(knownCards[i], wilds.has(knownCards[i])));
    } else {
      const c = document.createElement('div');
      c.className = 'card-sm';
      cardRow.appendChild(c);
    }
  }
  if (p.holeCards?.length > 0 && state.gameState.phase !== 'showdown') {
    const badge = document.createElement('div');
    badge.className   = 'tell-badge';
    badge.textContent = 'SHOWN';
    seat.appendChild(badge);
  } else if (revealed && state.gameState.phase !== 'showdown') {
    const badge = document.createElement('div');
    badge.className   = 'tell-badge';
    badge.textContent = 'TELL';
    seat.appendChild(badge);
  }
  seat.appendChild(cardRow);
  return seat;
}

export function renderMyCards() {
  const el    = document.getElementById('hole-cards');
  const cards = state.myHole;
  const wilds = new Set(state.gameState?.wilds ?? []);
  el.innerHTML = '';

  if (!cards || cards.length === 0) {
    const me = (state.gameState?.players ?? []).find(p => p.token === state.myToken);
    if (me?.holeCards?.length) {
      me.holeCards.forEach(c => el.appendChild(makeCard(c, wilds.has(c))));
      return;
    }
  }
  cards.forEach(c => el.appendChild(makeCard(c, wilds.has(c))));
}

function renderActionArea() {
  const area    = document.getElementById('action-area');
  const buttons = area.querySelector('.action-buttons');
  const status  = document.getElementById('action-status');
  const me      = (state.gameState?.players ?? []).find(p => p.token === state.myToken);

  const showCardsBtn = document.getElementById('btn-show-cards');
  if (!me || state.gameState.phase === 'showdown' || state.gameState.phase === 'waiting') {
    area.classList.add('hidden');
    showCardsBtn.classList.add('hidden');
    return;
  }

  const alreadyShown = (state.gameState.players ?? []).find(p => p.token === state.myToken)?.holeCards?.length > 0;
  const hasHole = state.myHole.length > 0;
  if (hasHole && !alreadyShown && me.folded) {
    showCardsBtn.classList.remove('hidden');
  } else {
    showCardsBtn.classList.add('hidden');
  }

  area.classList.remove('hidden');

  document.getElementById('player-chip-label').textContent = `${me.name} - $${me.chips ?? 0}`;

  const isMyTurn = state.gameState.actionIdx !== -1 &&
    state.gameState.players[state.gameState.actionIdx]?.token === state.myToken;

  if (!isMyTurn) {
    buttons.classList.add('invisible');
    document.getElementById('raise-quick-btns').classList.add('hidden');
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

  const rawToCall    = Math.max(0, (state.gameState.currentBet ?? 0) - (me.bet ?? 0));
  const hasFreeCheck = (state.gameState.activeEffects?.halfTime ?? []).includes(state.myToken);
  const toCall    = hasFreeCheck ? 0 : rawToCall;
  const canCheck  = toCall === 0;

  document.getElementById('btn-check').style.display = canCheck ? '' : 'none';
  document.getElementById('btn-call').style.display  = canCheck ? 'none' : '';
  document.getElementById('btn-call').textContent    = `Call $${toCall}`;
  document.getElementById('action-bet-to-call').textContent = canCheck
    ? (hasFreeCheck && rawToCall > 0 ? `Free Check active (normally call $${rawToCall})` : '')
    : `Current bet: $${state.gameState.currentBet}  (call $${toCall})`;

  const minRaise   = (state.gameState.currentBet ?? 0) + (state.gameState.minRaise ?? state.gameState.currentBet ?? 50);
  const raiseInput = document.getElementById('raise-amount');
  if (!raiseInput.value || parseInt(raiseInput.value) < minRaise) raiseInput.value = minRaise;
  raiseInput.min = minRaise;

  const bb = state.gameState.bb ?? 50;
  const quickArea = document.getElementById('raise-quick-btns');
  quickArea.classList.remove('hidden');
  document.getElementById('btn-raise-p10bb').textContent = `+${bb * 10}`;
  document.getElementById('btn-raise-p1bb').textContent  = `+${bb}`;
  document.getElementById('btn-raise-m1bb').textContent  = `-${bb}`;
  document.getElementById('btn-raise-m10bb').textContent = `-${bb * 10}`;
}

const SUIT_SYM = { h: '♥', d: '♦', c: '♣', s: '♠' };
function fmtCardText(c, isWild = false) {
  if (!c) return '?';
  if (isWild) return '?☺';
  return c.slice(0, -1).replace('T', '10') + (SUIT_SYM[c.slice(-1)] ?? c.slice(-1));
}

function renderShowdown() {
  const banner = document.getElementById('showdown-banner');
  if (state.gameState.phase !== 'showdown' || !state.gameState.awards?.length) {
    banner.classList.add('hidden'); return;
  }

  if (!state.showdownFeedAdded) {
    addWinFeedEntry(state.gameState.awards, state.gameState.players ?? []);
    state.showdownFeedAdded = true;
  }

  if (state.showdownRendered) return;
  state.showdownRendered = true;

  const showdownHands = state.gameState.showdownHands ?? {};
  const awards        = state.gameState.awards ?? [];
  const players       = state.gameState.players ?? [];
  const wilds         = new Set(state.gameState.wilds ?? []);
  const winnerTokens  = new Set(awards.flatMap(a => a.tokens).filter((_, i, arr) => arr));

  banner.innerHTML = '';
  banner.classList.remove('hidden');

  const title = document.createElement('div');
  title.className   = 'sd-title';
  title.textContent = 'Showdown';
  banner.appendChild(title);

  const handsEl = document.createElement('div');
  handsEl.className = 'sd-hands';

  const active = players.filter(p => !p.folded && !p.sittingOut);
  for (const p of active) {
    const hand      = showdownHands[p.token];
    const isWinner  = winnerTokens.has(p.token);
    const winAwards = awards.filter(a => a.tokens.includes(p.token) &&
      a.handName !== 'Tax Man' && a.handName !== 'Insurance');
    const totalWon  = winAwards.reduce((s, a) => s + a.amount, 0);
    const bestCards = hand?.cards ?? p.holeCards ?? [];

    const row = document.createElement('div');
    row.className = 'sd-player-row' + (isWinner ? ' sd-winner' : ' sd-loser');

    const nameEl = document.createElement('span');
    nameEl.className   = 'sd-player-name';
    nameEl.textContent = p.name;
    row.appendChild(nameEl);

    const descEl = document.createElement('span');
    descEl.className   = 'sd-hand-desc';
    const prefix       = isWinner ? `won $${totalWon} with` : 'lost with';
    descEl.textContent = hand?.name ? `${prefix} ${hand.name}:` : prefix;
    row.appendChild(descEl);

    const cardsEl = document.createElement('span');
    cardsEl.className = 'sd-hand-cards';
    bestCards.forEach(c => {
      const isWild = wilds.has(c);
      const s = c?.slice(-1);
      const span = document.createElement('span');
      span.className = 'sd-card' + (isWild ? ' wild' : (s === 'h' || s === 'd' ? ' red' : ''));
      span.textContent = fmtCardText(c, isWild);
      cardsEl.appendChild(span);
    });
    row.appendChild(cardsEl);

    handsEl.appendChild(row);
  }
  banner.appendChild(handsEl);

  const btn = document.createElement('button');
  btn.className   = 'btn-primary sd-next-btn';
  btn.textContent = 'Arm Jokers →';
  btn.addEventListener('click', () => {
    send({ type: 'next_hand' });
    banner.classList.add('hidden');
  });
  banner.appendChild(btn);
}

export function renderGameOver(msg) {
  state.gameOverShowing = true;
  const banner = document.getElementById('showdown-banner');
  banner.classList.remove('hidden');
  const sorted = (msg.players ?? []).sort((a, b) => b.chips - a.chips);
  const winner = sorted[0];
  const standings = sorted.map((p, i) => `${i + 1}. ${p.name} - $${p.chips}`).join('<br>');
  const headline = msg.isDraw
    ? 'Draw - the deck ran out!'
    : `${winner?.name ?? 'Someone'} wins!`;
  banner.innerHTML =
    `<div class="game-over-winner">${headline}</div>` +
    `<div class="game-over-standings">${standings}</div>` +
    `<button id="btn-play-again" class="btn-primary game-over-btn">Play Again</button>`;
  document.getElementById('action-area').classList.add('hidden');
  document.getElementById('btn-play-again').addEventListener('click', () => {
    state.gameOverShowing = false;
    send({ type: 'play_again' });
    showScreen('screen-waiting');
  });
}

document.getElementById('btn-show-cards').addEventListener('click', () => { send({ type: 'show_cards' }); });

document.getElementById('btn-fold').addEventListener('click',  () => { console.log('[action] fold'); send({ type: 'action', action: 'fold' }); });
document.getElementById('btn-check').addEventListener('click', () => { console.log('[action] check'); send({ type: 'action', action: 'check' }); });
document.getElementById('btn-call').addEventListener('click',  () => { console.log('[action] call'); send({ type: 'action', action: 'call' }); });
document.getElementById('btn-raise').addEventListener('click', () => {
  const amount = parseInt(document.getElementById('raise-amount').value);
  if (!isNaN(amount)) { console.log(`[action] raise $${amount}`); send({ type: 'action', action: 'raise', amount }); }
});

document.getElementById('raise-quick-btns').addEventListener('click', e => {
  const btn = e.target.closest('[data-raise-action]');
  if (!btn) return;
  const action   = btn.dataset.raiseAction;
  const input    = document.getElementById('raise-amount');
  const bb       = state.gameState?.bb ?? 50;
  const me       = (state.gameState?.players ?? []).find(p => p.token === state.myToken);
  const minRaise = (state.gameState?.currentBet ?? 0) + (state.gameState?.minRaise ?? state.gameState?.currentBet ?? 50);
  const maxRaise = (me?.chips ?? 0) + (me?.bet ?? 0);
  let   val      = parseInt(input.value) || minRaise;
  if (action === 'allin') {
    val = maxRaise;
  } else if (action === '+1bb') {
    val += bb;
  } else if (action === '-1bb') {
    val -= bb;
  } else if (action === '+10bb') {
    val += bb * 10;
  } else if (action === '-10bb') {
    val -= bb * 10;
  }
  input.value = Math.max(minRaise, Math.min(maxRaise, val));
});
