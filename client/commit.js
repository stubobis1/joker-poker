import { state } from './state.js';
import { showScreen } from './ui.js';
import { send } from './ws.js';
import { makeJokerCard } from './jokers.js';

let countdownStarted = false;

export function renderCommitScreen(isFirstEntry = false) {
  showScreen('screen-commit');

  if (isFirstEntry) {
    countdownStarted = false;
    state.selectedToArm.clear();
    document.getElementById('commit-waiting').classList.add('hidden');
    document.getElementById('commit-timer-row').classList.add('hidden');
    document.getElementById('commit-timer-fill').style.width = '100%';
    document.getElementById('commit-timer-text').textContent = '';
    document.getElementById('btn-commit').disabled = false;
  }

  if (!countdownStarted && state.gameState?.commitDeadline) {
    countdownStarted = true;
    state.commitTimerTotal = Math.max(1000, state.gameState.commitDeadline - Date.now());
    document.getElementById('commit-timer-row').classList.remove('hidden');
    startCommitCountdown();
  }

  updateCommitCount();
  renderPlayerCommitStatus();

  const maxArm = state.gameState?.jokerSettings?.maxJokersPerRound ?? Infinity;
  console.log(`[commit] renderCommitScreen: ${state.myJokers.length} jokers, maxArm=${maxArm}, isFirstEntry=${isFirstEntry}`);

  const list = document.getElementById('commit-joker-list');
  list.innerHTML = '';

  state.myJokers.forEach(j => {
    const card = makeJokerCard(j, false);
    if (state.selectedToArm.has(j.id)) card.classList.add('selected');
    card.addEventListener('click', () => {
      if (state.selectedToArm.has(j.id)) {
        state.selectedToArm.delete(j.id);
        card.classList.remove('selected');
      } else {
        if (state.selectedToArm.size >= maxArm) return;
        state.selectedToArm.add(j.id);
        card.classList.add('selected');
      }
      updateCommitCount();
    });
    list.appendChild(card);
  });
}

const updateCommitCount = () => {
  const max = state.gameState?.jokerSettings?.maxJokersPerRound;
  const maxStr = max != null ? `/${max}` : '';
  document.getElementById('commit-count').textContent = `${state.selectedToArm.size}${maxStr}`;
};

function renderPlayerCommitStatus() {
  const el = document.getElementById('commit-players');
  if (!el) return;
  el.innerHTML = '';
  (state.gameState?.players ?? [])
    .filter(p => !p.sittingOut)
    .forEach(p => {
      const row = document.createElement('div');
      row.className = `commit-player-row${p.hasCommitted ? ' committed' : ''}`;
      const count = p.hasCommitted ? ` (${p.commitCount} armed)` : '';
      row.textContent = `${p.name}${count}`;
      el.appendChild(row);
    });
}

function autoCommit() {
  const me = state.gameState?.players?.find(p => p.token === state.myToken);
  if (me?.hasCommitted) return;
  const btn = document.getElementById('btn-commit');
  if (btn.disabled) return;
  send({ type: 'commit_jokers', joker_ids: [...state.selectedToArm] });
  btn.disabled = true;
  const waiting = document.getElementById('commit-waiting');
  waiting.textContent = 'Waiting for other players…';
  waiting.classList.remove('hidden');
  document.querySelectorAll('#commit-joker-list .joker-card')
    .forEach(c => c.style.pointerEvents = 'none');
}

function startCommitCountdown() {
  const fill     = document.getElementById('commit-timer-fill');
  const textEl   = document.getElementById('commit-timer-text');
  const total    = state.commitTimerTotal;
  const tick     = () => {
    const deadline  = state.gameState?.commitDeadline;
    const remaining = deadline ? Math.max(0, deadline - Date.now()) : 0;
    fill.style.width = `${(remaining / total) * 100}%`;
    textEl.textContent = `${Math.ceil(remaining / 1000)}s`;
    if (remaining <= 0) { autoCommit(); return; }
    if (state.gameState?.phase === 'committing') requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

document.getElementById('btn-commit').addEventListener('click', () => {
  send({ type: 'commit_jokers', joker_ids: [...state.selectedToArm] });
  const btn = document.getElementById('btn-commit');
  btn.disabled = true;
  const waiting = document.getElementById('commit-waiting');
  waiting.textContent = 'Waiting for other players…';
  waiting.classList.remove('hidden');
  document.querySelectorAll('#commit-joker-list .joker-card')
    .forEach(c => c.style.pointerEvents = 'none');
});
