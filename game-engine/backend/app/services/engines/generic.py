"""
Generic game engine – a basic fallback for card games not yet given
a custom engine.  Supports draw/play and last-standing win condition.
"""
from __future__ import annotations
import random
import uuid
from datetime import datetime
from typing import List, Optional, Tuple

from app.models.game import Card, GameState, Hand, LogEntry, Player, Zone
from app.services.game_loader import build_deck_from_definitions, _parse_card_definitions


def _ts():
    return int(datetime.now().timestamp() * 1000)


def _log(msg, type_="action", pid=None, cid=None):
    return LogEntry(id=str(uuid.uuid4()), timestamp=_ts(),
                    message=msg, type=type_, playerId=pid, cardId=cid)


def _draw_zone(state):
    return next((z for z in state.zones if z.id == "draw_pile"), None)


def _discard_zone(state):
    return next((z for z in state.zones if z.id == "discard_pile"), None)


def _active(state):
    return [p for p in state.players if p.status not in ("eliminated", "winner")]


def _advance_turn(state):
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


def setup_game(state: GameState):
    raw_defs = state.metadata.get("cardDefinitions", [])
    card_defs = _parse_card_definitions(raw_defs)
    deck = build_deck_from_definitions(card_defs)
    random.shuffle(deck)

    for i, player in enumerate(state.players):
        hand_cards = [deck.pop() for _ in range(min(state.rules.handSize, len(deck)))]
        player.hand = Hand(playerId=player.id, cards=hand_cards, isVisible=True)
        player.status = "active"
        player.isCurrentTurn = i == 0

    state.zones = [
        Zone(id="draw_pile",    name="Draw Pile",    type="deck",    cards=deck, isPublic=False),
        Zone(id="discard_pile", name="Discard Pile", type="discard", cards=[],   isPublic=True),
    ]
    state.currentTurnPlayerId = state.players[0].id
    state.turnNumber = 1
    state.phase = "playing"
    state.log.append(_log(f"🎮 {state.gameName} started!", "system"))


def apply_action(state: GameState, action) -> Tuple[bool, str, List[str]]:
    player = next((p for p in state.players if p.id == action.playerId), None)
    if not player:
        return False, "Player not found", []

    if action.type == "draw_card":
        draw = _draw_zone(state)
        if not draw or not draw.cards:
            return False, "Draw pile empty", []
        card = draw.cards.pop(0)
        player.hand.cards.append(card)
        state.log.append(_log(f"{player.name} drew a card.", "action", player.id))
        _advance_turn(state)
        return True, "", ["drew_card"]

    elif action.type == "play_card":
        card = next((c for c in player.hand.cards if c.id == action.cardId), None)
        if not card:
            return False, "Card not in hand", []
        player.hand.cards.remove(card)
        discard = _discard_zone(state)
        discard.cards.insert(0, card)
        state.log.append(_log(f"{player.name} played {card.name}.", "action", player.id, card.id))
        # Check empty hand win condition
        if state.rules.winCondition.type == "empty_hand" and not player.hand.cards:
            player.status = "winner"
            state.winner = player
            state.phase = "ended"
            state.log.append(_log(f"🎉 {player.name} wins!", "system"))
        return True, "", [f"played:{card.subtype}"]

    return False, f"Unknown action: {action.type}", []
