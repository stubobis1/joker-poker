import { describe, test, expect, vi, beforeEach } from 'vitest';

vi.mock('../config.js',  () => ({ SERVER_WS: 'ws://localhost:3777', SERVER_HTTP: 'http://localhost:3777' }));
vi.mock('../ui.js',      () => ({ showScreen: vi.fn(), showError: vi.fn() }));
vi.mock('../waiting.js', () => ({ renderWaitingRoom: vi.fn() }));
vi.mock('../game.js',    () => ({ renderGame: vi.fn(), renderMyCards: vi.fn(), renderGameOver: vi.fn() }));
vi.mock('../commit.js',  () => ({ renderCommitScreen: vi.fn() }));
vi.mock('../jokers.js',  () => ({
  renderJokerHand: vi.fn(), renderArmedJokers: vi.fn(),
  showJokerReveal: vi.fn(), addJokerFeedEntry: vi.fn(),
  clearJokerFeed: vi.fn(), showJokerError: vi.fn(),
}));

const { handleMessage }                         = await import('../ws.js');
const { renderCommitScreen }                    = await import('../commit.js');
const { renderMyCards }                         = await import('../game.js');
const { renderJokerHand, addJokerFeedEntry,
        clearJokerFeed, showJokerError }         = await import('../jokers.js');
const { state }                                 = await import('../state.js');

const JOKERS = [
  { id: 'oracle',  name: 'Oracle',  desc: 'See next card.', category: 'info', rarity: 'common', timing: ['any'] },
  { id: 'redraw',  name: 'Redraw',  desc: 'Swap worst card.', category: 'hand', rarity: 'common', timing: ['preflop'] },
  { id: 'rebuy',   name: 'Rebuy',   desc: 'Add 200 chips.',  category: 'bet',  rarity: 'common', timing: ['any'] },
];

beforeEach(() => {
  vi.clearAllMocks();
  state.myHole      = [];
  state.myJokers    = [];
  state.myCommitted = [];
  state.gameState   = null;
});

describe('your_hand message', () => {
  test('populates state.myJokers', () => {
    state.gameState = { phase: 'preflop' };
    handleMessage({ type: 'your_hand', holeCards: ['Ah', 'Kd'], jokers: JOKERS, committed: [] });
    expect(state.myJokers).toHaveLength(3);
    expect(state.myJokers[0].id).toBe('oracle');
  });

  test('populates state.myHole', () => {
    state.gameState = { phase: 'preflop' };
    handleMessage({ type: 'your_hand', holeCards: ['Ah', 'Kd'], jokers: [], committed: [] });
    expect(state.myHole).toEqual(['Ah', 'Kd']);
  });

  test('populates state.myCommitted', () => {
    state.gameState = { phase: 'preflop' };
    const committed = [JOKERS[0]];
    handleMessage({ type: 'your_hand', holeCards: [], jokers: [], committed });
    expect(state.myCommitted).toHaveLength(1);
    expect(state.myCommitted[0].id).toBe('oracle');
  });

  test('defaults missing fields to empty arrays', () => {
    state.gameState = { phase: 'preflop' };
    handleMessage({ type: 'your_hand' });
    expect(state.myHole).toEqual([]);
    expect(state.myJokers).toEqual([]);
    expect(state.myCommitted).toEqual([]);
  });

  test('calls renderCommitScreen when phase is committing', () => {
    state.gameState = { phase: 'committing' };
    handleMessage({ type: 'your_hand', holeCards: [], jokers: JOKERS, committed: [] });
    expect(renderCommitScreen).toHaveBeenCalledOnce();
    expect(renderMyCards).not.toHaveBeenCalled();
    expect(renderJokerHand).not.toHaveBeenCalled();
  });

  test('renderCommitScreen sees jokers already in state', () => {
    state.gameState = { phase: 'committing' };
    let jokersAtRenderTime = [];
    renderCommitScreen.mockImplementation(() => {
      jokersAtRenderTime = [...state.myJokers];
    });
    handleMessage({ type: 'your_hand', holeCards: [], jokers: JOKERS, committed: [] });
    expect(jokersAtRenderTime).toHaveLength(3);
  });

  test('calls renderMyCards + renderJokerHand when phase is preflop', () => {
    state.gameState = { phase: 'preflop' };
    handleMessage({ type: 'your_hand', holeCards: ['Ah', 'Kd'], jokers: JOKERS, committed: [] });
    expect(renderMyCards).toHaveBeenCalledOnce();
    expect(renderJokerHand).toHaveBeenCalledOnce();
    expect(renderCommitScreen).not.toHaveBeenCalled();
  });

  test('calls renderMyCards + renderJokerHand when no gameState', () => {
    state.gameState = null;
    handleMessage({ type: 'your_hand', holeCards: [], jokers: [], committed: [] });
    expect(renderMyCards).toHaveBeenCalledOnce();
    expect(renderJokerHand).toHaveBeenCalledOnce();
    expect(renderCommitScreen).not.toHaveBeenCalled();
  });

  test('clears jokerPlaying on your_hand', () => {
    state.gameState  = { phase: 'preflop' };
    state.jokerPlaying = 'freeze';
    handleMessage({ type: 'your_hand', holeCards: [], jokers: [], committed: [] });
    expect(state.jokerPlaying).toBeNull();
  });
});

describe('joker_played message', () => {
  test('calls addJokerFeedEntry with message', () => {
    const msg = { type: 'joker_played', playerName: 'Alice', jokerId: 'freeze',
                  jokerName: 'Freeze', jokerDesc: 'No more raises.' };
    handleMessage(msg);
    expect(addJokerFeedEntry).toHaveBeenCalledWith(msg);
  });
});

describe('error message', () => {
  test('calls showJokerError with message text', () => {
    handleMessage({ type: 'error', message: 'Freeze is not committed' });
    expect(showJokerError).toHaveBeenCalledWith('Freeze is not committed');
  });
});

describe('game_state message - joker feed lifecycle', () => {
  test('clearJokerFeed called when transitioning into committing phase', () => {
    state.gameState = { phase: 'river' };
    handleMessage({ type: 'game_state', state: { phase: 'committing', players: [], actionIdx: -1 } });
    expect(clearJokerFeed).toHaveBeenCalledOnce();
  });

  test('clearJokerFeed not called when already in committing phase', () => {
    state.gameState = { phase: 'committing' };
    handleMessage({ type: 'game_state', state: { phase: 'committing', players: [], actionIdx: -1 } });
    expect(clearJokerFeed).not.toHaveBeenCalled();
  });

  test('clearJokerFeed not called on preflop→flop transition', () => {
    state.gameState = { phase: 'preflop' };
    handleMessage({ type: 'game_state', state: { phase: 'flop', players: [], actionIdx: -1 } });
    expect(clearJokerFeed).not.toHaveBeenCalled();
  });
});
