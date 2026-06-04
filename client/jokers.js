import { state } from './state.js';
import { send } from './ws.js';
import { formatCard } from './cards.js';

export function makeJokerCard(j, isCommitted) {
  const card = document.createElement('div');
  card.className = `joker-card${isCommitted ? ' committed' : ''}`;
  card.innerHTML = `
    ${j.icon ? `<img class="joker-icon" src="${j.icon}" alt="">` : ''}
    <div class="joker-name joker-rarity-${j.rarity ?? 'common'}">${j.name}</div>
    <div class="joker-cat">${j.category ?? ''}</div>
    <div class="joker-desc">${j.desc ?? ''}</div>
    <div class="joker-timing">${(j.timing ?? []).join(', ')}</div>
  `;
  return card;
}

export function renderJokerHand() {
  const area = document.getElementById('joker-hand-area');
  const list = document.getElementById('joker-hand-list');
  list.innerHTML = '';

  if (!state.myJokers.length) {
    area.classList.add('hidden'); return;
  }
  area.classList.remove('hidden');

  state.myJokers.forEach(j => {
    const card = makeJokerCard(j, false);
    card.title = `${j.name}: ${j.desc}`;
    list.appendChild(card);
  });
}

export function renderArmedJokers() {
  const area = document.getElementById('armed-jokers-area');
  const list = document.getElementById('armed-jokers-list');
  if (!area || !list) return;

  if (!state.myCommitted.length) { area.classList.add('hidden'); return; }

  const isMyTurn = state.gameState?.actionIdx !== -1 &&
    state.gameState?.players?.[state.gameState.actionIdx]?.token === state.myToken;

  area.classList.remove('hidden');
  list.innerHTML = '';

  state.myCommitted.forEach(j => {
    const card = makeJokerCard(j, false);
    card.classList.add('armed');
    if (j.id === state.jokerPlaying) {
      card.classList.add('used');
    } else if (isMyTurn) {
      card.classList.add('playable');
      card.addEventListener('click', () => onPlayJokerClick(j, card));
    } else {
      card.classList.add('not-your-turn');
    }
    list.appendChild(card);
  });
}

function onPlayJokerClick(joker, card) {
  if (joker.target === 'opponent') {
    const validTargets = (state.gameState?.players ?? []).filter(
      p => p.token !== state.myToken && !p.folded && !p.sittingOut &&
        (joker.id !== 'jokerThief' || p.jokerCount > 0)
    );
    if (!validTargets.length) {
      showJokerError(joker.id === 'jokerThief'
        ? 'No opponents have jokers to steal.'
        : 'No valid targets.');
      return;
    }
    state.pendingJoker = joker;
    showTargetSelector();
  } else {
    state.jokerPlaying = joker.id;
    card.classList.add('used');
    card.style.pointerEvents = 'none';
    send({ type: 'play_joker', joker_id: joker.id, target: null });
  }
}

export function showJokerError(message) {
  state.jokerPlaying = null;
  renderArmedJokers();
  let toast = document.getElementById('joker-error-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'joker-error-toast';
    toast.className = 'joker-error-toast';
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.classList.add('visible');
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => toast.classList.remove('visible'), 3500);
}

function showTargetSelector() {
  const opponents = (state.gameState?.players ?? []).filter(
    p => p.token !== state.myToken && !p.folded && !p.sittingOut
  );

  const overlay = document.createElement('div');
  overlay.className = 'target-overlay';
  overlay.innerHTML = `<h3>Choose target for ${state.pendingJoker.name}</h3>`;

  opponents.forEach(opp => {
    const btn = document.createElement('button');
    btn.className   = 'target-btn';
    btn.textContent = `${opp.name}  ($${opp.chips})`;
    btn.addEventListener('click', () => {
      document.body.removeChild(overlay);
      send({ type: 'play_joker', joker_id: state.pendingJoker.id, target: opp.token });
      state.pendingJoker = null;
    });
    overlay.appendChild(btn);
  });

  const cancel = document.createElement('button');
  cancel.className   = 'target-cancel';
  cancel.textContent = 'Cancel';
  cancel.addEventListener('click', () => {
    document.body.removeChild(overlay);
    state.pendingJoker = null;
  });
  overlay.appendChild(cancel);
  document.body.appendChild(overlay);
}

export function showJokerTargetPicker(msg) {
  const overlay = document.createElement('div');
  overlay.className = 'target-overlay';
  overlay.innerHTML = `<h3>Robin Hood: choose target</h3>`;

  (msg.choices ?? []).forEach(opp => {
    const btn = document.createElement('button');
    btn.className   = 'target-btn';
    btn.textContent = `${opp.name}  ($${opp.chips})`;
    btn.addEventListener('click', () => {
      document.body.removeChild(overlay);
      send({ type: 'play_joker', joker_id: msg.joker_id, target: opp.token });
    });
    overlay.appendChild(btn);
  });

  const cancel = document.createElement('button');
  cancel.className   = 'target-cancel';
  cancel.textContent = 'Cancel';
  cancel.addEventListener('click', () => document.body.removeChild(overlay));
  overlay.appendChild(cancel);
  document.body.appendChild(overlay);
}

