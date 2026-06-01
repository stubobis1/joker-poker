export const state = {
  myToken:        sessionStorage.getItem('playerToken') || null,
  lobbyCode:      null,
  myName:         '',
  lobbyHostToken: null,
  lobbySettings:  { bb: 50, startingChips: 1000, startingJokers: 3, jokersPerRound: 1, maxJokers: 3, maxJokersPerRound: 3, blindDoubleRounds: 4 },
  isReady:        false,
  gameOverShowing: false,
  gameState:      null,
  myHole:         [],
  myJokers:       [],
  myCommitted:    [],
  selectedToArm:  new Set(),
  pendingJoker:   null,
  jokerPlaying:   null,
  commitTimerTotal: 15000,
  showdownFeedAdded: false,
  revealedOpponents: [],  // [{ token, name, cards }] from tell joker
};
