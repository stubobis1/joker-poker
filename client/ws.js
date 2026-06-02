import { SERVER_WS } from './config.js';
import { state } from './state.js';
import { showScreen, showError } from './ui.js';
import { renderWaitingRoom } from './waiting.js';
import { renderGame, renderMyCards, renderGameOver } from './game.js';
import { renderCommitScreen } from './commit.js';
import { renderJokerHand, renderArmedJokers, showJokerReveal, addJokerFeedEntry, clearJokerFeed, showJokerError } from './jokers.js';

function randomHex(len) {
  return Array.from(crypto.getRandomValues(new Uint8Array(len)))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, len);
}

let ws = null;

export const send = obj => {
  console.log('[ws] send ->', obj);
  if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(obj));
};

export function connectWS(code, name) {
  state.lobbyCode = code;
  if (!state.myToken) {
    const shortId = randomHex(8);
    state.myToken = `${name.replace(/[^a-zA-Z0-9]/g, '_')}-${shortId}`;
    sessionStorage.setItem('playerToken', state.myToken);
  }
  const url = `${SERVER_WS}/game/${code}?name=${encodeURIComponent(name)}&token=${state.myToken}`;
  ws = new WebSocket(url);

  ws.addEventListener('open', () => {
    document.getElementById('waiting-code').textContent = code;
    showScreen('screen-waiting');
  });

  ws.addEventListener('message', e => {
    let msg;
    try { msg = JSON.parse(e.data); } catch { return; }
    if (msg.type !== 'game_state' && msg.type !== 'your_hand') console.log('[ws] recv <-', msg);
    else console.log('[ws] recv <-', msg.type);
    handleMessage(msg);
  });

  ws.addEventListener('close', event => {
    if (event.code === 4003) {
      state.lobbyCode = null;
      showScreen('screen-lobby');
      showError(document.getElementById('lobby-error'), 'Game already in progress.');
      return;
    }
    if (event.code === 4004) {
      state.lobbyCode = null;
      showScreen('screen-lobby');
      showError(document.getElementById('lobby-error'), 'Lobby not found.');
      return;
    }
    setTimeout(() => {
      if (state.lobbyCode) connectWS(state.lobbyCode, state.myName);
    }, 2000);
  });

  ws.addEventListener('error', () => ws.close());
}

export function handleMessage(msg) {
  switch (msg.type) {
    case 'your_token':
      state.myToken = msg.token;
      sessionStorage.setItem('playerToken', state.myToken);
      break;

    case 'lobby_state':
      state.lobbyHostToken = msg.hostToken ?? null;
      if (msg.settings) state.lobbySettings = msg.settings;
      if (!state.gameOverShowing) renderWaitingRoom(msg);
      break;

    case 'you_are_host':
      state.lobbyHostToken = state.myToken;
      renderWaitingRoom({ players: [], hostToken: state.myToken, settings: state.lobbySettings, started: false });
      break;

    case 'kicked':
      state.lobbyCode = null;
      ws?.close();
      showScreen('screen-lobby');
      showError(document.getElementById('lobby-error'), 'You were removed from the lobby by the host.');
      break;

    case 'game_state': {
      const prevPhase = state.gameState?.phase;
      state.gameState = msg.state;
      if (state.gameState.phase === 'committing' && prevPhase !== 'committing') clearJokerFeed();
      if (state.gameState.phase === 'committing') renderCommitScreen(prevPhase !== 'committing');
      else renderGame();
      break;
    }

    case 'your_hand':
      state.myHole             = msg.holeCards        ?? [];
      state.myJokers           = msg.jokers           ?? [];
      state.myCommitted        = msg.committed        ?? [];
      state.revealedOpponents  = msg.revealedOpponents ?? [];
      state.jokerPlaying = null;
      console.log(`[ws] your_hand: phase=${state.gameState?.phase ?? 'none'}, jokers=${state.myJokers.length}, hole=${state.myHole.length}, committed=${state.myCommitted.length}`);
      if (state.gameState?.phase === 'committing') renderCommitScreen(false);
      else { renderMyCards(); renderJokerHand(); renderArmedJokers(); }
      break;

    case 'event':
      if (state.gameState) renderGame();
      break;

    case 'joker_reveal':
      showJokerReveal(msg);
      break;

    case 'joker_played':
      addJokerFeedEntry(msg);
      break;

    case 'game_over':
      renderGameOver(msg);
      break;

    case 'error':
      console.error('[server error]', msg.message);
      showJokerError(msg.message);
      break;
  }
}