export const buildRevealHtml = msg => {
  switch (msg.type) {
    case 'oracle':
      return `<strong>Oracle</strong><br>Next card: ${msg.cards.map(formatCard).join(', ') || '?'}`;
    case 'tell':
      return `<strong>Tell</strong><br>${msg.targetName}'s cards: ${(msg.cards ?? []).map(formatCard).join(', ')}`;
    case 'xRay':
      return `<strong>X-Ray</strong><br>${(msg.opponents ?? []).map(o => `${o.name}: ${o.cards.map(formatCard).join(' ')}`).join('<br>')}`;
    case 'bloodhound':
      return `<strong>Bloodhound</strong><br>${msg.leaderName} leads with ${msg.handName}`;
    case 'secondLook':
      return `<strong>Second Look</strong><br>Top 3 deck: ${(msg.cards ?? []).map(formatCard).join(', ')}`;
    default:
      return JSON.stringify(msg);
  }
};

function buildPrivateSummary(msg) {
  switch (msg.type) {
    case 'oracle':      return `Oracle: next card ${msg.cards.map(formatCard).join(', ') || '?'}`;
    case 'secondLook':  return `Second Look: ${(msg.cards ?? []).map(formatCard).join(', ')}`;
    case 'tell':        return `Tell: ${msg.targetName} has ${(msg.cards ?? []).map(formatCard).join(' ')}`;
    case 'xRay':        return `X-Ray: ${(msg.opponents ?? []).map(o => `${o.name} ${o.cards.map(formatCard).join(' ')}`).join(' | ')}`;
    case 'bloodhound':  return `Bloodhound: ${msg.leaderName} leads (${msg.handName})`;
    default:            return msg.type;
  }
}

function addPrivateFeedEntry(msg) {
  const feed = document.getElementById('joker-feed');
  const list = document.getElementById('joker-feed-list');
  if (!feed || !list) return;
  feed.classList.remove('hidden');
  const entry = document.createElement('div');
  entry.className = 'joker-feed-entry private-feed-entry';
  entry.innerHTML = `<span class="jfe-private-label">You saw:</span> <span class="jfe-effect">${buildPrivateSummary(msg)}</span>`;
  list.appendChild(entry);
}

function revealTitle(msg) {
  const names = { oracle: 'Oracle', secondLook: 'Second Look', tell: 'Tell', xRay: 'X-Ray', bloodhound: 'Bloodhound' };
  return `Private Info — ${names[msg.type] ?? msg.type}`;
}

export function showJokerReveal(msg) {
  addPrivateFeedEntry(msg);

  const overlay = document.createElement('div');
  overlay.className = 'reveal-modal-overlay';

  const box = document.createElement('div');
  box.className = 'reveal-modal';

  const titleBar = document.createElement('div');
  titleBar.className = 'reveal-modal-title';
  titleBar.textContent = revealTitle(msg);

  const closeBtn = document.createElement('button');
  closeBtn.className = 'reveal-modal-close';
  closeBtn.textContent = '✕';
  titleBar.appendChild(closeBtn);

  const body = document.createElement('div');
  body.className = 'reveal-modal-body';
  body.innerHTML = buildRevealHtml(msg);

  box.appendChild(titleBar);
  box.appendChild(body);
  overlay.appendChild(box);
  document.body.appendChild(overlay);

  const close = () => overlay.remove();
  closeBtn.addEventListener('click', close);
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
}

export function addJokerFeedEntry(msg) {
  const feed = document.getElementById('joker-feed');
  const list = document.getElementById('joker-feed-list');
  if (!feed || !list) return;
  feed.classList.remove('hidden');
  const name = msg.jokerName ?? msg.jokerId.replace(/([A-Z])/g, ' $1').replace(/^[a-z]/, c => c.toUpperCase());
  const entry = document.createElement('div');
  entry.className = 'joker-feed-entry';
  entry.innerHTML = `<span class="jfe-player">${msg.playerName}</span> <span class="jfe-name">${name}</span>${msg.jokerDesc ? `<div class="jfe-desc">${msg.jokerDesc}</div>` : ''}${msg.effectSummary ? `<div class="jfe-effect">${msg.effectSummary}</div>` : ''}`;
  list.appendChild(entry);
}

export function addWinFeedEntry(awards, players) {
  const feed = document.getElementById('joker-feed');
  const list = document.getElementById('joker-feed-list');
  if (!feed || !list) return;
  feed.classList.remove('hidden');
  awards.forEach(a => {
    const names = a.tokens
      .map(t => players.find(x => x.token === t)?.name ?? t)
      .join(' & ');
    const entry = document.createElement('div');
    entry.className = 'joker-feed-entry win-feed-entry';
    entry.innerHTML = `<span class="jfe-player">${names}</span> wins <span class="jfe-amount">$${a.amount}</span>${a.handName ? `<div class="jfe-desc">${a.handName}</div>` : ''}`;
    list.appendChild(entry);
  });
}

export function addPrivateHandFeedEntry(summary) {
  const feed = document.getElementById('joker-feed');
  const list = document.getElementById('joker-feed-list');
  if (!feed || !list) return;
  feed.classList.remove('hidden');
  const entry = document.createElement('div');
  entry.className = 'joker-feed-entry private-feed-entry';
  entry.innerHTML = `<span class="jfe-private-label">Your cards:</span> <span class="jfe-effect">${summary}</span>`;
  list.appendChild(entry);
}

export function clearJokerFeed() {
  const feed = document.getElementById('joker-feed');
  const list = document.getElementById('joker-feed-list');
  if (feed) feed.classList.add('hidden');
  if (list) list.innerHTML = '';
  state.showdownFeedAdded = false;
}
