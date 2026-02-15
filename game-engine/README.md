# 🃏 Card Game Engine

A **fully generic multiplayer card game engine** built with FastAPI + WebSockets on the backend and Next.js 14 on the frontend. Any card game can be defined in a single JSON file — the engine reads it and runs a working multiplayer version.

Currently ships with a **complete, playable Exploding Kittens** implementation.

---

## 🗂 Project Structure

```
game-engine/
├── backend/
│   ├── app/
│   │   ├── main.py                  ← FastAPI entry point (game-agnostic)
│   │   ├── models/
│   │   │   └── game.py              ← Domain models (Card, Player, GameState…)
│   │   ├── schemas/
│   │   │   └── requests.py          ← API request/response schemas
│   │   ├── routers/
│   │   │   ├── rooms.py             ← HTTP REST endpoints
│   │   │   └── websocket.py         ← WebSocket real-time endpoint
│   │   ├── services/
│   │   │   ├── game_loader.py       ← Reads JSON → builds game state
│   │   │   ├── room_manager.py      ← In-memory rooms + broadcast
│   │   │   └── engines/
│   │   │       ├── exploding_kittens.py  ← EK-specific rules
│   │   │       └── generic.py            ← Fallback engine
│   │   └── games/
│   │       └── exploding_kittens.json   ← 🎮 Game definition
│   ├── requirements.txt
│   └── Dockerfile
│
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── page.tsx             ← Home: create / join room
│   │   │   ├── join/page.tsx        ← Join via code or link
│   │   │   └── room/[roomCode]/page.tsx  ← Active game room
│   │   ├── components/
│   │   │   ├── game/
│   │   │   │   ├── GameRoom.tsx     ← Main orchestrator
│   │   │   │   ├── GameCard.tsx     ← Generic card component
│   │   │   │   ├── GameTable.tsx    ← Table, deck, discard, opponents
│   │   │   │   ├── PlayerHand.tsx   ← Local player's hand
│   │   │   │   ├── GameLog.tsx      ← Scrolling event log
│   │   │   │   ├── PendingActionPanel.tsx  ← Modals for Favor, Nope, etc.
│   │   │   │   └── SeeTheFutureModal.tsx
│   │   │   └── lobby/
│   │   │       └── Lobby.tsx        ← Waiting room UI
│   │   ├── hooks/
│   │   │   ├── useGameSocket.ts     ← Auto-reconnecting WebSocket
│   │   │   └── useGameActions.ts    ← Action dispatch helpers
│   │   ├── lib/
│   │   │   └── api.ts               ← Typed API client
│   │   └── types/
│   │       └── game.ts              ← TypeScript interfaces
│   ├── package.json
│   └── Dockerfile
│
└── docker-compose.yml
```

---

## 🚀 Quick Start

### Without Docker

**Backend:**
```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

**Frontend:**
```bash
cd frontend
cp .env.local.example .env.local   # edit if your backend isn't on :8000
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### With Docker Compose
```bash
docker compose up --build
```

---

## 🎮 How to Play (Exploding Kittens)

1. **Create a room** — enter your name, choose Exploding Kittens, click Create.
2. **Share the link** — click "Copy Invite Link" in the lobby and send it to friends (or share the 6-digit room code directly).
3. **Friends join** — they visit `/join?room=XXXXXX` or paste the link, enter their name.
4. **Host starts** — once 2–5 players are in the lobby, the host clicks "Start Game".
5. **Play!**

### Card interactions
| Card | How to use |
|------|-----------|
| Action cards (Skip, Attack, Shuffle, See Future) | Click the card in your hand |
| Favor | Click Favor → choose a target player |
| Cat combos (Taco, Rainbow, Beard, etc.) | Click first cat, then click a matching cat, then choose a target |
| Nope | When a Nope button appears, click it to cancel an action |
| Defuse | Automatically used when you draw an Exploding Kitten |
| Bomb placement | After defusing, drag the slider to choose where to reinsert the bomb |

---

## ➕ Adding a New Game (e.g. Uno)

