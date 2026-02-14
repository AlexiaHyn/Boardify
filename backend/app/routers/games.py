"""
Games router — Exploding Kittens implementation.
All game state lives in the GAMES in-memory store for this example.
Replace with a database layer (e.g. SQLModel + SQLite/Postgres) for persistence.
"""

from __future__ import annotations

import random
import uuid
from datetime import datetime
from typing import Dict

from fastapi import APIRouter, HTTPException

from app.models.game import (
    ActionRequest,
    ActionResponse,
    Card,
    CardEffect,
    CreateGameRequest,
    GameRules,
    GameState,
    Hand,
    LogEntry,
    Player,
    SpecialRule,
    TurnPhase,
    TurnStructure,
    WinCondition,
    Zone,
)

router = APIRouter(prefix="/games", tags=["games"])

# ── In-memory store ───────────────────────────────────────────────────────────
# Key: gameId, Value: serialised GameState dict
GAMES: Dict[str, dict] = {}


# ── Exploding Kittens — card definitions ──────────────────────────────────────

def _make_card(id: str, name: str, type: str, subtype: str, emoji: str,
               description: str, effect_type: str, effect_target: str,
               playable: bool, effect_value: int | None = None) -> Card:
    return Card(
        id=id,
        name=name,
        type=type,
        subtype=subtype,
        emoji=emoji,
        description=description,
        effects=[CardEffect(
            type=effect_type,
            value=effect_value,
            target=effect_target,
            description=description,
        )],
        isPlayable=playable,
        metadata={},
    )


EK_CARDS: list[Card] = [
    # Defuse (6)
    *[_make_card(f"defuse_{i}", "Defuse", "defense", "defuse", "🔧",
                 "Save yourself from an Exploding Kitten. Place it back anywhere in the deck.",
                 "defuse", "self", False) for i in range(6)],

    # Exploding Kitten (4)
    *[_make_card(f"exploding_{i}", "Exploding Kitten", "special", "exploding", "💣",
                 "BOOM! You explode unless you have a Defuse card.",
                 "explode", "self", False) for i in range(4)],

    # Attack (4)
    *[_make_card(f"attack_{i}", "Attack", "action", "attack", "⚔️",
                 "End your turn without drawing. The next player takes 2 turns.",
                 "attack", "others", True, effect_value=2) for i in range(4)],

    # Skip (4)
    *[_make_card(f"skip_{i}", "Skip", "action", "skip", "⏭️",
                 "End your turn without drawing a card.",
                 "skip", "self", True) for i in range(4)],

    # Nope (5)
    *[_make_card(f"nope_{i}", "Nope", "reaction", "nope", "🚫",
                 "Stop any action card (except Defuse or Exploding Kitten).",
                 "cancel", "others", True) for i in range(5)],

    # See the Future (5)
    *[_make_card(f"see_future_{i}", "See the Future", "action", "see_future", "🔮",
                 "Peek at the top 3 cards of the draw pile.",
                 "peek", "self", True, effect_value=3) for i in range(5)],

    # Shuffle (4)
    *[_make_card(f"shuffle_{i}", "Shuffle", "action", "shuffle", "🔀",
                 "Shuffle the draw pile.",
                 "shuffle", "all", True) for i in range(4)],

    # Favor (4)
    *[_make_card(f"favor_{i}", "Favor", "action", "favor", "🙏",
                 "Force another player to give you one card of their choice.",
                 "steal", "choose", True, effect_value=1) for i in range(4)],

    # Cat cards — 3 varieties × 4 each
    *[_make_card(f"taco_{i}", "Taco Cat", "combo", "cat", "🌮",
                 "Pair with another cat card to steal a random card.",
                 "combo_steal", "choose", True) for i in range(4)],

    *[_make_card(f"rainbow_{i}", "Rainbow Cat", "combo", "cat", "🌈",
                 "Pair with another cat card to steal a random card.",
                 "combo_steal", "choose", True) for i in range(4)],

    *[_make_card(f"beard_{i}", "Beard Cat", "combo", "cat", "😺",
                 "Pair with another cat card to steal a random card.",
                 "combo_steal", "choose", True) for i in range(4)],
]


# ── Exploding Kittens — rules ─────────────────────────────────────────────────

