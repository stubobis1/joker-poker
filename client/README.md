# Joker Poker - Client

Browser client for Joker Poker: a Texas Hold'em variant where players collect and secretly arm special Joker cards each hand.

**Live:** https://stubobis1.github.io/joker-poker/

## How to play

1. Open the app and enter your name
2. Leave the lobby code blank to **create** a lobby, or enter a code to **join**
3. Share the 6-character code (or invite link) with other players
4. Host configures game settings and starts the game

### Jokers

Each player holds a hand of Joker cards with unique effects. Before each hand, players secretly **arm** some of their jokers - opponents see how many are armed, not which ones. Armed jokers are spent whether played or not. Play a joker at the right moment to swing the hand.

## Running locally

Requires the server running at `localhost:3777` (see [server/](../server/)).

```bash
# No build step needed - open directly in a browser
# Or serve with any static file server:
npx serve .
```

Then open `index.html`.

## Development

```bash
npm install
npm test        # run tests once
npm run test:watch  # watch mode
```

## File structure

```
client/
  index.html      # entry point
  app.js          # module entry - imports all screens
  config.js       # server URL config (edit for production)
  state.js        # shared client state
  ws.js           # WebSocket connection + message handler
  lobby.js        # lobby entry screen
  waiting.js      # waiting room screen
  commit.js       # joker arming (commit) phase
  game.js         # game table screen
  jokers.js       # joker card rendering + play UI
  cards.js        # card formatting + SVG rendering
  ui.js           # shared UI utilities
  dist/           # suit SVGs
  test/           # vitest unit tests
```

## Configuration

Edit `config.js` to point at a deployed server:

```js
export const SERVER_HTTP = 'https://your-server.com';
export const SERVER_WS   = 'wss://your-server.com';
```
