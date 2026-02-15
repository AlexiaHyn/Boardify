"""
Multiplayer Card Game API — Exploding Kittens
FastAPI + WebSockets: each game room has a WebSocket broadcast channel.
Players join by sharing a URL containing the room code.
"""

from __future__ import annotations

import asyncio
import json
import random
import string
import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional, Set
from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

app = FastAPI(title="Multiplayer Card Game API", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── In-memory store ───────────────────────────────────────────────────────────
# rooms[room_code] = { "state": GameState dict, "connections": set of WebSocket }
ROOMS: Dict[str, Dict] = {}
# room_connections[room_code] = { player_id: WebSocket }
ROOM_CONNECTIONS: Dict[str, Dict[str, WebSocket]] = {}


# ── Pydantic models ───────────────────────────────────────────────────────────

class CardEffect(BaseModel):
    type: str
    value: Optional[int] = None
    target: Optional[str] = None
    description: str


class Card(BaseModel):
    id: str
    name: str
    type: str
    subtype: Optional[str] = None
    emoji: Optional[str] = None
    description: str
    effects: List[CardEffect]
    isPlayable: bool = True
    metadata: Dict[str, Any] = {}


class Hand(BaseModel):
    playerId: str
    cards: List[Card]
    isVisible: bool = True


class Player(BaseModel):
    id: str
    name: str
    emoji: Optional[str] = None
    status: str = "waiting"   # waiting | active | eliminated | winner
    hand: Hand
    isCurrentTurn: bool = False
    isLocalPlayer: bool = False  # set per-client, not stored server-side
    isConnected: bool = False
    metadata: Dict[str, Any] = {}


class Zone(BaseModel):
    id: str
    name: str
    type: str
    cards: List[Card]
    isPublic: bool
    maxCards: Optional[int] = None


class TurnPhase(BaseModel):
    id: str
    name: str
    description: str
    isOptional: bool


class TurnStructure(BaseModel):
    phases: List[TurnPhase]
    canPassTurn: bool
    mustPlayCard: bool
    drawCount: int


class WinCondition(BaseModel):
    type: str
    description: str


class SpecialRule(BaseModel):
    id: str
    name: str
    trigger: str
    description: str
    metadata: Dict[str, Any] = {}


class GameRules(BaseModel):
    minPlayers: int
    maxPlayers: int
    handSize: int
    turnStructure: TurnStructure
    winCondition: WinCondition
    specialRules: List[SpecialRule]


class LogEntry(BaseModel):
    id: str
    timestamp: int
    message: str
    type: str
    playerId: Optional[str] = None
    cardId: Optional[str] = None


class GameState(BaseModel):
    gameId: str
    roomCode: str
    gameName: str
    phase: str   # lobby | playing | ended
    players: List[Player]
    zones: List[Zone]
    currentTurnPlayerId: str = ""
    turnNumber: int = 0
    rules: GameRules
    log: List[LogEntry]
    winner: Optional[Player] = None
    metadata: Dict[str, Any] = {}


# ── Request models ────────────────────────────────────────────────────────────

class CreateRoomRequest(BaseModel):
    host_name: str


class JoinRoomRequest(BaseModel):
    player_name: str


class ActionRequest(BaseModel):
    type: str
    playerId: str
    cardId: Optional[str] = None
    targetPlayerId: Optional[str] = None
    metadata: Dict[str, Any] = {}


# ── EK Rules ──────────────────────────────────────────────────────────────────

EK_RULES = GameRules(
    minPlayers=2,
    maxPlayers=5,
    handSize=7,
    turnStructure=TurnStructure(
        phases=[
            TurnPhase(id="play", name="Play Cards", description="Play any number of action cards", isOptional=True),
            TurnPhase(id="draw", name="Draw Card", description="Draw the top card of the deck", isOptional=False),
        ],
        canPassTurn=False,
        mustPlayCard=False,
        drawCount=1,
    ),
    winCondition=WinCondition(type="last_standing", description="Be the last player not to explode!"),
    specialRules=[
        SpecialRule(id="nope_nope", name="Nope a Nope", trigger="on_play",
                    description="A Nope can be Noped.", metadata={}),
        SpecialRule(id="cat_combo", name="Cat Combos", trigger="on_play",
                    description="Play 2 matching cat cards to steal a random card.", metadata={}),
    ],
)

EMOJIS = ["🐱", "🐶", "🦊", "🐻", "🐼"]


# ── Helpers ───────────────────────────────────────────────────────────────────

def make_room_code() -> str:
    return "".join(random.choices(string.ascii_uppercase + string.digits, k=6))


def ts() -> int:
    return int(datetime.now().timestamp() * 1000)


def log(message: str, type_: str = "action", player_id: str = None, card_id: str = None) -> LogEntry:
    return LogEntry(id=str(uuid.uuid4()), timestamp=ts(), message=message,
                    type=type_, playerId=player_id, cardId=card_id)


def make_card(subtype: str, index: int) -> Card:
    defs = {
        "defuse":    ("Defuse",           "defense",  "🔧", "Defuse an Exploding Kitten. Slip it back into the deck.",
                      [CardEffect(type="defuse", target="self", description="Defuse the explosion")], False),
        "exploding": ("Exploding Kitten", "special",  "💣", "BOOM! You explode — unless you have a Defuse.",
                      [CardEffect(type="explode", target="self", description="Eliminate unless defused")], False),
        "attack":    ("Attack",           "action",   "⚔️",  "End your turn without drawing. Next player takes 2 turns.",
                      [CardEffect(type="attack", value=2, target="others", description="Force 2 turns on next player")], True),
        "skip":      ("Skip",             "action",   "⏭️",  "End your turn without drawing a card.",
                      [CardEffect(type="skip", target="self", description="Skip your draw")], True),
        "nope":      ("Nope",             "reaction", "🚫", "Cancel any action card (not Defuse or Exploding Kitten).",
                      [CardEffect(type="cancel", target="others", description="Cancel any action")], True),
        "see_future":("See the Future",   "action",   "🔮", "Peek at the top 3 cards of the draw pile.",
                      [CardEffect(type="peek", value=3, target="self", description="View top 3 cards")], True),
        "shuffle":   ("Shuffle",          "action",   "🔀", "Shuffle the draw pile.",
                      [CardEffect(type="shuffle", target="all", description="Shuffle the draw pile")], True),
        "favor":     ("Favor",            "action",   "🙏", "Force another player to give you a card of their choice.",
                      [CardEffect(type="steal", value=1, target="choose", description="Take a card from any player")], True),
        "taco":      ("Taco Cat",         "combo",    "🌮", "Pair with another cat card to steal a random card.",
                      [CardEffect(type="combo_steal", target="choose", description="Pair to steal")], True),
        "rainbow":   ("Rainbow Cat",      "combo",    "🌈", "Pair with another cat card to steal a random card.",
                      [CardEffect(type="combo_steal", target="choose", description="Pair to steal")], True),
        "beard":     ("Beard Cat",        "combo",    "😺", "Pair with another cat card to steal a random card.",
                      [CardEffect(type="combo_steal", target="choose", description="Pair to steal")], True),
    }
    name, type_, emoji, desc, effects, playable = defs[subtype]
    return Card(id=f"{subtype}_{index}", name=name, type=type_, subtype=subtype,
                emoji=emoji, description=desc, effects=effects, isPlayable=playable)


def build_base_deck() -> List[Card]:
    deck = []
    counts = {"attack": 4, "skip": 4, "nope": 5, "see_future": 5,
              "shuffle": 4, "favor": 4, "taco": 4, "rainbow": 4, "beard": 4}
    for subtype, count in counts.items():
        for i in range(count):
            deck.append(make_card(subtype, i))
    random.shuffle(deck)
    return deck


def get_active_players(state: GameState) -> List[Player]:
    return [p for p in state.players if p.status not in ("eliminated", "winner")]


def get_next_player(state: GameState) -> Optional[Player]:
    active = get_active_players(state)
    if not active:
        return None
    ids = [p.id for p in active]
    try:
        idx = ids.index(state.currentTurnPlayerId)
    except ValueError:
        return active[0]
    return active[(idx + 1) % len(active)]


def advance_turn(state: GameState):
    attacks = state.metadata.get("attacks_pending", 0)
    if attacks > 1:
        state.metadata["attacks_pending"] = attacks - 1
    else:
        state.metadata["attacks_pending"] = 0
        nxt = get_next_player(state)
        if nxt:
            for p in state.players:
                p.isCurrentTurn = p.id == nxt.id
            state.currentTurnPlayerId = nxt.id
            state.turnNumber += 1


# ── Game initialisation ───────────────────────────────────────────────────────

def start_game(state: GameState):
    """Deal cards and insert Exploding Kittens when the host starts the game."""
    deck = build_base_deck()
    n = len(state.players)

    for i, player in enumerate(state.players):
        defuse = make_card("defuse", i)
        hand_cards = [defuse] + [deck.pop() for _ in range(min(6, len(deck)))]
        player.hand = Hand(playerId=player.id, cards=hand_cards, isVisible=True)
        player.status = "active"
        player.isCurrentTurn = i == 0
        player.emoji = EMOJIS[i % len(EMOJIS)]

    for j in range(n - 1):
        deck.append(make_card("exploding", j))
    random.shuffle(deck)

    state.zones = [
        Zone(id="draw_pile",    name="Draw Pile",    type="deck",    cards=deck, isPublic=False),
        Zone(id="discard_pile", name="Discard Pile", type="discard", cards=[],   isPublic=True),
    ]
    state.currentTurnPlayerId = state.players[0].id
    state.turnNumber = 1
    state.phase = "playing"
    state.metadata["attacks_pending"] = 0
    state.log.append(log("🎮 Game started! Don't explode. 💣", "system"))


# ── Action handler ────────────────────────────────────────────────────────────

def apply_action(state: GameState, action: ActionRequest) -> tuple[bool, str, List[str]]:
    """Returns (success, error_msg, triggered_effects)."""
    player = next((p for p in state.players if p.id == action.playerId), None)
    if not player:
        return False, "Player not found", []

    draw_zone    = next((z for z in state.zones if z.id == "draw_pile"), None)
    discard_zone = next((z for z in state.zones if z.id == "discard_pile"), None)
    triggered    = []

    # ── draw_card ─────────────────────────────────────────────────────────────
    if action.type == "draw_card":
        if state.currentTurnPlayerId != player.id:
            return False, "Not your turn", []
        if not draw_zone or not draw_zone.cards:
            return False, "Draw pile is empty", []

        drawn = draw_zone.cards.pop(0)

        if drawn.subtype == "exploding":
            defuse = next((c for c in player.hand.cards if c.subtype == "defuse"), None)
            if defuse:
                player.hand.cards.remove(defuse)
                discard_zone.cards.insert(0, defuse)
                insert_pos = random.randint(0, len(draw_zone.cards))
                draw_zone.cards.insert(insert_pos, drawn)
                state.log.append(log(f"💥 {player.name} drew an Exploding Kitten… and Defused it! 😅", "effect", player.id))
                triggered.append("defused")
            else:
                player.status = "eliminated"
                discard_zone.cards.insert(0, drawn)
                state.log.append(log(f"💥 {player.name} EXPLODED! 😱", "effect", player.id))
                triggered.append("exploded")

            active = get_active_players(state)
            if len(active) == 1:
                active[0].status = "winner"
                state.winner = active[0]
                state.phase = "ended"
                state.log.append(log(f"🎉 {active[0].name} wins the game!", "system"))
                return True, "", triggered
        else:
            player.hand.cards.append(drawn)
            state.log.append(log(f"{player.name} drew a card.", "action", player.id))

        advance_turn(state)

    # ── play_card ─────────────────────────────────────────────────────────────
    elif action.type == "play_card":
        if state.currentTurnPlayerId != player.id:
            return False, "Not your turn", []
        card = next((c for c in player.hand.cards if c.id == action.cardId), None)
        if not card:
            return False, "Card not in hand", []

        player.hand.cards.remove(card)
        discard_zone.cards.insert(0, card)
        triggered.append(f"played:{card.subtype}")

        if card.subtype == "skip":
            state.log.append(log(f"{player.name} played Skip ⏭️", "action", player.id, card.id))
            attacks = state.metadata.get("attacks_pending", 0)
            if attacks > 0:
                state.metadata["attacks_pending"] = attacks - 1
            advance_turn(state)

        elif card.subtype == "attack":
            state.log.append(log(f"⚔️ {player.name} played Attack! Next player takes 2 turns.", "action", player.id, card.id))
            state.metadata["attacks_pending"] = state.metadata.get("attacks_pending", 0) + 2
            advance_turn(state)

        elif card.subtype == "shuffle":
            random.shuffle(draw_zone.cards)
            state.log.append(log(f"🔀 {player.name} shuffled the deck.", "action", player.id, card.id))

        elif card.subtype == "see_future":
            top3 = [c.name for c in draw_zone.cards[:3]]
            state.log.append(log(f"🔮 {player.name} peeked at the top 3 cards.", "action", player.id, card.id))
            triggered.append(f"top3:{','.join(top3)}")

        elif card.subtype == "favor":
            target = next((p for p in state.players if p.id == action.targetPlayerId), None)
            if target and target.hand.cards:
                stolen = random.choice(target.hand.cards)
                target.hand.cards.remove(stolen)
                player.hand.cards.append(stolen)
                state.log.append(log(f"🙏 {player.name} used Favor on {target.name} and took a card!", "action", player.id, card.id))
            else:
                state.log.append(log(f"{player.name} played Favor but target has no cards.", "action"))

        elif card.subtype == "nope":
            state.log.append(log(f"🚫 {player.name} played Nope!", "action", player.id, card.id))

        else:
            state.log.append(log(f"{player.name} played {card.name}.", "action", player.id, card.id))

    else:
        return False, f"Unknown action: {action.type}", []

    return True, "", triggered


# ── WebSocket connection manager ──────────────────────────────────────────────

async def broadcast(room_code: str, message: dict):
    """Send a message to all connected players in a room."""
    if room_code not in ROOM_CONNECTIONS:
        return
    dead = []
    for pid, ws in list(ROOM_CONNECTIONS[room_code].items()):
        try:
            await ws.send_text(json.dumps(message))
        except Exception:
            dead.append(pid)
    for pid in dead:
        ROOM_CONNECTIONS[room_code].pop(pid, None)


async def broadcast_state(room_code: str):
    """Broadcast the current game state to all players, masking other hands."""
    if room_code not in ROOMS:
        return
    raw_state = ROOMS[room_code]["state"]
    state = GameState(**raw_state)

    for pid in list(ROOM_CONNECTIONS.get(room_code, {}).keys()):
        ws = ROOM_CONNECTIONS[room_code].get(pid)
        if not ws:
            continue

        # Build a per-player view: hide other players' hands
        view = state.dict()
        for p in view["players"]:
            if p["id"] != pid:
                p["hand"]["cards"] = [{"id": "hidden", "name": "Hidden", "type": "hidden",
                                        "emoji": "🂠", "description": "", "effects": [],
                                        "isPlayable": False, "metadata": {}}
                                       for _ in p["hand"]["cards"]]
                p["isLocalPlayer"] = False
            else:
                p["isLocalPlayer"] = True

        try:
            await ws.send_text(json.dumps({"type": "state_update", "state": view}))
        except Exception:
            pass


# ── HTTP Routes ───────────────────────────────────────────────────────────────

@app.post("/api/rooms/create")
async def create_room(req: CreateRoomRequest):
    room_code = make_room_code()
    while room_code in ROOMS:
        room_code = make_room_code()

    player_id = str(uuid.uuid4())
    host = Player(
        id=player_id,
        name=req.host_name,
        emoji=EMOJIS[0],
        status="waiting",
        hand=Hand(playerId=player_id, cards=[], isVisible=True),
        isCurrentTurn=False,
        isConnected=False,
        metadata={"isHost": True},
    )

    state = GameState(
        gameId=str(uuid.uuid4()),
        roomCode=room_code,
        gameName="Exploding Kittens",
        phase="lobby",
        players=[host],
        zones=[],
        rules=EK_RULES,
        log=[log(f"🏠 Room {room_code} created by {req.host_name}.", "system")],
        metadata={"hostId": player_id, "attacks_pending": 0},
    )

    ROOMS[room_code] = {"state": state.dict()}
    ROOM_CONNECTIONS[room_code] = {}

    return {
        "success": True,
        "roomCode": room_code,
        "playerId": player_id,
        "gameId": state.gameId,
    }


@app.post("/api/rooms/{room_code}/join")
async def join_room(room_code: str, req: JoinRoomRequest):
    room_code = room_code.upper()
    if room_code not in ROOMS:
        raise HTTPException(status_code=404, detail="Room not found")

    state = GameState(**ROOMS[room_code]["state"])

    if state.phase != "lobby":
        raise HTTPException(status_code=400, detail="Game already started")
    if len(state.players) >= EK_RULES.maxPlayers:
        raise HTTPException(status_code=400, detail="Room is full (max 5 players)")

    # Prevent duplicate names
    existing_names = {p.name.lower() for p in state.players}
    if req.player_name.lower() in existing_names:
        raise HTTPException(status_code=400, detail="Name already taken in this room")

    player_id = str(uuid.uuid4())
    new_player = Player(
        id=player_id,
        name=req.player_name,
        emoji=EMOJIS[len(state.players) % len(EMOJIS)],
        status="waiting",
        hand=Hand(playerId=player_id, cards=[], isVisible=True),
        isConnected=False,
        metadata={"isHost": False},
    )
    state.players.append(new_player)
    state.log.append(log(f"👋 {req.player_name} joined the room!", "system"))

    ROOMS[room_code]["state"] = state.dict()
    await broadcast_state(room_code)

    return {"success": True, "playerId": player_id, "roomCode": room_code}


@app.post("/api/rooms/{room_code}/start")
async def start_room(room_code: str, player_id: str):
    room_code = room_code.upper()
    if room_code not in ROOMS:
        raise HTTPException(status_code=404, detail="Room not found")

    state = GameState(**ROOMS[room_code]["state"])
    host_id = state.metadata.get("hostId")

    if player_id != host_id:
        raise HTTPException(status_code=403, detail="Only the host can start the game")
    if len(state.players) < EK_RULES.minPlayers:
        raise HTTPException(status_code=400, detail=f"Need at least {EK_RULES.minPlayers} players")
    if state.phase != "lobby":
        raise HTTPException(status_code=400, detail="Game already started")

    start_game(state)
    ROOMS[room_code]["state"] = state.dict()
    await broadcast_state(room_code)

    return {"success": True}


@app.post("/api/rooms/{room_code}/action")
async def room_action(room_code: str, action: ActionRequest):
    room_code = room_code.upper()
    if room_code not in ROOMS:
        raise HTTPException(status_code=404, detail="Room not found")

    state = GameState(**ROOMS[room_code]["state"])
    if state.phase != "playing":
        raise HTTPException(status_code=400, detail="Game is not in progress")

    success, error, triggered = apply_action(state, action)
    if not success:
        raise HTTPException(status_code=400, detail=error)

    ROOMS[room_code]["state"] = state.dict()
    await broadcast_state(room_code)

    return {"success": True, "triggeredEffects": triggered}


@app.get("/api/rooms/{room_code}/state")
def get_room_state(room_code: str):
    room_code = room_code.upper()
    if room_code not in ROOMS:
        raise HTTPException(status_code=404, detail="Room not found")
    return {"success": True, "state": ROOMS[room_code]["state"]}


# ── WebSocket ─────────────────────────────────────────────────────────────────

@app.websocket("/ws/{room_code}/{player_id}")
async def websocket_endpoint(websocket: WebSocket, room_code: str, player_id: str):
    room_code = room_code.upper()
    await websocket.accept()

    if room_code not in ROOMS:
        await websocket.send_text(json.dumps({"type": "error", "message": "Room not found"}))
        await websocket.close()
        return

    # Register connection
    if room_code not in ROOM_CONNECTIONS:
        ROOM_CONNECTIONS[room_code] = {}
    ROOM_CONNECTIONS[room_code][player_id] = websocket

    # Mark player connected
    state = GameState(**ROOMS[room_code]["state"])
    player = next((p for p in state.players if p.id == player_id), None)
    if player:
        player.isConnected = True
        ROOMS[room_code]["state"] = state.dict()
        await broadcast(room_code, {"type": "player_connected", "playerId": player_id, "name": player.name})
    await broadcast_state(room_code)

    try:
        while True:
            # Keep-alive ping handling
            data = await websocket.receive_text()
            msg = json.loads(data)
            if msg.get("type") == "ping":
                await websocket.send_text(json.dumps({"type": "pong"}))
    except WebSocketDisconnect:
        ROOM_CONNECTIONS[room_code].pop(player_id, None)
        # Mark disconnected
        state = GameState(**ROOMS[room_code]["state"])
        player = next((p for p in state.players if p.id == player_id), None)
        if player:
            player.isConnected = False
            ROOMS[room_code]["state"] = state.dict()
            await broadcast(room_code, {"type": "player_disconnected",
                                         "playerId": player_id, "name": player.name})
        await broadcast_state(room_code)


@app.get("/health")
def health():
    return {"status": "ok", "rooms": len(ROOMS)}