EK_RULES = GameRules(
    minPlayers=2,
    maxPlayers=5,
    handSize=7,
    turnStructure=TurnStructure(
        phases=[
            TurnPhase(id="play", name="Play Cards",
                      description="Play any number of action cards", isOptional=True),
            TurnPhase(id="draw", name="Draw Card",
                      description="Draw the top card of the deck", isOptional=False),
        ],
        canPassTurn=False,
        mustPlayCard=False,
        drawCount=1,
    ),
    winCondition=WinCondition(
        type="last_standing",
        description="Be the last player not to explode!",
    ),
    specialRules=[
        SpecialRule(id="nope_nope", name="Nope a Nope", trigger="on_play",
                    description="A Nope can itself be Noped, turning it into a Yup.",
                    metadata={}),
        SpecialRule(id="cat_combo", name="Cat Card Combos", trigger="on_play",
                    description="Play 2 matching cat cards to steal a random card. "
                                "Play 3 to name a specific card.",
                    metadata={"pair": 2, "triple": 3}),
        SpecialRule(id="defuse_placement", name="Defuse Placement", trigger="on_draw",
                    description="After defusing, secretly reinsert the Exploding Kitten "
                                "anywhere in the deck.",
                    metadata={}),
    ],
)


# ── Helpers ───────────────────────────────────────────────────────────────────

def _make_log(message: str, type_: str = "action",
              player_id: str | None = None,
              card_id: str | None = None) -> LogEntry:
    return LogEntry(
        id=str(uuid.uuid4()),
        timestamp=int(datetime.now().timestamp() * 1000),
        message=message,
        type=type_,
        playerId=player_id,
        cardId=card_id,
    )


def _now_ms() -> int:
    return int(datetime.now().timestamp() * 1000)


def _active_players(state: GameState) -> list[Player]:
    return [p for p in state.players if p.status not in ("eliminated", "winner")]


def _next_player(state: GameState, skip: int = 1) -> Player | None:
    active = _active_players(state)
    if not active:
        return None
    ids = [p.id for p in active]
    try:
        idx = ids.index(state.currentTurnPlayerId)
    except ValueError:
        return active[0]
    return active[(idx + skip) % len(active)]


def _advance_turn(state: GameState) -> None:
    """Move currentTurnPlayerId to the next active player."""
    next_p = _next_player(state)
    if next_p:
        for p in state.players:
            p.isCurrentTurn = p.id == next_p.id
        state.currentTurnPlayerId = next_p.id
        state.turnNumber += 1


# ── Game factory ──────────────────────────────────────────────────────────────

def _build_ek_game(player_names: list[str]) -> GameState:
    n = len(player_names)

    # Deck without exploding kittens — shuffled
    deck = [c for c in EK_CARDS if c.subtype not in ("exploding", "defuse")]
    random.shuffle(deck)

    # Each player starts with 1 Defuse + 6 random cards
    players: list[Player] = []
    emojis = ["🐱", "🐶", "🦊", "🐻", "🐼"]
    for i, name in enumerate(player_names):
        pid = str(uuid.uuid4())
        defuse = Card(
            id=f"defuse_p{i}_{pid[:4]}",
            name="Defuse",
            type="defense",
            subtype="defuse",
            emoji="🔧",
            description="Save yourself from an Exploding Kitten.",
            effects=[CardEffect(type="defuse", target="self",
                                description="Defuse the explosion")],
            isPlayable=False,
            metadata={},
        )
        hand_cards = [defuse] + [deck.pop() for _ in range(min(6, len(deck)))]
        players.append(Player(
            id=pid,
            name=name,
            emoji=emojis[i % len(emojis)],
            status="active",
            hand=Hand(playerId=pid, cards=hand_cards, isVisible=True),
            isCurrentTurn=(i == 0),
            isLocalPlayer=(i == 0),
            metadata={"attacks_pending": 0},
        ))

    # Insert N-1 Exploding Kittens back into the deck
    for j in range(n - 1):
        deck.append(Card(
            id=f"exploding_game_{j}",
            name="Exploding Kitten",
            type="special",
            subtype="exploding",
            emoji="💣",
            description="BOOM! You explode unless you have a Defuse card.",
            effects=[CardEffect(type="explode", target="self",
                                description="Eliminate player unless defused")],
            isPlayable=False,
            metadata={},
        ))
    random.shuffle(deck)

    zones = [
        Zone(id="draw_pile", name="Draw Pile", type="deck",
             cards=deck, isPublic=False),
        Zone(id="discard_pile", name="Discard Pile", type="discard",
             cards=[], isPublic=True),
    ]

    return GameState(
        gameId=str(uuid.uuid4()),
        gameName="Exploding Kittens",
        phase="playing",
        players=players,
        zones=zones,
        currentTurnPlayerId=players[0].id,
        turnNumber=1,
        currentPhaseIndex=0,
        rules=EK_RULES,
        log=[_make_log("🎮 Game started! Good luck, don't explode.", "system")],
        metadata={"attacks_pending": 0},
    )


