"""
Exploding Kittens game engine.
Handles setup_game() and apply_action() for EK-specific rules.
"""
from __future__ import annotations

import random
import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

from app.models.game import (
    Card, CardEffect, GameState, Hand, LogEntry, Player, Zone,
)
from app.services.game_loader import build_deck_from_definitions, _parse_card_definitions


# ── Utilities ─────────────────────────────────────────────────────────────────

def _ts() -> int:
    return int(datetime.now().timestamp() * 1000)


def _log(msg: str, type_: str = "action",
         player_id: str = None, card_id: str = None) -> LogEntry:
    return LogEntry(
        id=str(uuid.uuid4()), timestamp=_ts(),
        message=msg, type=type_,
        playerId=player_id, cardId=card_id,
    )


def _active(state: GameState) -> List[Player]:
    return [p for p in state.players if p.status not in ("eliminated", "winner")]


def _draw_zone(state: GameState) -> Optional[Zone]:
    return next((z for z in state.zones if z.id == "draw_pile"), None)


def _discard_zone(state: GameState) -> Optional[Zone]:
    return next((z for z in state.zones if z.id == "discard_pile"), None)


def _get_player(state: GameState, pid: str) -> Optional[Player]:
    return next((p for p in state.players if p.id == pid), None)


def _advance_turn(state: GameState):
    """Move to the next player, respecting attack stacks."""
    attacks = state.metadata.get("attacks_pending", 0)
    current = _get_player(state, state.currentTurnPlayerId)

    if attacks > 1:
        state.metadata["attacks_pending"] = attacks - 1
        # Same player still owes draws (tracked via turnCount)
    else:
        state.metadata["attacks_pending"] = 0
        active = _active(state)
        if not active:
            return
        ids = [p.id for p in active]
        try:
            idx = ids.index(state.currentTurnPlayerId)
        except ValueError:
            idx = -1
        nxt = active[(idx + 1) % len(active)]
        for p in state.players:
            p.isCurrentTurn = p.id == nxt.id
        state.currentTurnPlayerId = nxt.id
        state.turnNumber += 1
        # New player draws 1 by default; attacks override this
        nxt.turnCount = 1


def _check_winner(state: GameState) -> Optional[Player]:
    active = _active(state)
    if len(active) == 1:
        return active[0]
    return None


# ── Setup ─────────────────────────────────────────────────────────────────────

def setup_game(state: GameState):
    """Deal cards and insert Exploding Kittens, then start the game."""
    raw_defs = state.metadata.get("cardDefinitions", [])
    card_defs = _parse_card_definitions(raw_defs)

    # Build base deck (exclude exploding & defuse — handled separately)
    deck = build_deck_from_definitions(card_defs, exclude_ids=["exploding", "defuse"])
    random.shuffle(deck)

    # One defuse definition for dealing starters
    defuse_def = next((d for d in card_defs if d.id == "defuse"), None)
    exploding_def = next((d for d in card_defs if d.id == "exploding"), None)

    n = len(state.players)
    for i, player in enumerate(state.players):
        hand_cards: List[Card] = []
        # Give each player one defuse
        if defuse_def:
            hand_cards.append(Card(
                id=f"defuse_start_{i}",
                definitionId="defuse",
                name=defuse_def.name,
                type=defuse_def.type,
                subtype="defuse",
                emoji=defuse_def.emoji,
                description=defuse_def.description,
                effects=defuse_def.effects,
                isPlayable=defuse_def.isPlayable,
                isReaction=defuse_def.isReaction,
            ))
        # Deal remaining hand cards
        hand_size = max(0, state.rules.handSize - 1)
        for _ in range(min(hand_size, len(deck))):
            hand_cards.append(deck.pop())

        player.hand = Hand(playerId=player.id, cards=hand_cards, isVisible=True)
        player.status = "active"
        player.isCurrentTurn = i == 0
        player.turnCount = 1

    # Insert (n-1) Exploding Kittens into the deck
    if exploding_def:
        for j in range(n - 1):
            deck.append(Card(
                id=f"exploding_{j}",
                definitionId="exploding",
                name=exploding_def.name,
                type=exploding_def.type,
                subtype="exploding",
                emoji=exploding_def.emoji,
                description=exploding_def.description,
                effects=exploding_def.effects,
                isPlayable=False,
                isReaction=False,
            ))
    random.shuffle(deck)

    # Extra defuse cards go in the deck
    extra_defuses = max(0, (defuse_def.count if defuse_def else 6) - n)
    if defuse_def:
        for k in range(extra_defuses):
            deck.append(Card(
                id=f"defuse_deck_{k}",
                definitionId="defuse",
                name=defuse_def.name,
                type=defuse_def.type,
                subtype="defuse",
                emoji=defuse_def.emoji,
                description=defuse_def.description,
                effects=defuse_def.effects,
                isPlayable=defuse_def.isPlayable,
                isReaction=defuse_def.isReaction,
            ))
    random.shuffle(deck)

    state.zones = [
        Zone(id="draw_pile",    name="Draw Pile",    type="deck",    cards=deck, isPublic=False),
        Zone(id="discard_pile", name="Discard Pile", type="discard", cards=[],   isPublic=True),
    ]
    state.currentTurnPlayerId = state.players[0].id
    state.turnNumber = 1
    state.phase = "playing"
    state.metadata["attacks_pending"] = 0
    state.metadata["nope_window"] = None          # pending action that can be Noped
    state.log.append(_log("🎮 Game started! Don't explode. 💣", "system"))


