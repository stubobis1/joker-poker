# Joker Poker - Game Design & Technical Plan

## Overview

Texas Hold'em variant. Standard poker rules + per-player **Joker cards** with special abilities.
Play-money only. Mobile-first web app. Private lobbies via invite code.

---

## Game Rules

### Base: Texas Hold'em
Standard rules. Blinds, 4 betting streets (pre-flop / flop / turn / river), best 5-card hand wins.

### Hand Rankings

| Rank | Hand | Notes |
|------|------|-------|
| 1 | High Card | |
| 2 | One Pair | |
| 3 | Two Pair | |
| 4 | Three of a Kind | |
| 5 | Straight | |
| 6 | Flush | |
| 7 | Full House | |
| 8 | Four of a Kind | |
| 9 | Straight Flush | |
| 10 | Royal Flush | A-K-Q-J-10 same suit |
| 11 | Five of a Kind | Requires wild card or extra hole card |
| 12 | Flush House | Full house, all 5 same suit |
| 13 | Flush Five | Five of a kind, all 5 same suit |

Ranks 11–13 only possible via joker effects (wild card, extra hole cards, deck manipulation). Hand evaluator must support them.

### Deck / Card Manipulation
Some jokers may add or remove cards from the deck or from a player's hole cards. Hand evaluator must handle:
- Hole card counts other than 2 (e.g. 3 or 4 from jokers)
- Wild cards (rank/suit substitution)
- Community card count changes (Wildfire redeal, extra burn)
- Best-N-of-M selection when player holds more than 2 hole cards

### Side Pots
- Full side pot implementation
- Player can't post BB at hand start -> spectator (no mid-hand bust edge case from blinds)
- All-in mid-hand -> main pot capped at their contribution × eligible players; excess forms side pot
- Multiple all-ins -> multiple side pots, each with correct eligibility
- Server tracks: `pots: [{ amount, eligible_players[] }]`; resolved smallest-to-largest at showdown

### Jokers
- Each player carries a joker hand between hands (cap: 3); earn +1 at start of each new hand
- **Commit phase:** Before hole cards are dealt, each player selects which jokers (0–N) to arm. **Locked - no changes after deal.** Committed jokers placed face-down; opponents see count but not type.
- **Arming costs the joker** - committed jokers are spent regardless of whether you activate them. Bluffing with a joker is a real sacrifice.
- **Play:** Any time you have action, flip a committed joker face-up and activate its effect
- At end of hand, each player draws 1 new joker (replacing spent/committed ones), up to cap of 3
- Uncommitted jokers stay in hand untouched
- Some jokers specify a restricted window (e.g., "pre-flop only", "before showdown")
- No interrupts - jokers only play on your own action turn

### Commit Phase Bluffing
Committing a joker face-down without playing it is legal. Opponents see you armed a joker and must guess whether you'll use it. Creates psychological pressure even without spending a joker.

---

## Joker Card Categories

### Hand Manipulation
| Joker | Effect | Timing |
|-------|--------|--------|
| Fresh Deal | Discard both hole cards, draw 2 new ones | Pre-flop only |
| Hot Swap | Swap one hole card with a random community card | Flop / Turn |
| Peek | Look at one opponent's hole card (private) | Any action |
| Extra Card | Draw a 3rd hole card; use best 2 of 3 | Pre-flop / Flop |