1. Create `backend/app/games/uno.json` following the schema below.
2. *(Optional)* Create `backend/app/services/engines/uno.py` for game-specific rules. If absent, the generic engine is used.
3. That's it — the game appears in the frontend dropdown automatically.

### JSON Game Definition Schema

```json
{
  "id": "my_game",
  "name": "My Card Game",
  "description": "...",

  "rules": {
    "minPlayers": 2,
    "maxPlayers": 8,
    "handSize": 7,
    "turnStructure": {
      "phases": [
        { "id": "play", "name": "Play a Card", "description": "...", "isOptional": false },
        { "id": "draw", "name": "Draw", "description": "...", "isOptional": true }
      ],
      "canPassTurn": true,
      "mustPlayCard": false,
      "drawCount": 1
    },
    "winCondition": {
      "type": "empty_hand",
      "description": "First player to empty their hand wins!"
    },
    "specialRules": []
  },

  "cards": [
    {
      "id": "card_key",          // unique identifier
      "name": "Card Name",
      "type": "action",          // action | defense | reaction | special | combo
      "subtype": "card_key",     // used by the engine for effect logic
      "emoji": "🃏",
      "description": "What this card does",
      "effects": [
        {
          "type": "skip",        // effect type for engine logic
          "target": "self",      // self | others | choose | all
          "description": "...",
          "metadata": {}
        }
      ],
      "isPlayable": true,
      "isReaction": false,       // true = can be played out of turn
      "count": 4,                // copies in the deck
      "metadata": {}
    }
  ],

  "ui": {
    "tableBackground": "#1a472a",
    "turnPrompt": "It's your turn!",
    "winMessage": "🎉 {playerName} wins!",
    "actionLabels": {
      "draw_card": "Draw",
      "play_card": "Play"
    }
  }
}
```

### Custom Engine Module (optional)

If you need game-specific rules (e.g. Uno's draw-2, reverse, wild), create:
`backend/app/services/engines/my_game.py`

It must export two functions:

```python
def setup_game(state: GameState) -> None:
    """Deal cards, set up zones, set state.phase = 'playing'."""
    ...

def apply_action(state: GameState, action: ActionRequest) -> tuple[bool, str, list[str]]:
    """Returns (success, error_message, triggered_effects)."""
    ...
```

---

## 🔌 API Reference

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/games` | List available game types |
| POST | `/api/rooms/create` | Create a new room |
| POST | `/api/rooms/{code}/join` | Join a room |
| POST | `/api/rooms/{code}/start?player_id=X` | Start the game (host only) |
| POST | `/api/rooms/{code}/action` | Send a game action |
| GET | `/api/rooms/{code}/state` | Get current game state |
| WS | `/ws/{code}/{playerId}` | Real-time state updates |

### Action types (Exploding Kittens)

| type | Extra fields | Description |
|------|-------------|-------------|
| `draw_card` | — | Draw the top card of the deck |
| `play_card` | `cardId`, optional `targetPlayerId`, optional `metadata.comboPairId` | Play a card from hand |
| `nope` | `cardId` | Play a Nope to cancel a pending action |
| `select_target` | `targetPlayerId` or `metadata.cardId` | Resolve Favor target |
| `insert_exploding` | `metadata.position` | Place bomb back in deck after defusing |

---

## 🏗 Architecture Notes

- **State is fully server-side.** The client never modifies state locally — it only sends actions and receives broadcasts.
- **Per-player state masking.** Each WebSocket broadcast sends a personalised view with other players' hands hidden.
- **Game engines are pluggable.** `game_loader._get_engine(game_type)` dynamically imports the engine by name, falling back to `generic.py`.
- **JSON-driven card data.** Card definitions, rules, and UI strings all live in the JSON file. The engine modules handle only the imperative logic.
- **Pydantic v2 models** throughout — all state is validated and serialised consistently.

---

## 🧩 Extending the Generic Engine

The `generic.py` engine handles:
- Drawing cards
- Playing cards (discard + log)
- `empty_hand` win condition

For more complex games, override `setup_game` and `apply_action` in a dedicated engine module.