# ── Action handler ────────────────────────────────────────────────────────────

def _apply_action(state: GameState, action: ActionRequest) -> ActionResponse:
    player = next((p for p in state.players if p.id == action.playerId), None)
    if not player:
        return ActionResponse(success=False, newState=state,
                              triggeredEffects=[], error="Player not found")

    draw_zone = next((z for z in state.zones if z.id == "draw_pile"), None)
    discard_zone = next((z for z in state.zones if z.id == "discard_pile"), None)
    triggered: list[str] = []

    # ── draw_card ─────────────────────────────────────────────────────────────
    if action.type == "draw_card":
        if state.currentTurnPlayerId != player.id:
            return ActionResponse(success=False, newState=state,
                                  triggeredEffects=[], error="Not your turn")
        if not draw_zone or not draw_zone.cards:
            return ActionResponse(success=False, newState=state,
                                  triggeredEffects=[], error="Draw pile is empty")

        drawn = draw_zone.cards.pop(0)

        if drawn.subtype == "exploding":
            defuse = next((c for c in player.hand.cards if c.subtype == "defuse"), None)
            if defuse:
                player.hand.cards.remove(defuse)
                discard_zone.cards.insert(0, defuse)
                insert_pos = random.randint(0, len(draw_zone.cards))
                draw_zone.cards.insert(insert_pos, drawn)
                state.log.append(_make_log(
                    f"💥 {player.name} drew an Exploding Kitten… but Defused it!",
                    "effect", player.id,
                ))
                triggered.append("defused")
            else:
                player.status = "eliminated"
                discard_zone.cards.insert(0, drawn)
                state.log.append(_make_log(
                    f"💥 {player.name} EXPLODED! 😱", "effect", player.id,
                ))
                triggered.append("exploded")

            # Check win condition
            active = _active_players(state)
            if len(active) == 1:
                active[0].status = "winner"
                state.winner = active[0]
                state.phase = "ended"
                state.log.append(_make_log(f"🎉 {active[0].name} wins!", "system"))
        else:
            player.hand.cards.append(drawn)
            state.log.append(_make_log(
                f"{player.name} drew a card.", "action", player.id,
            ))

        # Advance turn — respect stacked attacks
        attacks: int = state.metadata.get("attacks_pending", 0)
        if attacks > 1:
            state.metadata["attacks_pending"] = attacks - 1
        else:
            state.metadata["attacks_pending"] = 0
            _advance_turn(state)

    # ── play_card ─────────────────────────────────────────────────────────────
    elif action.type == "play_card":
        if state.currentTurnPlayerId != player.id:
            return ActionResponse(success=False, newState=state,
                                  triggeredEffects=[], error="Not your turn")
        card = next((c for c in player.hand.cards if c.id == action.cardId), None)
        if not card:
            return ActionResponse(success=False, newState=state,
                                  triggeredEffects=[], error="Card not in hand")

        player.hand.cards.remove(card)
        discard_zone.cards.insert(0, card)
        triggered.append(f"played:{card.subtype}")

        if card.subtype == "skip":
            state.log.append(_make_log(
                f"{player.name} played Skip ⏭️", "action", player.id, card.id,
            ))
            attacks = state.metadata.get("attacks_pending", 0)
            if attacks > 0:
                state.metadata["attacks_pending"] = attacks - 1
            _advance_turn(state)

        elif card.subtype == "attack":
            state.log.append(_make_log(
                f"{player.name} played Attack ⚔️! Next player takes 2 turns.",
                "action", player.id, card.id,
            ))
            state.metadata["attacks_pending"] = (
                state.metadata.get("attacks_pending", 0) + 2
            )
            _advance_turn(state)

        elif card.subtype == "shuffle":
            random.shuffle(draw_zone.cards)
            state.log.append(_make_log(
                f"{player.name} shuffled the deck 🔀", "action", player.id, card.id,
            ))

        elif card.subtype == "see_future":
            top3 = [c.name for c in draw_zone.cards[:3]]
            state.log.append(_make_log(
                f"{player.name} peeked at the top 3 cards 🔮", "action", player.id, card.id,
            ))
            triggered.append(f"top3:{','.join(top3)}")

        elif card.subtype == "favor":
            target = next(
                (p for p in state.players if p.id == action.targetPlayerId), None
            )
            if target and target.hand.cards:
                stolen = random.choice(target.hand.cards)
                target.hand.cards.remove(stolen)
                player.hand.cards.append(stolen)
                state.log.append(_make_log(
                    f"{player.name} used Favor on {target.name} and took a card! 🙏",
                    "action", player.id, card.id,
                ))
            else:
                state.log.append(_make_log(
                    f"{player.name} played Favor — target has no cards.",
                    "action", player.id,
                ))

        elif card.subtype == "nope":
            state.log.append(_make_log(
                f"{player.name} played Nope! 🚫", "action", player.id, card.id,
            ))

        else:
            state.log.append(_make_log(
                f"{player.name} played {card.name}.", "action", player.id, card.id,
            ))

    else:
        return ActionResponse(
            success=False, newState=state, triggeredEffects=[],
            error=f"Unknown action type: {action.type}",
        )

    return ActionResponse(success=True, newState=state, triggeredEffects=triggered)