### Bet Manipulation
| Joker | Effect | Timing |
|-------|--------|--------|
| Double Blind | Double the current BB for this hand | Pre-flop (before action) |
| Half Time | Cut current bet/raise in half (round down) | Interrupt: opponent raises |
| Forced Check | Force one opponent to check (can't bet/raise) | Any street, before their action |
| All-In Shield | You cannot be raised above a call this hand | Any action |

### Information Jokers
| Joker | Effect | Timing |
|-------|--------|--------|
| Oracle | See the next community card before it flips (private) | Before Turn or River |
| Tell | See one opponent's hole card for 5 seconds | Any action |
| X-Ray | See all opponents' hole cards for 3 seconds | Expensive / rare |

### Chaos Jokers
| Joker | Effect | Timing |
|-------|--------|--------|
| Wildfire | Redeal all community cards (burn current board) | Flop only |
| Wild Round | One community card becomes a wild for this hand | Before River |
| 4th Hole | Everyone draws a 4th hole card | Pre-flop only |
| Deck Shuffle | Shuffle remaining deck (disrupts oracle users) | Any time |

### Money Jokers
| Joker | Effect | Timing |
|-------|--------|--------|
| Pot Stuffer | Add X chips to pot from thin air | Any street |
| Robin Hood | Steal 10% of chip leader's stack | Any action |
| Tax Man | You receive 20% of pot at showdown, win or lose | Before showdown |
| Jackpot | Double your chip stack (rare, costs 2 jokers) | Any action |

---

## Joker Distribution

- Draw pool is configurable per lobby (host selects which jokers are in play)
- Each new hand: player receives 1 joker drawn randomly from pool, up to cap of 3
- Unplayed jokers persist between hands
- Jokers are face-down (opponents see count, not type)

---

## Player Flow

```
Create/Join Lobby
    └── Host sets: starting chips, BB, joker pool, max players
    └── Share 6-char code

Waiting Room
    └── Players join via code
    └── Ready-up when full
    └── Host starts game

Game Loop
    └── Each player earns +1 joker (up to cap 3)
    └── Commit phase: players select jokers to arm (face-down, visible count only)
    └── Blinds posted
    └── Hole cards dealt
    └── Betting streets: Pre-Flop -> Flop -> Turn -> River
        └── Each action: check / call / raise / fold / [flip + activate committed joker]
    └── Showdown or last-player-standing
    └── Chips awarded
    └── All committed jokers discarded (played or not)
    └── Each player draws 1 new joker (up to cap 3)
    └── Next hand

Game End (session)
    └── One player has all chips (or host ends game)
    └── Final standings shown
    └── Busted players become spectators; all players reset to starting chips for next game
    └── Lobby persists - host can start new game with same group
```

---

## Tech Stack

### Client: HTML/CSS/JS (Vanilla)
- Vanilla JS + HTML/CSS - no framework, no build step
- Hosted on **GitHub Pages** (static, repo `/docs` folder or `gh-pages` branch)
- Native browser `WebSocket` API connects to game server over WSS
- Mobile-first UI: **portrait**
- Single-page app - lobby entry, game table, results all in one page
- `localStorage` for `playerToken` persistence

### Server: Node.js WebSocket Server
- Node.js + `ws` library (lightweight, no Socket.io overhead)
- **Dockerized** - single `Dockerfile`, deploy to GCP Cloud Run
- All game logic server-authoritative; clients are dumb renderers
- HTTP endpoints for lobby lifecycle; WebSocket for all real-time events

### State Architecture
- **Phase 1:** In-memory state (single Cloud Run instance, `minInstances: 1`)
- **Phase 2+:** Extract to Redis (Upstash free tier) for horizontal scaling
- Code written stateless-friendly from day one (state accessed via a `StateStore` interface, swap impl later)

### Identity
- First visit: generate UUID `playerToken`, store in `localStorage`
- Display name entered per session, associated with token
- Server stores per-token stats (hands played, wins, jokers used) in Redis/memory
- Reconnect: same `playerToken` -> server restores seat if hand still active

### Reconnect
- Disconnect -> 30s grace timer starts, other players notified
- Reconnect within 30s with same `playerToken` -> restore seat + state
- Timeout -> auto-fold; player becomes spectator; rejoins next game

### Deployment
- **Server:** GCP Cloud Run (Dockerized Node.js, free tier, `minInstances: 1` to avoid cold-start WS drops)
- **Client:** GitHub Pages (static HTML/JS, `/docs` folder)
- Both on HTTPS/WSS (Cloud Run provides TLS automatically)
- CORS: server whitelist GitHub Pages origin

### Lobby System
- `POST /lobby` -> `{ code: "XYZ123" }` (host gets first WS connection)
- `GET /lobby/:code` -> `{ playerCount, maxPlayers, started }`
- WS: `wss://server/game/:code?name=PlayerName&token=UUID`
- Server broadcasts to all connections in room keyed by code

---

## Server Message Protocol

### Client -> Server
```json
{ "type": "join",          "name": "string", "token": "uuid" }
{ "type": "ready" }
{ "type": "commit_jokers", "joker_ids": ["string"] }
{ "type": "action",        "action": "check|call|raise|fold", "amount": 0 }
{ "type": "play_joker",    "joker_id": "string", "target": "player_id|null" }
```

### Server -> All Clients (broadcast)
```json
{ "type": "lobby_state",   "players": [...], "started": false }
{ "type": "game_state",    "state": { ...full } }
{ "type": "event",         "event": "fold|raise|check|call|joker_played|hand_end", "data": {} }
{ "type": "committed",     "player_id": "string", "count": 2 }
{ "type": "joker_played",  "player_id": "string", "joker_name": "string", "effect_desc": "string" }
{ "type": "player_left",   "player_id": "string", "timeout_in": 30 }
```

### Server -> Single Client (private)
```json
{ "type": "your_hand",     "cards": ["Ah","Kd"], "jokers": [{"id":"...","name":"..."}] }
{ "type": "your_token",    "token": "uuid" }
{ "type": "error",         "message": "string" }
```

### Sync Strategy
- Full `game_state` sent on: join/reconnect, every 5 events, hand start
- `event` deltas sent for everything in between
- Client applies deltas; discards if sequence gap detected -> request full sync

> **BB stacking:** Multiple Double Blind jokers multiply. 2 players each play it -> 4× BB. No cap.

---

## Phases

### Phase 1 - Core Poker

#### Server (complete)
- [x] Node.js server scaffolded + Dockerized (`server/Dockerfile`, `docker-compose.yml`)
- [x] Local dev: `docker compose watch` -> server at `ws://localhost:3000`
- [x] Lobby create/join - `POST /lobby`, `GET /lobby/:code`, WS `/game/:code`
- [x] Standard Texas Hold'em game loop: deal, blinds, streets, showdown, chip transfer
- [x] Side pot logic: `pots[]`, all-in detection, eligibility tracking, showdown resolution
- [x] Hand evaluator: ranks 1–13 (High Card -> Flush Five), best-N-of-M selection
- [x] Player identity: `playerToken` UUID over WS query param, reconnect restores seat
- [x] 77 unit tests passing (`npm test`) - deck, eval, full game state machine
- [ ] Cloud Run deploy + HTTPS/WSS (not yet deployed)
- [ ] Reconnect: 30s grace timer + auto-fold (stub in socket.js - TODO)
- [ ] Server stats store (hands played, wins - deferred to Phase 2)

#### Client (not started)
- [ ] `/client` folder: `index.html`, `style.css`, `app.js`
- [ ] Screens: lobby entry -> waiting room -> game table -> results
- [ ] WS connection + message handling (`your_token`, `game_state`, `event`)
- [ ] `localStorage` token persistence + reconnect on page reload
- [ ] Portrait game table: community cards, player chips/bets, hole cards, action buttons
- [ ] GitHub Pages deploy (push `/client` -> `gh-pages` or `/docs`)

### Phase 2 - Joker System
- [ ] Joker data model (id, name, effect, timing, rarity)
- [ ] Joker distribution logic (draw pool, per-hand earn)
- [ ] Client UI: joker hand display, play button
- [ ] Server-side joker effect handlers
- [ ] Start with 5-6 jokers across all categories

### Phase 3 - Polish
- [ ] Lobby host config (joker pool selection, blinds, chip counts)
- [ ] Animations (card flip, joker play effect)
- [ ] Sound
- [ ] Reconnect handling
- [ ] Player disconnect handling (auto-fold or pause)

### Phase 4 - Expand
- [ ] More jokers
- [ ] Joker rarity tiers
- [ ] Spectator mode
- [ ] Hand history

---

## Open Questions

1. ~~Commit phase timing: locked before deal.~~ ✓
2. ~~Commit bluff cost: arming spends the joker (played or not); draw 1 replacement at end of hand.~~ ✓
3. **Joker-specific interactions:** Deferred - design individual jokers when Phase 2 begins.
4. ~~Mobile UI: portrait.~~ ✓
5. ~~Chip floor: full side pots implemented. Bust threshold = stack < BB at hand start -> spectator.~~ ✓