# ── Action dispatch ───────────────────────────────────────────────────────────

def apply_action(state: GameState, action) -> Tuple[bool, str, List[str]]:
    """
    Main action handler. Returns (success, error, triggered_effects).
    action is an ActionRequest-like object with .type, .playerId, .cardId,
    .targetPlayerId, .metadata.
    """
    handlers = {
        "draw_card":      _handle_draw_card,
        "play_card":      _handle_play_card,
        "nope":           _handle_nope,
        "select_target":  _handle_select_target,
        "insert_exploding": _handle_insert_exploding,
    }
    handler = handlers.get(action.type)
    if handler is None:
        return False, f"Unknown action: {action.type}", []
    return handler(state, action)


# ── Action handlers ───────────────────────────────────────────────────────────

def _handle_draw_card(state: GameState, action) -> Tuple[bool, str, List[str]]:
    player = _get_player(state, action.playerId)
    if not player:
        return False, "Player not found", []
    if state.currentTurnPlayerId != player.id:
        return False, "Not your turn", []

    draw = _draw_zone(state)
    discard = _discard_zone(state)
    if not draw or not draw.cards:
        return False, "Draw pile is empty", []

    triggered: List[str] = []
    drawn = draw.cards.pop(0)

    if drawn.subtype == "exploding":
        defuse = next((c for c in player.hand.cards if c.subtype == "defuse"), None)
        if defuse:
            # Defused! — player must choose where to reinsert the bomb
            player.hand.cards.remove(defuse)
            discard.cards.insert(0, defuse)
            state.log.append(_log(
                f"💥 {player.name} drew an Exploding Kitten… and Defused it! 😅",
                "effect", player.id
            ))
            triggered.append("defused")
            # Store pending reinsert action
            state.phase = "awaiting_response"
            state.pendingAction = {
                "type": "insert_exploding",
                "playerId": player.id,
                "card": drawn.dict(),
                "deckSize": len(draw.cards),
            }
            return True, "", triggered
        else:
            player.status = "eliminated"
            discard.cards.insert(0, drawn)
            state.log.append(_log(f"💥 {player.name} EXPLODED! 😱", "effect", player.id))
            triggered.append("exploded")

            winner = _check_winner(state)
            if winner:
                winner.status = "winner"
                state.winner = winner
                state.phase = "ended"
                state.log.append(_log(f"🎉 {winner.name} wins!", "system"))
                return True, "", triggered

            _advance_turn(state)
    else:
        player.hand.cards.append(drawn)
        state.log.append(_log(f"{player.name} drew a card.", "action", player.id))
        _advance_turn(state)

    return True, "", triggered