# ── Routes ────────────────────────────────────────────────────────────────────

@router.get("/available")
def available_games():
    return {
        "success": True,
        "data": [{
            "gameId": "exploding_kittens_template",
            "gameName": "Exploding Kittens",
            "gameType": "exploding_kittens",
            "description": "A card game for people who are into kittens and explosions.",
            "emoji": "💣",
            "rules": EK_RULES.model_dump(),
            "cardDefinitions": [c.model_dump() for c in EK_CARDS[:10]],
            "initialZones": [
                {"id": "draw_pile", "name": "Draw Pile"},
                {"id": "discard_pile", "name": "Discard Pile"},
            ],
            "metadata": {},
        }],
        "timestamp": _now_ms(),
    }


@router.get("/{game_type}/config")
def get_game_config(game_type: str):
    if game_type != "exploding_kittens":
        raise HTTPException(status_code=404, detail="Game type not found")
    return {
        "success": True,
        "data": {
            "gameId": "exploding_kittens_template",
            "gameName": "Exploding Kittens",
            "gameType": "exploding_kittens",
            "description": "A card game for people who are into kittens and explosions.",
            "emoji": "💣",
            "rules": EK_RULES.model_dump(),
            "cardDefinitions": [c.model_dump() for c in EK_CARDS],
            "initialZones": [],
            "metadata": {},
        },
        "timestamp": _now_ms(),
    }


@router.post("/create")
def create_game(req: CreateGameRequest):
    if req.game_type != "exploding_kittens":
        raise HTTPException(status_code=400, detail="Unsupported game type")
    if not (2 <= len(req.player_names) <= 5):
        raise HTTPException(status_code=400, detail="Need 2–5 players")

    state = _build_ek_game(req.player_names)
    GAMES[state.gameId] = state.model_dump()
    return {
        "success": True,
        "data": state.model_dump(),
        "timestamp": _now_ms(),
    }


@router.get("/{game_id}/state")
def get_game_state(game_id: str):
    if game_id not in GAMES:
        raise HTTPException(status_code=404, detail="Game not found")
    return {
        "success": True,
        "data": GAMES[game_id],
        "timestamp": _now_ms(),
    }


@router.post("/{game_id}/action")
def game_action(game_id: str, action: ActionRequest):
    if game_id not in GAMES:
        raise HTTPException(status_code=404, detail="Game not found")

    state = GameState(**GAMES[game_id])
    result = _apply_action(state, action)

    if result.success:
        GAMES[game_id] = result.newState.model_dump()

    return result.model_dump()
