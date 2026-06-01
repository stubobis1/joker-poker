export const SUIT_SYMBOL = { h: '♥', d: '♦', c: '♣', s: '♠' };
const SUIT_NAME = { h: 'hearts', d: 'diamonds', c: 'clubs', s: 'spades' };

export const isRed = card => card.slice(-1) === 'h' || card.slice(-1) === 'd';

export const formatCard = card => {
  if (!card || card.length < 2) return card;
  const rank = card.slice(0, -1);
  const suit = card.slice(-1);
  return (rank === 'T' ? '10' : rank) + (SUIT_SYMBOL[suit] ?? suit);
};

function makeSuitImg(suit) {
  const img = document.createElement('img');
  img.className = 'suit-img';
  img.src = `dist/${SUIT_NAME[suit] ?? suit}.svg`;
  img.alt = SUIT_SYMBOL[suit] ?? suit;
  return img;
}

export function makeCard(card) {
  const el = document.createElement('div');
  el.className = 'card';

  const rank   = card.slice(0, -1);
  const suit   = card.slice(-1);
  const rankEl = document.createElement('div');
  rankEl.className   = 'rank';
  rankEl.textContent = rank === 'T' ? '10' : rank;

  el.appendChild(rankEl);
  el.appendChild(makeSuitImg(suit));
  return el;
}

export function makeSmCard(card) {
  const el = document.createElement('div');
  el.className = 'card-sm revealed';

  const rank   = card.slice(0, -1);
  const suit   = card.slice(-1);
  const rankEl = document.createElement('span');
  rankEl.className   = 'rank';
  rankEl.textContent = rank === 'T' ? '10' : rank;

  el.appendChild(rankEl);
  el.appendChild(makeSuitImg(suit));
  return el;
}
