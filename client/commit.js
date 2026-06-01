import { state } from './state.js';
import { showScreen } from './ui.js';
import { send } from './ws.js';
import { makeJokerCard } from './jokers.js';

export function renderCommitScreen() {
  showScreen('screen-commit');
  state.selectedToArm.clear();
  updateCommitCount();

  const maxArm = state.gameState?.jokerSettings?.maxJokersPerRound ?? Infinity;
  console.log(`[commit] renderCommitScreen: ${state.myJokers.length} jokers, maxArm=${maxArm}`);

  const list = document.getElementById('commit-joker-list');
  list.innerHTML = '';

  state.myJokers.forEach(j => {
    const card = makeJokerCard(j, false);
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

  state.commitDeadline = Date.now() + 15000;
  startCommitCountdown();
  document.getElementById('commit-waiting').classList.add('hidden');
}

const updateCommitCount = () => {
  const max = state.gameState?.jokerSettings?.maxJokersPerRound;
  const maxStr = max != null ? `/${max}` : '';
  document.getElementById('commit-count').textContent = `${state.selectedToArm.size}${maxStr}`;
};

function startCommitCountdown() {
  const fill  = document.getElementById('commit-timer-fill');
  const total = 15000;
  const tick  = () => {
    const remaining = Math.max(0, state.commitDeadline - Date.now());
    fill.style.width = `${(remaining / total) * 100}%`;
    if (remaining > 0 && state.gameState?.phase === 'committing') requestAnimationFrame(tick);
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
