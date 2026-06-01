export const showScreen = id => {
  console.log(`[ui] screen -> ${id}`);
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
};

export const showError = (el, msg) => {
  el.textContent = msg;
  el.classList.remove('hidden');
};