def _handle_insert_exploding(state: GameState, action) -> Tuple[bool, str, List[str]]:
    """Player places the defused bomb back in the deck at a chosen position."""
    if state.phase != "awaiting_response":
        return False, "No pending insert action", []
    pending = state.pendingAction
    if not pending or pending.get("type") != "insert_exploding":
        return False, "No pending insert action", []
    if action.playerId != pending["playerId"]:
        return False, "Not your action", []

    draw = _draw_zone(state)
    bomb_card = Card(**pending["card"])
    pos = action.metadata.get("position", random.randint(0, len(draw.cards)))
    pos = max(0, min(pos, len(draw.cards)))
    draw.cards.insert(pos, bomb_card)

    state.pendingAction = None
    state.phase = "playing"
    state.log.append(_log(
        f"🔧 {action.playerId} reinserted the Exploding Kitten into the deck.", "system"
    ))
    _advance_turn(state)
    return True, "", ["bomb_inserted"]


def _handle_play_card(state: GameState, action) -> Tuple[bool, str, List[str]]:
    player = _get_player(state, action.playerId)
    if not player:
        return False, "Player not found", []
    if state.currentTurnPlayerId != player.id:
        return False, "Not your turn", []
    if state.phase not in ("playing",):
        return False, "Cannot play a card right now", []

    card = next((c for c in player.hand.cards if c.id == action.cardId), None)
    if not card:
        return False, "Card not in hand", []

    # Combo detection: check if metadata carries a combo pair
    combo_pair_id = action.metadata.get("comboPairId")
    if card.subtype in ("taco", "rainbow", "beard", "potato", "cattermelon") or combo_pair_id:
        return _handle_cat_combo(state, action, player, card, combo_pair_id)

    discard = _discard_zone(state)
    player.hand.cards.remove(card)
    discard.cards.insert(0, card)
    triggered: List[str] = [f"played:{card.subtype}"]

    subtype = card.subtype

    if subtype == "skip":
        return _effect_skip(state, player, card, triggered)
    elif subtype == "attack":
        return _effect_attack(state, player, card, triggered)
    elif subtype == "shuffle":
        return _effect_shuffle(state, player, card, triggered)
    elif subtype == "see_future":
        return _effect_see_future(state, player, card, triggered)
    elif subtype == "favor":
        return _effect_favor(state, player, card, action, triggered)
    elif subtype == "alter_future":
        return _effect_alter_future(state, player, card, triggered)
    elif subtype == "draw_bottom":
        return _effect_draw_bottom(state, player, card, triggered)
    elif subtype == "targeted_attack":
        return _effect_targeted_attack(state, player, card, action, triggered)
    else:
        state.log.append(_log(f"{player.name} played {card.name}.", "action", player.id, card.id))
        return True, "", triggered


def _handle_nope(state: GameState, action) -> Tuple[bool, str, List[str]]:
    """Play a Nope card to cancel a pending action."""
    player = _get_player(state, action.playerId)
    if not player:
        return False, "Player not found", []
    if state.phase != "awaiting_response" or not state.pendingAction:
        return False, "Nothing to Nope", []
    if state.pendingAction.get("type") == "insert_exploding":
        return False, "Cannot Nope an exploding kitten defuse", []

    nope_card = next((c for c in player.hand.cards if c.subtype == "nope"), None)
    if not nope_card:
        return False, "No Nope card in hand", []

    discard = _discard_zone(state)
    player.hand.cards.remove(nope_card)
    discard.cards.insert(0, nope_card)

    # Cancel the pending action
    cancelled = state.pendingAction.get("type", "action")
    state.pendingAction = None
    state.phase = "playing"
    state.log.append(_log(
        f"🚫 {player.name} played Nope! {cancelled} was cancelled.", "effect", player.id
    ))
    return True, "", [f"noped:{cancelled}"]


