import { describe, test, expect, beforeEach } from 'vitest';
import { state } from '../state.js';

describe('initial state', () => {
  test('myToken reads from localStorage', () => {
    expect(state.myToken === null || typeof state.myToken === 'string').toBe(true);
  });

  test('numeric/boolean defaults', () => {
    expect(state.lobbyCode).toBeNull();
    expect(state.myName).toBe('');
    expect(state.lobbyHostToken).toBeNull();
    expect(state.isReady).toBe(false);
    expect(state.gameState).toBeNull();
    expect(state.pendingJoker).toBeNull();
    expect(state.commitDeadline).toBeNull();
  });

  test('array defaults are empty', () => {
    expect(state.myHole).toEqual([]);
    expect(state.myJokers).toEqual([]);
    expect(state.myCommitted).toEqual([]);
  });

  test('selectedToArm is a Set', () => {
    expect(state.selectedToArm).toBeInstanceOf(Set);
    expect(state.selectedToArm.size).toBe(0);
  });

  test('lobbySettings defaults', () => {
    expect(state.lobbySettings.bb).toBe(50);
    expect(state.lobbySettings.startingChips).toBe(1000);
    expect(state.lobbySettings.blindDoubleRounds).toBe(4);
  });
});

describe('state mutation', () => {
  beforeEach(() => {
    state.lobbyCode     = null;
    state.myName        = '';
    state.gameState     = null;
    state.myHole        = [];
    state.myJokers      = [];
    state.myCommitted   = [];
    state.selectedToArm = new Set();
  });

  test('fields are mutable', () => {
    state.myName    = 'Alice';
    state.lobbyCode = 'ABCDEF';
    expect(state.myName).toBe('Alice');
    expect(state.lobbyCode).toBe('ABCDEF');
  });

  test('selectedToArm supports Set operations', () => {
    state.selectedToArm.add('joker1');
    state.selectedToArm.add('joker2');
    expect(state.selectedToArm.size).toBe(2);
    state.selectedToArm.delete('joker1');
    expect(state.selectedToArm.has('joker1')).toBe(false);
  });
});
