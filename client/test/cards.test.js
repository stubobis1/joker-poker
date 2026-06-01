import { describe, test, expect } from 'vitest';
import { SUIT_SYMBOL, isRed, formatCard, makeCard } from '../cards.js';

describe('SUIT_SYMBOL', () => {
  test('maps all four suits', () => {
    expect(SUIT_SYMBOL.h).toBe('♥');
    expect(SUIT_SYMBOL.d).toBe('♦');
    expect(SUIT_SYMBOL.c).toBe('♣');
    expect(SUIT_SYMBOL.s).toBe('♠');
  });
});

describe('isRed', () => {
  test('hearts and diamonds are red', () => {
    expect(isRed('Ah')).toBe(true);
    expect(isRed('Kd')).toBe(true);
    expect(isRed('2h')).toBe(true);
    expect(isRed('Td')).toBe(true);
  });

  test('clubs and spades are not red', () => {
    expect(isRed('Ac')).toBe(false);
    expect(isRed('Ks')).toBe(false);
    expect(isRed('2c')).toBe(false);
    expect(isRed('Ts')).toBe(false);
  });
});

describe('formatCard', () => {
  test('formats rank + suit symbol', () => {
    expect(formatCard('Ah')).toBe('A♥');
    expect(formatCard('Kd')).toBe('K♦');
    expect(formatCard('2c')).toBe('2♣');
    expect(formatCard('9s')).toBe('9♠');
  });

  test('converts T to 10', () => {
    expect(formatCard('Th')).toBe('10♥');
    expect(formatCard('Td')).toBe('10♦');
  });

  test('returns card unchanged when null', () => {
    expect(formatCard(null)).toBeNull();
  });

  test('returns card unchanged when too short', () => {
    expect(formatCard('A')).toBe('A');
    expect(formatCard('')).toBe('');
  });

  test('falls back to raw suit char when suit unknown', () => {
    expect(formatCard('Ax')).toBe('Ax');
  });
});

describe('makeCard', () => {
  test('returns div.card', () => {
    const el = makeCard('Ah');
    expect(el.tagName).toBe('DIV');
    expect(el.classList.contains('card')).toBe(true);
  });

  test('no red class - suit color carried by SVG', () => {
    expect(makeCard('Ah').classList.contains('red')).toBe(false);
    expect(makeCard('Kd').classList.contains('red')).toBe(false);
    expect(makeCard('Ac').classList.contains('red')).toBe(false);
  });

  test('rank element shows correct text', () => {
    expect(makeCard('Ah').querySelector('.rank').textContent).toBe('A');
    expect(makeCard('Kd').querySelector('.rank').textContent).toBe('K');
    expect(makeCard('2c').querySelector('.rank').textContent).toBe('2');
  });

  test('T rank renders as 10', () => {
    expect(makeCard('Th').querySelector('.rank').textContent).toBe('10');
  });

  test('suit rendered as img.suit-img with correct src', () => {
    expect(makeCard('Ah').querySelector('img.suit-img').getAttribute('src')).toBe('dist/hearts.svg');
    expect(makeCard('Kd').querySelector('img.suit-img').getAttribute('src')).toBe('dist/diamonds.svg');
    expect(makeCard('2c').querySelector('img.suit-img').getAttribute('src')).toBe('dist/clubs.svg');
    expect(makeCard('9s').querySelector('img.suit-img').getAttribute('src')).toBe('dist/spades.svg');
  });

  test('suit img alt text is unicode symbol', () => {
    expect(makeCard('Ah').querySelector('img.suit-img').getAttribute('alt')).toBe('♥');
    expect(makeCard('Kd').querySelector('img.suit-img').getAttribute('alt')).toBe('♦');
  });
});