def _handle_select_target(state: GameState, action) -> Tuple[bool, str, List[str]]:
    """Resolve a pending action that requires a target (e.g. Favor)."""
    pending = state.pendingAction
    if not pending:
        return False, "No pending action", []
    if pending.get("playerId") != action.playerId:
        return False, "Not your pending action", []

    if pending["type"] == "favor":
        return _resolve_favor(state, action, pending)
    if pending["type"] == "targeted_attack":
        return _resolve_targeted_attack(state, action, pending)
    return False, "Unknown pending action type", []


# ── Card effect helpers ───────────────────────────────────────────────────────

def _effect_skip(state, player, card, triggered):
    state.log.append(_log(f"{player.name} played Skip ⏭️", "action", player.id, card.id))
    attacks = state.metadata.get("attacks_pending", 0)
    if attacks > 0:
        state.metadata["attacks_pending"] = attacks - 1
    _advance_turn(state)
    return True, "", triggered


def _effect_attack(state, player, card, triggered):
    state.log.append(_log(
        f"⚔️ {player.name} played Attack! Next player takes 2 turns.", "action", player.id, card.id
    ))
    state.metadata["attacks_pending"] = state.metadata.get("attacks_pending", 0) + 2
    _advance_turn(state)
    return True, "", triggered


def _effect_shuffle(state, player, card, triggered):
    draw = _draw_zone(state)
    random.shuffle(draw.cards)
    state.log.append(_log(f"🔀 {player.name} shuffled the deck.", "action", player.id, card.id))
    return True, "", triggered


def _effect_see_future(state, player, card, triggered):
    draw = _draw_zone(state)
    top3 = [c.name for c in draw.cards[:3]]
    state.log.append(_log(f"🔮 {player.name} peeked at the top 3 cards.", "action", player.id, card.id))
    triggered.append(f"top3:{','.join(top3)}")
    return True, "", triggered


def _effect_alter_future(state, player, card, triggered):
    """NSFW/5-card variant: peek and reorder top 3 cards."""
    draw = _draw_zone(state)
    top3 = [c.name for c in draw.cards[:3]]
    state.log.append(_log(
        f"✏️ {player.name} used Alter the Future — reordering the top 3 cards.", "action", player.id, card.id
    ))
    triggered.append(f"alter_future:{','.join(top3)}")
    # Frontend sends a follow-up to reorder; for now shuffle top 3
    top = draw.cards[:3]
    rest = draw.cards[3:]
    random.shuffle(top)
    draw.cards = top + rest
    return True, "", triggered


def _effect_draw_bottom(state, player, card, triggered):
    draw = _draw_zone(state)
    discard = _discard_zone(state)
    if not draw.cards:
        return False, "Draw pile is empty", []
    drawn = draw.cards.pop(-1)   # bottom card
    if drawn.subtype == "exploding":
        defuse = next((c for c in player.hand.cards if c.subtype == "defuse"), None)
        if defuse:
            player.hand.cards.remove(defuse)
            discard.cards.insert(0, defuse)
            state.log.append(_log(
                f"💥 {player.name} drew Exploding Kitten from the bottom… Defused!", "effect", player.id
            ))
            triggered.append("defused")
            pos = random.randint(0, len(draw.cards))
            draw.cards.insert(pos, drawn)
            state.pendingAction = {
                "type": "insert_exploding",
                "playerId": player.id,
                "card": drawn.dict(),
                "deckSize": len(draw.cards),
            }
            state.phase = "awaiting_response"
        else:
            player.status = "eliminated"
            discard.cards.insert(0, drawn)
            state.log.append(_log(f"💥 {player.name} EXPLODED from the bottom! 😱", "effect", player.id))
            triggered.append("exploded")
            winner = _check_winner(state)
            if winner:
                winner.status = "winner"
                state.winner = winner
                state.phase = "ended"
                state.log.append(_log(f"🎉 {winner.name} wins!", "system"))
    else:
        player.hand.cards.append(drawn)
        state.log.append(_log(
            f"{player.name} drew from the bottom.", "action", player.id, card.id
        ))
        _advance_turn(state)
    return True, "", triggered


