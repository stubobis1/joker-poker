export const SUIT_SYMBOL = { h: '♥', d: '♦', c: '♣', s: '♠' };
const SUIT_NAME = { h: 'hearts', d: 'diamonds', c: 'clubs', s: 'spades' };

export const isRed = card => card.slice(-1) === 'h' || card.slice(-1) === 'd';

export const formatCard = (card, isWild = false) => {
  if (!card || card.length < 2) return card;
  if (isWild) return '?☺';
  const rank = card.slice(0, -1);
  const suit = card.slice(-1);
  return (rank === 'T' ? '10' : rank) + (SUIT_SYMBOL[suit] ?? suit);
};

function makeSuitImg(suit, isWild = false) {
  const img = document.createElement('img');
  img.className = 'suit-img';
  img.src = isWild ? 'dist/svg/wild-card.svg' : `dist/svg/suits/${SUIT_NAME[suit] ?? suit}.svg`;
  img.alt = isWild ? 'wild' : (SUIT_SYMBOL[suit] ?? suit);
  return img;
}

export function makeCard(card, isWild = false) {
  const el = document.createElement('div');
  el.className = 'card';
  if (isWild) el.classList.add('wild');

  const rank   = card.slice(0, -1);
  const suit   = card.slice(-1);
  const rankEl = document.createElement('div');
  rankEl.className   = 'rank';
  rankEl.textContent = isWild ? '?' : (rank === 'T' ? '10' : rank);

  el.appendChild(rankEl);
  el.appendChild(isWild ? (() => { const s = document.createElement('span'); s.className = 'suit-img wild-sym'; s.textContent = '☺'; return s; })() : makeSuitImg(suit, false));
  return el;
}

export function makeSmCard(card, isWild = false) {
  const el = document.createElement('div');
  el.className = 'card-sm revealed';
  if (isWild) el.classList.add('wild');

  const rank   = card.slice(0, -1);
  const suit   = card.slice(-1);
  const rankEl = document.createElement('span');
  rankEl.className   = 'rank';
  rankEl.textContent = isWild ? '?' : (rank === 'T' ? '10' : rank);

  el.appendChild(rankEl);
  el.appendChild(isWild ? (() => { const s = document.createElement('span'); s.className = 'suit-img wild-sym'; s.textContent = '☺'; return s; })() : makeSuitImg(suit, false));
  return el;
}
