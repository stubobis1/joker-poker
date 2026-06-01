import { describe, test, expect, vi, beforeEach } from 'vitest';

vi.mock('../ws.js', () => ({ send: vi.fn() }));

import { makeJokerCard, buildRevealHtml } from '../jokers.js';

const baseJoker = {
  id:       'oracle',
  name:     'Oracle',
  desc:     'See the next card.',
  category: 'info',
  rarity:   'rare',
  timing:   ['pre-flop', 'flop'],
};

describe('makeJokerCard', () => {
  test('returns div.joker-card', () => {
    const card = makeJokerCard(baseJoker, false);
    expect(card.tagName).toBe('DIV');
    expect(card.classList.contains('joker-card')).toBe(true);
  });

  test('no committed class when not committed', () => {
    expect(makeJokerCard(baseJoker, false).classList.contains('committed')).toBe(false);
  });

  test('adds committed class when committed', () => {
    expect(makeJokerCard(baseJoker, true).classList.contains('committed')).toBe(true);
  });

  test('renders joker name', () => {
    const card = makeJokerCard(baseJoker, false);
    expect(card.querySelector('.joker-name').textContent).toBe('Oracle');
  });

  test('applies rarity class to name element', () => {
    const card = makeJokerCard(baseJoker, false);
    expect(card.querySelector('.joker-name').classList.contains('joker-rarity-rare')).toBe(true);
  });

  test('defaults rarity to common', () => {
    const j    = { ...baseJoker, rarity: undefined };
    const card = makeJokerCard(j, false);
    expect(card.querySelector('.joker-name').classList.contains('joker-rarity-common')).toBe(true);
  });

  test('renders description', () => {
    const card = makeJokerCard(baseJoker, false);
    expect(card.querySelector('.joker-desc').textContent).toBe('See the next card.');
  });

  test('renders category', () => {
    const card = makeJokerCard(baseJoker, false);
    expect(card.querySelector('.joker-cat').textContent).toBe('info');
  });

  test('renders timing joined by comma', () => {
    const card = makeJokerCard(baseJoker, false);
    expect(card.querySelector('.joker-timing').textContent).toBe('pre-flop, flop');
  });

  test('empty timing renders blank', () => {
    const j    = { ...baseJoker, timing: [] };
    const card = makeJokerCard(j, false);
    expect(card.querySelector('.joker-timing').textContent).toBe('');
  });
});

describe('buildRevealHtml', () => {
  test('oracle: shows next card list', () => {
    const html = buildRevealHtml({ type: 'oracle', cards: ['Ah', 'Kd'] });
    expect(html).toContain('Oracle');
    expect(html).toContain('A♥');
    expect(html).toContain('K♦');
  });

  test('oracle: handles empty cards', () => {
    const html = buildRevealHtml({ type: 'oracle', cards: [] });
    expect(html).toContain('?');
  });

  test('tell: shows target name and cards', () => {
    const html = buildRevealHtml({ type: 'tell', targetName: 'Bob', cards: ['2c', '7s'] });
    expect(html).toContain('Tell');
    expect(html).toContain('Bob');
    expect(html).toContain('2♣');
    expect(html).toContain('7♠');
  });

  test('x_ray: shows each opponent and cards', () => {
    const html = buildRevealHtml({
      type:      'x_ray',
      opponents: [{ name: 'Alice', cards: ['Ah', 'Kd'] }, { name: 'Bob', cards: ['2c', '3s'] }],
    });
    expect(html).toContain('X-Ray');
    expect(html).toContain('Alice');
    expect(html).toContain('A♥');
    expect(html).toContain('Bob');
    expect(html).toContain('2♣');
  });

  test('bloodhound: shows leader and hand name', () => {
    const html = buildRevealHtml({ type: 'bloodhound', leaderName: 'Carol', handName: 'Flush' });
    expect(html).toContain('Bloodhound');
    expect(html).toContain('Carol');
    expect(html).toContain('Flush');
  });

  test('second_look: shows top 3 deck cards', () => {
    const html = buildRevealHtml({ type: 'second_look', cards: ['Ah', 'Kd', 'Qc'] });
    expect(html).toContain('Second Look');
    expect(html).toContain('A♥');
    expect(html).toContain('K♦');
    expect(html).toContain('Q♣');
  });

  test('unknown type falls back to JSON', () => {
    const msg  = { type: 'unknown_joker', foo: 'bar' };
    const html = buildRevealHtml(msg);
    expect(html).toContain('unknown_joker');
  });
});