def _effect_favor(state, player, card, action, triggered):
    target = _get_player(state, action.targetPlayerId)
    if target and target.hand.cards:
        state.log.append(_log(
            f"🙏 {player.name} used Favor on {target.name}.", "action", player.id, card.id
        ))
        # Requires target to pick a card — store pending
        state.pendingAction = {
            "type": "favor",
            "playerId": player.id,
            "targetPlayerId": target.id,
        }
        state.phase = "awaiting_response"
        triggered.append("favor_pending")
    else:
        state.log.append(_log(f"{player.name} played Favor — target has no cards.", "action"))
    return True, "", triggered


def _resolve_favor(state, action, pending):
    """Target player selects a card to give."""
    target = _get_player(state, action.playerId)
    requester = _get_player(state, pending["playerId"])
    if not target or not requester:
        return False, "Player not found", []

    card_id = action.metadata.get("cardId") or action.cardId
    card = next((c for c in target.hand.cards if c.id == card_id), None)
    if not card:
        # Auto-pick random card
        if not target.hand.cards:
            return False, "No cards to give", []
        card = random.choice(target.hand.cards)

    target.hand.cards.remove(card)
    requester.hand.cards.append(card)
    state.pendingAction = None
    state.phase = "playing"
    state.log.append(_log(
        f"🎁 {target.name} gave {requester.name} a card.", "effect", target.id
    ))
    return True, "", ["favor_resolved"]


def _effect_targeted_attack(state, player, card, action, triggered):
    """Force a chosen player to take 2 turns."""
    target = _get_player(state, action.targetPlayerId)
    if not target:
        state.pendingAction = {
            "type": "targeted_attack",
            "playerId": player.id,
        }
        state.phase = "awaiting_response"
        triggered.append("targeted_attack_pending")
        return True, "", triggered

    state.log.append(_log(
        f"🎯 {player.name} targeted {target.name}! They take 2 turns.", "action", player.id, card.id
    ))
    state.metadata["attacks_pending"] = 2
    # Force turn to target
    for p in state.players:
        p.isCurrentTurn = p.id == target.id
    state.currentTurnPlayerId = target.id
    state.turnNumber += 1
    target.turnCount = 2
    triggered.append(f"targeted:{target.id}")
    return True, "", triggered


def _resolve_targeted_attack(state, action, pending):
    player = _get_player(state, pending["playerId"])
    target = _get_player(state, action.metadata.get("targetPlayerId") or action.targetPlayerId)
    if not player or not target:
        return False, "Player not found", []
    state.metadata["attacks_pending"] = 2
    for p in state.players:
        p.isCurrentTurn = p.id == target.id
    state.currentTurnPlayerId = target.id
    state.turnNumber += 1
    state.pendingAction = None
    state.phase = "playing"
    state.log.append(_log(
        f"🎯 {player.name} targeted {target.name}! They take 2 turns.", "effect", player.id
    ))
    return True, "", [f"targeted:{target.id}"]


def _handle_cat_combo(state, action, player, card, combo_pair_id):
    """Handle 2-cat combo (steal random card) or 3-cat combo (demand specific card)."""
    pair = next(
        (c for c in player.hand.cards
         if c.id == combo_pair_id and c.subtype == card.subtype and c.id != card.id),
        None,
    )
    if not pair:
        return False, "No matching cat card for combo", []

    discard = _discard_zone(state)
    player.hand.cards.remove(card)
    player.hand.cards.remove(pair)
    discard.cards.insert(0, card)
    discard.cards.insert(0, pair)

    target = _get_player(state, action.targetPlayerId)
    if not target or not target.hand.cards:
        state.log.append(_log(f"{player.name} played a cat combo but the target has no cards.", "action"))
        return True, "", ["combo:no_steal"]

    stolen = random.choice(target.hand.cards)
    target.hand.cards.remove(stolen)
    player.hand.cards.append(stolen)
    state.log.append(_log(
        f"🐱 {player.name} played a cat combo and stole a card from {target.name}!",
        "action", player.id
    ))
    return True, "", [f"combo_steal:{target.id}"]
