"""
Universal Data-Driven Card Game Engine
=======================================
This engine reads ALL game logic from the JSON definition file.
No Python code needs to be written for new card games — only a JSON file.

How it works
------------
Each card's "effects" list describes what happens when it is played.
Each effect has a "type" field that maps to a primitive action handler below.

Supported effect primitives
----------------------------
  number          – play a number/color card (validates match, advances turn)
  skip            – next player loses their turn
  skip_all        – every other player loses their turn (once around)
  reverse         – flip direction of play
  draw            – force the *target* player to draw N cards
  self_draw       – the *playing* player draws N cards
  wild            – change active color (prompts color picker)
  wild_draw       – change color AND force next player to draw N
  eliminate       – remove a player from the game (e.g. Exploding Kittens)
  defuse          – cancel an incoming elimination
  peek            – reveal top N cards of the draw pile to the player
  shuffle         – shuffle the draw pile
  steal           – take a random (or chosen) card from a target player
  give            – give a card to another player (Favor-style)
  insert          – place a specific card back into the draw pile at chosen position
  score           – add/subtract score points (for point-based games)
  extra_turn      – current player takes another turn
  swap_hands      – swap hands with a chosen player
  pass_card       – pass N cards to the next player
  discard_color   – discard all cards of a chosen color from hand
  any             – generic no-op (cosmetic cards with no mechanical effect)

Condition system (per-effect "conditions" list)
-----------------------------------------------
Each condition is evaluated before applying the effect:
  { "type": "has_card_type", "value": "defuse" }      – player must have a card of this subtype
  { "type": "deck_size_gte", "value": 5 }             – draw pile must have ≥ N cards
  { "type": "hand_size_lte", "value": 3 }             – player hand ≤ N cards
  { "type": "active_color", "value": "red" }          – active color must match
  { "type": "turn_number_gte", "value": 3 }           – turn number ≥ N
  { "type": "player_count_eq", "value": 2 }           – exactly N players remain

Turn advancement config (from JSON rules.turnStructure)
-------------------------------------------------------
  drawCount       – number of cards drawn at end of turn (if no card played)
  mustPlayCard    – true = player MUST play a valid card (no pass)
  canPassTurn     – true = player may pass without playing or drawing

Play validation config (from JSON config)
-----------------------------------------
  matchColor      – enforce color matching (UNO-style)
  matchNumber     – enforce number/value matching
  matchType       – enforce subtype matching
  stackableDraw   – allow Draw cards to be stacked
  wildAlwaysPlayable – wild cards bypass all matching rules (default true)
"""
from __future__ import annotations

import random
import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

from app.models.game import Card, GameState, Hand, LogEntry, Player, Zone
from app.services.game_loader import build_deck_from_definitions, _parse_card_definitions

# NOTE: plugin_loader import is deferred to after utility functions are defined,
# to avoid circular import (exploding_kittens.py imports _log, _active, etc. from here).


# ─────────────────────────────────────────────────────────────────────────────
# Utilities
# ─────────────────────────────────────────────────────────────────────────────

def _ts() -> int:
    return int(datetime.now().timestamp() * 1000)


def _log(msg: str, type_: str = "action",
         pid: str = None, cid: str = None) -> LogEntry:
    return LogEntry(id=str(uuid.uuid4()), timestamp=_ts(),
                    message=msg, type=type_, playerId=pid, cardId=cid)


def _draw_zone(state: GameState) -> Optional[Zone]:
    return next((z for z in state.zones if z.id == "draw_pile"), None)


def _discard_zone(state: GameState) -> Optional[Zone]:
    return next((z for z in state.zones if z.id == "discard_pile"), None)


def _active(state: GameState) -> List[Player]:
    return [p for p in state.players if p.status not in ("eliminated", "winner")]


def _get_player(state: GameState, pid: str) -> Optional[Player]:
    return next((p for p in state.players if p.id == pid), None)


def _card_color(card: Card) -> Optional[str]:
    if card.metadata:
        return card.metadata.get("color")
    return None


def _apply_card_color_map(cards: List[Card], cfg: Dict[str, Any]) -> None:
    """Resolve ``cardColorMap`` from game config into each card's metadata.

    If the config contains a ``cardColorMap`` entry like::

        {
          "field": "color",
          "defaultBg": "#302840",
          "colors": { "red": "#e74c3c", ... }
        }

    then for every card whose ``metadata[field]`` matches a key in ``colors``,
    ``borderColor`` and ``cardBg`` are injected into ``card.metadata`` so the
    frontend can apply them generically without game-specific knowledge.
    """
    color_map = cfg.get("cardColorMap")
    if not color_map:
        return
    field = color_map.get("field", "color")
    default_bg = color_map.get("defaultBg")
    mapping = color_map.get("colors", {})
    for card in cards:
        if not card.metadata:
            continue
        value = card.metadata.get(field)
        if value and value in mapping:
            card.metadata["borderColor"] = mapping[value]
            if default_bg:
                card.metadata.setdefault("cardBg", default_bg)


def _card_number(card: Card) -> Optional[int]:
    if card.metadata:
        v = card.metadata.get("number")
        return int(v) if v is not None else None
    return None


def _cfg(state: GameState) -> Dict[str, Any]:
    return state.metadata.get("gameConfig", {})


# ─────────────────────────────────────────────────────────────────────────────
# Turn order
# ─────────────────────────────────────────────────────────────────────────────

def _direction(state: GameState) -> int:
    return state.metadata.get("direction", 1)


def _peek_next(state: GameState, skip: int = 0) -> Optional[Player]:
    active = _active(state)
    if not active:
        return None
    ids = [p.id for p in active]
    d = _direction(state)
    try:
        idx = ids.index(state.currentTurnPlayerId)
    except ValueError:
        idx = 0
    return active[(idx + d * (1 + skip)) % len(ids)]


def _advance_turn(state: GameState, skip: int = 0):
    nxt = _peek_next(state, skip=skip)
    if not nxt:
        return
    for p in state.players:
        p.isCurrentTurn = p.id == nxt.id
    state.currentTurnPlayerId = nxt.id
    state.turnNumber += 1


def _reverse_direction(state: GameState):
    state.metadata["direction"] = -_direction(state)


# ─────────────────────────────────────────────────────────────────────────────
# Active color / value tracking
# ─────────────────────────────────────────────────────────────────────────────

def _active_color(state: GameState) -> Optional[str]:
    return state.metadata.get("activeColor")


def _active_number(state: GameState) -> Optional[int]:
    discard = _discard_zone(state)
    if discard and discard.cards:
        return _card_number(discard.cards[0])
    return None


def _active_subtype(state: GameState) -> Optional[str]:
    discard = _discard_zone(state)
    if discard and discard.cards:
        return discard.cards[0].subtype
    return None


def _set_active_color(state: GameState, card: Card):
    col = _card_color(card)
    if col and col != "wild":
        state.metadata["activeColor"] = col


# ─────────────────────────────────────────────────────────────────────────────
# Play legality
# ─────────────────────────────────────────────────────────────────────────────

def _can_play_card(card: Card, state: GameState) -> bool:
    cfg = _cfg(state)

    # Wilds bypass all matching (unless explicitly disabled)
    if cfg.get("wildAlwaysPlayable", True):
        col = _card_color(card)
        if col == "wild" or card.subtype in ("wild", "wild_draw4", "wild_draw"):
            return True

    # Pending draw stack: only stackable draw cards allowed
    pending = state.metadata.get("pendingDraw", 0)
    stackable = cfg.get("stackableDraw", False)
    if pending > 0 and stackable:
        # Check if this card has draw effects
        card_draw_effects = [e for e in card.effects if e.type in ("draw", "wild_draw")]
        if not card_draw_effects:
            # Not a draw card, can't play when there's a pending draw
            return False

        # Get the draw value from the top card (to ensure matching draw amounts)
        discard = _discard_zone(state)
        if discard and discard.cards:
            top_card = discard.cards[0]
            top_draw_effects = [e for e in top_card.effects if e.type in ("draw", "wild_draw")]

            if top_draw_effects and card_draw_effects:
                # CardEffect is a Pydantic model, use getattr to access value
                top_value = getattr(top_draw_effects[0], "value", 0)
                card_value = getattr(card_draw_effects[0], "value", 0)

                # Draw cards can only stack if they have the same value
                # Draw 2 stacks on Draw 2, Wild Draw 4 stacks on Wild Draw 4
                if top_value == card_value:
                    return True  # Same draw value - allow stacking
                else:
                    return False  # Different draw values - can't stack

        # If we can't determine top card, allow the draw card
        return True

    # Color match
    if cfg.get("matchColor", False):
        card_col = _card_color(card)
        active_col = _active_color(state)
        if card_col and active_col and card_col == active_col:
            return True

    # Number match
    if cfg.get("matchNumber", False):
        card_num = _card_number(card)
        active_num = _active_number(state)
        if card_num is not None and card_num == active_num:
            return True

    # Type/subtype match
    # Don't allow generic "number" subtype to match (would allow any number to match any number)
    # Only allow action cards (skip, reverse, etc.) to match by type
    if cfg.get("matchType", False):
        active_sub = _active_subtype(state)
        if card.subtype == active_sub and active_sub != "number":
            return True

    # If no match rules configured → always playable
    if not any([cfg.get("matchColor"), cfg.get("matchNumber"), cfg.get("matchType")]):
        return True

    return False


# ─────────────────────────────────────────────────────────────────────────────
# Deck recycling
# ─────────────────────────────────────────────────────────────────────────────

def _ensure_draw_cards(state: GameState, n: int = 1):
    """Recycle discard into draw if needed."""
    draw = _draw_zone(state)
    discard = _discard_zone(state)
    if draw and len(draw.cards) < n and discard and len(discard.cards) > 1:
        top = discard.cards[0]
        recycled = discard.cards[1:]
        for c in recycled:
            if c.metadata and c.metadata.get("color") == "wild":
                c.metadata = {**c.metadata, "color": "wild"}
        random.shuffle(recycled)
        draw.cards.extend(recycled)
        discard.cards = [top]
        state.log.append(_log("♻️ Draw pile reshuffled from discards.", "system"))


def _draw_n(state: GameState, player: Player, n: int) -> List[Card]:
    _ensure_draw_cards(state, n)
    draw = _draw_zone(state)
    if not draw:
        return []
    drawn = []
    for _ in range(n):
        if not draw.cards:
            break
        drawn.append(draw.cards.pop(0))
    player.hand.cards.extend(drawn)
    return drawn


# ─────────────────────────────────────────────────────────────────────────────
# Condition evaluator
# ─────────────────────────────────────────────────────────────────────────────

def _check_conditions(conditions: List[Dict], state: GameState, player: Player) -> Tuple[bool, str]:
    """Returns (all_met, failure_reason)."""
    for cond in conditions:
        ctype = cond.get("type")
        val = cond.get("value")

        if ctype == "has_card_type":
            if not any(c.subtype == val for c in player.hand.cards):
                return False, f"No {val} card in hand"

        elif ctype == "deck_size_gte":
            draw = _draw_zone(state)
            sz = len(draw.cards) if draw else 0
            if sz < int(val):
                return False, f"Draw pile has only {sz} cards"

        elif ctype == "hand_size_lte":
            if len(player.hand.cards) > int(val):
                return False, "Too many cards in hand"

        elif ctype == "active_color":
            if _active_color(state) != val:
                return False, f"Active color is not {val}"

        elif ctype == "turn_number_gte":
            if state.turnNumber < int(val):
                return False, "Too early in the game"

        elif ctype == "player_count_eq":
            if len(_active(state)) != int(val):
                return False, f"Need exactly {val} players remaining"

        elif ctype == "player_count_lte":
            if len(_active(state)) > int(val):
                return False, "Too many players remaining"

    return True, ""


# ─────────────────────────────────────────────────────────────────────────────
# Effect primitive handlers
# ─────────────────────────────────────────────────────────────────────────────

def _effect_number(state, player, card, effect, action, triggered):
    """Standard number/color card — just advances turn."""
    _set_active_color(state, card)
    col = _card_color(card) or ""
    col_emoji = _cfg(state).get("colorEmojis", {}).get(col, "")
    num = _card_number(card)
    label = f"{num}" if num is not None else card.name
    state.log.append(_log(
        f"{col_emoji} {player.name} played {card.name}.",
        "action", player.id, card.id,
    ))
    return None  # caller handles turn advance


def _effect_skip(state, player, card, effect, action, triggered):
    """Skip next player(s)."""
    skip_count = effect.get("value") or 1
    active = _active(state)
    _set_active_color(state, card)
    if len(active) == 2 and _cfg(state).get("reverseEqualsSkipTwoPlayers") and card.subtype == "reverse":
        skip_count = 1
    targets = [_peek_next(state, skip=i) for i in range(skip_count)]
    names = ", ".join(t.name for t in targets if t)
    state.log.append(_log(
        f"🚫 {player.name} played {card.name}! {names} {'loses' if len(targets)==1 else 'lose'} their turn.",
        "action", player.id, card.id,
    ))
    triggered.append(f"skip:{skip_count}")
    return {"skip": skip_count}


def _effect_reverse(state, player, card, effect, action, triggered):
    """Reverse direction. In 2-player, acts as skip."""
    active = _active(state)
    _set_active_color(state, card)
    if len(active) == 2 and _cfg(state).get("reverseEqualsSkipTwoPlayers", False):
        state.log.append(_log(
            f"🔄 {player.name} played Reverse (2-player = Skip)!",
            "action", player.id, card.id,
        ))
        triggered.append("reverse_as_skip")
        return {"skip": 1}
    _reverse_direction(state)
    state.log.append(_log(
        f"🔄 {player.name} played Reverse! Direction changed.",
        "action", player.id, card.id,
    ))
    triggered.append("reversed")
    return None


def _effect_draw(state, player, card, effect, action, triggered):
    """Force target player(s) to draw N cards."""
    n = effect.get("value") or 1
    target_mode = effect.get("target", "next_player")
    stackable = _cfg(state).get("stackableDraw", False)

    _set_active_color(state, card)

    if stackable:
        state.metadata["pendingDraw"] = state.metadata.get("pendingDraw", 0) + n
        total = state.metadata["pendingDraw"]
        nxt = _peek_next(state)
        state.log.append(_log(
            f"➕ {player.name} played {card.name}! {nxt.name if nxt else '?'} must draw {total} or stack.",
            "action", player.id, card.id,
        ))
        triggered.append(f"draw_stack:{total}")
        # Don't skip - let next player respond by stacking or drawing
        return None

    # Non-stacking: apply immediately
    if target_mode == "next_player":
        targets = [_peek_next(state)]
    elif target_mode == "all_others":
        cur = state.currentTurnPlayerId
        targets = [p for p in _active(state) if p.id != cur]
    elif target_mode == "choose":
        tid = action.targetPlayerId or (action.metadata or {}).get("targetPlayerId")
        targets = [_get_player(state, tid)] if tid else [_peek_next(state)]
    else:
        targets = [_peek_next(state)]

    for t in targets:
        if t:
            drawn = _draw_n(state, t, n)
            state.log.append(_log(
                f"📥 {t.name} draws {n} card{'s' if n>1 else ''} (from {player.name}'s {card.name}).",
                "effect", t.id,
            ))

    triggered.append(f"forced_draw:{n}")
    # Skip the affected player(s) if target was next_player
    if target_mode == "next_player":
        return {"skip": 1}
    return None


def _effect_self_draw(state, player, card, effect, action, triggered):
    """Current player draws N cards (e.g. draw-a-card penalty or bonus)."""
    n = effect.get("value") or 1
    _draw_n(state, player, n)
    state.log.append(_log(
        f"{player.name} draws {n} card{'s' if n>1 else ''}.",
        "action", player.id, card.id,
    ))
    triggered.append(f"self_draw:{n}")
    return None


def _effect_wild(state, player, card, effect, action, triggered):
    """Change active color. Triggers color picker if no color provided."""
    chosen = (action.metadata or {}).get("chosenColor") or (action.metadata or {}).get("color")
    # Load valid colors from game config (required in JSON)
    valid_colors = _cfg(state).get("colors", [])
    if not valid_colors:
        raise ValueError("Game config must define 'colors' array")

    if chosen in valid_colors:
        state.metadata["activeColor"] = chosen
        col_meta = card.metadata or {}
        col_meta["color"] = chosen
        card.metadata = col_meta
        color_emojis = _cfg(state).get("colorEmojis", {})
        state.log.append(_log(
            f"🌈 {player.name} played Wild → chose {color_emojis.get(chosen, chosen.capitalize())}!",
            "action", player.id, card.id,
        ))
        triggered.append(f"color_chosen:{chosen}")
        return None
    else:
        # Need to prompt color choice
        return {"needs_color_choice": True, "draw_count": 0}


def _effect_wild_draw(state, player, card, effect, action, triggered):
    """Wild + force next player to draw N. Triggers color picker first."""
    n = effect.get("value") or 4
    chosen = (action.metadata or {}).get("chosenColor") or (action.metadata or {}).get("color")
    # Load valid colors from game config (required in JSON)
    valid_colors = _cfg(state).get("colors", [])
    if not valid_colors:
        raise ValueError("Game config must define 'colors' array")
    stackable = _cfg(state).get("stackableDraw", False)
    allow_challenge = _cfg(state).get("allowWildDraw4Challenge", False)

    pending_total = state.metadata.get("pendingDraw", 0) + n
    state.metadata["pendingDraw"] = pending_total

    if chosen in valid_colors:
        state.metadata["activeColor"] = chosen
        col_meta = card.metadata or {}
        col_meta["color"] = chosen
        card.metadata = col_meta
        nxt = _peek_next(state)
        state.log.append(_log(
            f"🌈 {player.name} played Wild Draw {n}! {nxt.name if nxt else '?'} must draw {pending_total}.",
            "action", player.id, card.id,
        ))
        triggered.append(f"wild_draw:{pending_total}")
        # Only open challenge window if configured AND there are 3+ players
        # (challenge mechanics don't work well in 2-player games)
        active_count = len(_active(state))
        if allow_challenge and active_count > 2:
            return {"skip": 1, "challenge_window": True, "draw_count": pending_total}
        else:
            # Behave like regular draw card - next player draws or stacks
            # Don't skip - let them respond
            return None
    else:
        return {"needs_color_choice": True, "draw_count": pending_total, "is_wild_draw": True, "draw_n": n}


def _effect_eliminate(state, player, card, effect, action, triggered):
    """Eliminate a player from the game (Exploding Kittens style)."""
    target_mode = effect.get("target", "self")
    if target_mode == "self":
        target = player
    else:
        tid = (action.metadata or {}).get("targetPlayerId") or action.targetPlayerId
        target = _get_player(state, tid) if tid else player

    # Check conditions on the effect (e.g. has_card_type:defuse)
    conds = effect.get("conditions", [])
    if conds:
        met, reason = _check_conditions(conds, state, target)
        if not met:
            # Condition not met → elimination is blocked (e.g. has defuse)
            triggered.append(f"elimination_blocked:{reason}")
            return {"elimination_blocked": True, "condition_fail": reason}

    target.status = "eliminated"
    discard = _discard_zone(state)
    discard.cards.insert(0, card)
    state.log.append(_log(
        f"💥 {target.name} has been eliminated!", "effect", target.id,
    ))
    triggered.append(f"eliminated:{target.id}")

    # Check if game is over
    remaining = _active(state)
    if len(remaining) == 1:
        remaining[0].status = "winner"
        state.winner = remaining[0]
        state.phase = "ended"
        state.log.append(_log(f"🎉 {remaining[0].name} wins!", "system"))
        triggered.append("game_over")
    return None


def _effect_defuse(state, player, card, effect, action, triggered):
    """Consume a defuse card to cancel an incoming elimination, then reinsert the bomb."""
    # Find a defuse card in player's hand
    defuse_subtype = effect.get("consumes", "defuse")
    defuse = next((c for c in player.hand.cards if c.subtype == defuse_subtype), None)
    if not defuse:
        triggered.append("defuse_failed:no_defuse_card")
        return {"defuse_failed": True}

    player.hand.cards.remove(defuse)
    discard = _discard_zone(state)
    discard.cards.insert(0, defuse)
    state.log.append(_log(
        f"🔧 {player.name} used a Defuse card!", "effect", player.id,
    ))
    triggered.append("defused")

    # Enter awaiting_response so player can choose where to re-insert
    draw = _draw_zone(state)
    state.phase = "awaiting_response"
    state.pendingAction = {
        "type": "insert_card",
        "playerId": player.id,
        "card": card.dict(),
        "deckSize": len(draw.cards) if draw else 0,
    }
    triggered.append("insert_pending")
    return {"halt_turn_advance": True}


def _effect_peek(state, player, card, effect, action, triggered):
    """Reveal top N cards of the draw pile to the playing player only."""
    n = effect.get("value") or 3
    draw = _draw_zone(state)
    top_n = [c.name for c in (draw.cards[:n] if draw else [])]
    state.log.append(_log(
        f"🔮 {player.name} peeked at the top {n} cards.",
        "action", player.id, card.id,
    ))
    triggered.append(f"top{n}:{','.join(top_n)}")
    return None


def _effect_shuffle(state, player, card, effect, action, triggered):
    """Shuffle the draw pile."""
    draw = _draw_zone(state)
    if draw:
        random.shuffle(draw.cards)
    state.log.append(_log(
        f"🔀 {player.name} shuffled the draw pile.",
        "action", player.id, card.id,
    ))
    triggered.append("shuffled")
    return None


def _effect_steal(state, player, card, effect, action, triggered):
    """Steal a card from another player (random or chosen)."""
    tid = action.targetPlayerId or (action.metadata or {}).get("targetPlayerId")
    target = _get_player(state, tid) if tid else None
    if not target or not target.hand.cards:
        state.log.append(_log(f"{player.name} tried to steal but target has no cards.", "action"))
        return None

    mode = effect.get("cardChoice", "random")  # random | chosen
    if mode == "chosen":
        card_id = (action.metadata or {}).get("cardId")
        stolen = next((c for c in target.hand.cards if c.id == card_id), None) or \
                 random.choice(target.hand.cards)
    else:
        stolen = random.choice(target.hand.cards)

    target.hand.cards.remove(stolen)
    player.hand.cards.append(stolen)
    state.log.append(_log(
        f"🤲 {player.name} stole a card from {target.name}!",
        "action", player.id, card.id,
    ))
    triggered.append(f"stolen:{target.id}")
    return None


def _effect_give(state, player, card, effect, action, triggered):
    """Give a card to another player (Favor-style: target chooses which to give)."""
    tid = action.targetPlayerId or (action.metadata or {}).get("targetPlayerId")
    target = _get_player(state, tid) if tid else None
    if not target:
        # Need to select target first
        return {"needs_target": True, "pending_type": "give"}
    if not target.hand.cards:
        state.log.append(_log(f"{player.name} used {card.name} but {target.name} has no cards.", "action"))
        return None

    state.log.append(_log(
        f"🙏 {player.name} asks {target.name} for a card.",
        "action", player.id, card.id,
    ))
    state.phase = "awaiting_response"
    state.pendingAction = {
        "type": "give_card",
        "playerId": player.id,
        "targetPlayerId": target.id,
    }
    triggered.append("give_pending")
    return {"halt_turn_advance": True}


def _effect_insert(state, player, card, effect, action, triggered):
    """Insert a held card into the draw pile at a chosen position (used after defuse)."""
    # This is handled separately via the "insert_card" pending action
    return None


def _effect_extra_turn(state, player, card, effect, action, triggered):
    """Give the current player an extra turn."""
    state.metadata["extraTurn"] = player.id
    state.log.append(_log(
        f"⏩ {player.name} gets an extra turn!",
        "action", player.id, card.id,
    ))
    triggered.append("extra_turn")
    return {"extra_turn": True}


def _effect_swap_hands(state, player, card, effect, action, triggered):
    """Swap hands with another player."""
    tid = action.targetPlayerId or (action.metadata or {}).get("targetPlayerId")
    target = _get_player(state, tid) if tid else None
    if not target:
        return {"needs_target": True, "pending_type": "swap_hands"}

    player.hand.cards, target.hand.cards = target.hand.cards, player.hand.cards
    state.log.append(_log(
        f"🔃 {player.name} swapped hands with {target.name}!",
        "action", player.id, card.id,
    ))
    triggered.append(f"swapped_hands:{target.id}")
    return None


def _effect_score(state, player, card, effect, action, triggered):
    """Add or subtract score points."""
    n = effect.get("value", 0)
    target_mode = effect.get("target", "self")
    target = player if target_mode == "self" else (_peek_next(state) if target_mode == "next_player" else player)
    if target:
        scores = state.metadata.setdefault("scores", {})
        scores[target.id] = scores.get(target.id, 0) + n
        state.log.append(_log(
            f"🏆 {target.name} {'gains' if n >= 0 else 'loses'} {abs(n)} point{'s' if abs(n)!=1 else ''}.",
            "effect", target.id,
        ))
    triggered.append(f"score:{n}")
    return None


def _effect_any(state, player, card, effect, action, triggered):
    """No-op / cosmetic effect."""
    state.log.append(_log(f"{player.name} played {card.name}.", "action", player.id, card.id))
    return None


# ─────────────────────────────────────────────────────────────────────────────
# Effect dispatch table
# ─────────────────────────────────────────────────────────────────────────────

EFFECT_HANDLERS = {
    "number":       _effect_number,
    "skip":         _effect_skip,
    "reverse":      _effect_reverse,
    "draw":         _effect_draw,
    "self_draw":    _effect_self_draw,
    "wild":         _effect_wild,
    "wild_draw":    _effect_wild_draw,
    "eliminate":    _effect_eliminate,
    "defuse":       _effect_defuse,
    "peek":         _effect_peek,
    "shuffle":      _effect_shuffle,
    "steal":        _effect_steal,
    "give":         _effect_give,
    "insert":       _effect_insert,
    "extra_turn":   _effect_extra_turn,
    "swap_hands":   _effect_swap_hands,
    "score":        _effect_score,
    "any":          _effect_any,
    # Aliases used in existing JSON files
    "combo_steal":  _effect_steal,
    "cancel":       _effect_any,
}


# ─────────────────────────────────────────────────────────────────────────────
# Plugin system import (MUST be after utility functions to avoid circular import)
# ─────────────────────────────────────────────────────────────────────────────
# exploding_kittens.py imports _log, _active, _draw_zone, etc. from this module.
# If we import plugin_loader at the top of the file, it triggers plugin discovery
# which imports exploding_kittens.py before those functions are defined → ImportError.
try:
    from app.services.engines import plugin_loader
    PLUGIN_AVAILABLE = True
except ImportError:
    PLUGIN_AVAILABLE = False


# ─────────────────────────────────────────────────────────────────────────────
# Win condition checker
# ─────────────────────────────────────────────────────────────────────────────

def _check_win(state: GameState, player: Player, triggered: List[str]) -> bool:
    wc = state.rules.winCondition.type

    if wc == "empty_hand":
        if not player.hand.cards:
            player.status = "winner"
            state.winner = player
            state.phase = "ended"
            state.log.append(_log(f"🎉 {player.name} plays their last card and wins!", "system"))
            triggered.append("win")
            return True

    elif wc == "last_standing":
        active = _active(state)
        if len(active) == 1:
            active[0].status = "winner"
            state.winner = active[0]
            state.phase = "ended"
            state.log.append(_log(f"🎉 {active[0].name} is the last one standing and wins!", "system"))
            triggered.append("win")
            return True

    elif wc == "most_points":
        # Game ends when deck is empty or all players have passed
        draw = _draw_zone(state)
        if not draw or not draw.cards:
            scores = state.metadata.get("scores", {})
            best_id = max(scores, key=scores.get) if scores else None
            winner = _get_player(state, best_id) if best_id else None
            if winner:
                winner.status = "winner"
                state.winner = winner
                state.phase = "ended"
                state.log.append(_log(f"🎉 {winner.name} wins with {scores.get(best_id, 0)} points!", "system"))
                triggered.append("win")
                return True

    elif wc == "target_score":
        target_pts = state.rules.winCondition.metadata.get("targetScore", 500)
        scores = state.metadata.get("scores", {})
        for pid, pts in scores.items():
            if pts >= target_pts:
                winner = _get_player(state, pid)
                if winner:
                    winner.status = "winner"
                    state.winner = winner
                    state.phase = "ended"
                    state.log.append(_log(f"🎉 {winner.name} reaches {pts} points and wins!", "system"))
                    triggered.append("win")
                    return True

    return False


# ─────────────────────────────────────────────────────────────────────────────
# Default Actions (Game-specific buttons)
# ─────────────────────────────────────────────────────────────────────────────

def get_available_default_actions(state: GameState, player_id: str) -> List[Dict[str, Any]]:
    """
    Determine which default action buttons should be shown to a player.
    Returns a list of available actions based on game config and current state.
    """
    available = []
    cfg = _cfg(state)
    default_actions = cfg.get("defaultActions", [])

    if not default_actions:
        return []

    player = _get_player(state, player_id)
    if not player or state.phase != "playing":
        return []

    uno_called_by = state.metadata.get("unoCalledBy", [])

    for action_def in default_actions:
        condition = action_def.get("showCondition")
        should_show = False

        if condition == "self_has_one_card":
            # Show "Call UNO" button if player has 1 card and hasn't called
            if len(player.hand.cards) == 1 and player.id not in uno_called_by:
                should_show = True

        elif condition == "opponent_has_one_card_no_call":
            # Show "Catch UNO" button if any opponent has 1 card without calling
            for other in state.players:
                if (other.id != player_id and
                    other.status == "active" and
                    len(other.hand.cards) == 1 and
                    other.id not in uno_called_by):
                    should_show = True
                    # Add target player info
                    action_def = {**action_def, "targetPlayerId": other.id, "targetPlayerName": other.name}
                    break

        if should_show:
            available.append({
                "id": action_def.get("id"),
                "label": action_def.get("label"),
                "icon": action_def.get("icon"),
                "description": action_def.get("description"),
                "actionType": action_def.get("actionType"),
                "color": action_def.get("color", "blue"),
                "targetPlayerId": action_def.get("targetPlayerId"),
                "targetPlayerName": action_def.get("targetPlayerName"),
            })

    return available


# ─────────────────────────────────────────────────────────────────────────────
# Setup
# ─────────────────────────────────────────────────────────────────────────────

def setup_game(state: GameState):
    raw_defs = state.metadata.get("cardDefinitions", [])
    card_defs = _parse_card_definitions(raw_defs)
    cfg = _cfg(state)

    # Cards with "notInStartDeck" are excluded from initial build
    exclude_ids = [d.id for d in card_defs if d.metadata.get("notInStartDeck")]
    deck = build_deck_from_definitions(card_defs, exclude_ids=exclude_ids)

    # Resolve cardColorMap → inject borderColor / cardBg into each card's metadata
    _apply_card_color_map(deck, cfg)

    random.shuffle(deck)

    # Deal hands
    hand_size = state.rules.handSize
    for i, player in enumerate(state.players):
        hand_cards = []
        # If any card type should be in every starting hand, deal it first
        for defn in card_defs:
            if defn.metadata.get("guaranteedInStartHand"):
                matching = [c for c in deck if c.definitionId == defn.id]
                if matching:
                    c = matching[0]
                    deck.remove(c)
                    hand_cards.append(c)
        # Fill remaining hand from deck
        remaining = max(0, hand_size - len(hand_cards))
        for _ in range(min(remaining, len(deck))):
            hand_cards.append(deck.pop())
        player.hand = Hand(playerId=player.id, cards=hand_cards, isVisible=True)
        player.status = "active"
        player.isCurrentTurn = i == 0
        player.turnCount = 1

    # Insert special "injected" cards after dealing (e.g. Exploding Kittens bombs)
    for defn in card_defs:
        inject = defn.metadata.get("injectCount")
        if inject == "players_minus_one":
            inject = len(state.players) - 1
        elif isinstance(inject, str):
            inject = int(inject)
        if inject and isinstance(inject, int) and inject > 0:
            for j in range(inject):
                from app.models.game import Card as CardModel
                c = CardModel(
                    id=f"{defn.id}_injected_{j}",
                    definitionId=defn.id,
                    name=defn.name,
                    type=defn.type,
                    subtype=defn.subtype or defn.id,
                    emoji=defn.emoji,
                    description=defn.description,
                    effects=defn.effects,
                    isPlayable=defn.isPlayable,
                    isReaction=defn.isReaction,
                    metadata=defn.metadata.copy(),
                )
                deck.append(c)

    # Apply color map to injected cards as well
    _apply_card_color_map(deck, cfg)

    random.shuffle(deck)

    # Build zones (from JSON config, default to draw+discard)
    zone_defs = cfg.get("zones", [
        {"id": "draw_pile",    "name": "Draw Pile",    "type": "deck",    "isPublic": False},
        {"id": "discard_pile", "name": "Discard Pile", "type": "discard", "isPublic": True},
    ])
    zones = [Zone(id=z["id"], name=z["name"], type=z["type"],
                  cards=[], isPublic=z.get("isPublic", True)) for z in zone_defs]
    # All cards go in the first "deck" zone
    draw_zone = next((z for z in zones if z.type == "deck"), None)
    if draw_zone:
        draw_zone.cards = deck

    # For games with a starting discard (UNO: flip first non-wild card)
    if cfg.get("startWithDiscard", False):
        discard_zone = next((z for z in zones if z.type == "discard"), None)
        if draw_zone and discard_zone:
            first = None
            for idx, c in enumerate(draw_zone.cards):
                exclude_start = cfg.get("excludeFromStartDiscard", [])
                if c.subtype not in exclude_start:
                    first = draw_zone.cards.pop(idx)
                    break
            if first:
                discard_zone.cards = [first]
                _set_active_color(state, first)

    state.zones = zones
    state.currentTurnPlayerId = state.players[0].id
    state.turnNumber = 1
    state.phase = "playing"

    # Initialise runtime metadata from config defaults
    state.metadata.setdefault("direction", 1)
    state.metadata.setdefault("pendingDraw", 0)
    state.metadata.setdefault("scores", {p.id: 0 for p in state.players})
    if cfg.get("matchColor") and not state.metadata.get("activeColor"):
        # Set initial active color from first discard if not already set
        discard_zone = next((z for z in zones if z.type == "discard"), None)
        if discard_zone and discard_zone.cards:
            _set_active_color(state, discard_zone.cards[0])

    state.log.append(_log(f"🎮 {state.gameName} started!", "system"))


# ─────────────────────────────────────────────────────────────────────────────
# Main action handler
# ─────────────────────────────────────────────────────────────────────────────

def apply_action(state: GameState, action) -> Tuple[bool, str, List[str]]:
    # Try plugin custom actions first
    if PLUGIN_AVAILABLE:
        game_id = state.metadata.get("gameId") or state.gameType
        game_config = state.metadata.get("gameConfig", {})
        plugin = plugin_loader.get_plugin(game_id, game_config)

        if plugin:
            custom_actions = plugin.get_custom_actions()
            custom_handler = custom_actions.get(action.type)
            if custom_handler:
                # Plugin handles this action
                return custom_handler(state, action)

    # Fall back to universal actions
    dispatch = {
        "play_card":      _action_play_card,
        "draw_card":      _action_draw_card,
        "choose_color":   _action_choose_color,
        "insert_card":    _action_insert_card,
        "give_card":      _action_give_card,
        "select_target":  _action_select_target,
        "call_uno":       _action_call_uno,
        "catch_uno":      _action_catch_uno,
        "challenge":      _action_challenge,
    }
    handler = dispatch.get(action.type)
    if not handler:
        return False, f"Unknown action: {action.type}", []
    return handler(state, action)


# ─────────────────────────────────────────────────────────────────────────────
# Action implementations
# ─────────────────────────────────────────────────────────────────────────────

def _action_play_card(state, action) -> Tuple[bool, str, List[str]]:
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
    if not _can_play_card(card, state):
        return False, "That card cannot be played right now", []

    # Load plugin once for this card play
    plugin = None
    if PLUGIN_AVAILABLE:
        game_id = state.metadata.get("gameId") or state.gameType
        game_config = state.metadata.get("gameConfig", {})
        plugin = plugin_loader.get_plugin(game_id, game_config)

    # Call plugin lifecycle hook
    hook_halt = False
    if plugin:
        try:
            hook_result = plugin.on_card_played(state, player, card)
            if hook_result:
                if not hook_result.get("valid", True):
                    return False, hook_result.get("error", "Invalid play"), []
                if hook_result.get("halt_turn_advance"):
                    hook_halt = True
        except Exception as e:
            print(f"Warning: Plugin on_card_played hook failed: {e}")

    # Remove from hand and place on discard
    player.hand.cards.remove(card)
    discard = _discard_zone(state)
    if discard:
        discard.cards.insert(0, card)

    triggered: List[str] = [f"played:{card.subtype}"]
    skip_extra = 0
    halt = False
    extra_turn = False

    # Execute each effect on the card
    for eff in card.effects:
        etype = eff.type
        edict = eff.dict()

        # Check per-effect conditions
        conds = edict.get("metadata", {}).get("conditions", []) if edict.get("metadata") else []
        if conds:
            met, reason = _check_conditions(conds, state, player)
            if not met:
                # Special case: defuse-check on elimination
                if etype == "eliminate":
                    # Check if player has a defuse via "defuse" effect on the card
                    defuse_eff = next((e for e in card.effects if e.type == "defuse"), None)
                    if defuse_eff:
                        result = _effect_defuse(state, player, card, defuse_eff.dict(), action, triggered)
                        if result and result.get("halt_turn_advance"):
                            halt = True
                        continue
                triggered.append(f"condition_failed:{reason}")
                continue

        # Check plugin custom effects first
        handler = None
        if plugin:
            custom_effects = plugin.get_custom_effects()
            handler = custom_effects.get(etype)

        # Fall back to universal effect handlers
        if handler is None:
            handler = EFFECT_HANDLERS.get(etype)

        if handler is None:
            state.log.append(_log(f"{player.name} played {card.name}.", "action", player.id, card.id))
            continue

        try:
            result = handler(state, player, card, edict, action, triggered)
        except Exception as e:
            print(f"Error in effect handler for {etype}: {e}")
            import traceback
            traceback.print_exc()
            return False, f"Effect handler error: {str(e)}", []

        if result is None:
            continue
        if result.get("halt_turn_advance"):
            halt = True
        if result.get("skip"):
            skip_extra = max(skip_extra, result["skip"])
        if result.get("extra_turn"):
            extra_turn = True
        if result.get("needs_color_choice"):
            # Enter awaiting_response for color picker
            state.phase = "awaiting_response"

            # Build choices from game config (colors required in JSON)
            config = _cfg(state)
            colors = config.get("colors", [])
            if not colors:
                raise ValueError("Game config must define 'colors' array")
            color_emojis = config.get("colorEmojis", {})

            choices = [
                {
                    "value": color,
                    "label": color.capitalize(),
                    "icon": color_emojis.get(color, "⚪")
                }
                for color in colors
            ]

            state.pendingAction = {
                "type": "choose_color",
                "playerId": player.id,
                "cardId": card.id,
                "drawCount": result.get("draw_count", 0),
                "isWildDraw": result.get("is_wild_draw", False),
                "drawN": result.get("draw_n", 0),
                "choices": choices,
                "prompt": "Choose a color for the Wild card",
            }
            halt = True
        if result.get("needs_target"):
            state.phase = "awaiting_response"
            state.pendingAction = {
                "type": result.get("pending_type", "select_target"),
                "playerId": player.id,
                "cardId": card.id,
            }
            halt = True
        if result.get("challenge_window"):
            # Advance to next player (who will challenge or accept), don't skip them yet
            if not halt:
                _advance_turn(state, skip=0)  # Advance to next player without skipping
                skip_extra = 0  # Clear skip since we handled turn advancement
            state.phase = "awaiting_response"
            state.pendingAction = {
                "type": "challenge_or_accept",
                "playerId": state.currentTurnPlayerId,  # Next player responds
                "challengedPlayerId": player.id,  # Original player who played the card
                "drawCount": result.get("draw_count", 4),
            }
            halt = True

    if state.phase == "ended":
        return True, "", triggered

    # Check win condition
    if _check_win(state, player, triggered):
        return True, "", triggered

    # UNO warning
    if len(player.hand.cards) == 1:
        triggered.append(f"uno_warning:{player.id}")
        state.metadata.setdefault("unoCalledBy", [])

    # Combine halt flags from effects and plugin hook
    if not halt and not hook_halt:
        if extra_turn:
            # Same player goes again; just increment turn number
            state.turnNumber += 1
        else:
            _advance_turn(state, skip=skip_extra)

    return True, "", triggered


def _action_draw_card(state, action) -> Tuple[bool, str, List[str]]:
    player = _get_player(state, action.playerId)
    if not player:
        return False, "Player not found", []
    if state.currentTurnPlayerId != player.id:
        return False, "Not your turn", []
    if state.phase != "playing":
        return False, "Cannot draw right now", []

    pending = state.metadata.get("pendingDraw", 0)
    n = pending if pending > 0 else state.rules.turnStructure.drawCount
    state.metadata["pendingDraw"] = 0

    drawn = _draw_n(state, player, n)

    if pending > 0:
        state.log.append(_log(f"{player.name} draws {n} cards (stacked penalty).", "action", player.id))
        _advance_turn(state)
    else:
        state.log.append(_log(f"{player.name} draws {n} card{'s' if n>1 else ''}.", "action", player.id))
        # Check if drawn card is immediately playable
        cfg = _cfg(state)
        if drawn and cfg.get("drawUntilPlayable", False):
            # Keep drawing until you get a playable card (Crazy Eights variant)
            while drawn and not _can_play_card(drawn[-1], state):
                more = _draw_n(state, player, 1)
                if not more:
                    break
                drawn.extend(more)
        _advance_turn(state)

    return True, "", [f"drew:{n}"]


def _action_choose_color(state, action) -> Tuple[bool, str, List[str]]:
    pending = state.pendingAction
    if not pending or pending.get("type") != "choose_color":
        return False, "No color choice pending", []
    if action.playerId != pending["playerId"]:
        return False, "Not your pending action", []

    chosen = (action.metadata or {}).get("color")
    # Load valid colors from game config (required in JSON)
    valid = _cfg(state).get("colors", [])
    if not valid:
        return False, "Game config must define 'colors' array", []
    if chosen not in valid:
        return False, f"Invalid color: {chosen}", []

    state.metadata["activeColor"] = chosen
    discard = _discard_zone(state)
    if discard and discard.cards:
        top = discard.cards[0]
        top.metadata = {**(top.metadata or {}), "color": chosen}

    player = _get_player(state, pending["playerId"])
    color_emojis = _cfg(state).get("colorEmojis", {})
    state.log.append(_log(
        f"🎨 {player.name if player else '?'} chose {color_emojis.get(chosen, chosen)}!",
        "action", pending["playerId"],
    ))

    triggered = [f"color_chosen:{chosen}"]
    state.pendingAction = None
    state.phase = "playing"

    is_wild_draw = pending.get("isWildDraw", False)
    draw_count = pending.get("drawCount", 0)

    if player and _check_win(state, player, triggered):
        return True, "", triggered

    if is_wild_draw and draw_count > 0:
        allow_challenge = _cfg(state).get("allowWildDraw4Challenge", False)
        active_count = len(_active(state))
        # Only open challenge window if configured AND there are 3+ players
        if allow_challenge and active_count > 2:
            # Advance and open challenge window
            _advance_turn(state)
            state.phase = "awaiting_response"
            state.pendingAction = {
                "type": "challenge_or_accept",
                "playerId": state.currentTurnPlayerId,
                "challengedPlayerId": pending["playerId"],
                "drawCount": draw_count,
            }
            triggered.append(f"wild_draw_pending:{draw_count}")
        else:
            # Treat like regular draw - next player can stack or draw (2 players or challenge disabled)
            _advance_turn(state)
    else:
        _advance_turn(state)

    return True, "", triggered


def _action_insert_card(state, action) -> Tuple[bool, str, List[str]]:
    """Player places a card back into the draw pile at their chosen position."""
    pending = state.pendingAction
    if not pending or pending.get("type") != "insert_card":
        return False, "No insert pending", []
    if action.playerId != pending["playerId"]:
        return False, "Not your action", []

    from app.models.game import Card as CardModel
    draw = _draw_zone(state)
    bomb = CardModel(**pending["card"])
    pos = (action.metadata or {}).get("position", random.randint(0, len(draw.cards) if draw else 0))
    pos = max(0, min(pos, len(draw.cards) if draw else 0))
    if draw:
        draw.cards.insert(pos, bomb)

    state.pendingAction = None
    state.phase = "playing"
    state.log.append(_log(f"🃏 A card was secretly reinserted into the deck.", "system"))
    _advance_turn(state)
    return True, "", ["card_inserted"]


def _action_give_card(state, action) -> Tuple[bool, str, List[str]]:
    """Target player gives a card of their choice."""
    pending = state.pendingAction
    if not pending or pending.get("type") != "give_card":
        return False, "No give_card pending", []
    if action.playerId != pending["targetPlayerId"]:
        return False, "Not your action", []

    giver = _get_player(state, pending["targetPlayerId"])
    receiver = _get_player(state, pending["playerId"])
    if not giver or not receiver:
        return False, "Player not found", []

    card_id = (action.metadata or {}).get("cardId") or action.cardId
    card = next((c for c in giver.hand.cards if c.id == card_id), None)
    if not card:
        card = random.choice(giver.hand.cards) if giver.hand.cards else None
    if not card:
        return False, "No cards to give", []

    giver.hand.cards.remove(card)
    receiver.hand.cards.append(card)
    state.pendingAction = None
    state.phase = "playing"
    state.log.append(_log(
        f"🎁 {giver.name} gave a card to {receiver.name}.",
        "effect", giver.id,
    ))
    _advance_turn(state)
    return True, "", ["give_resolved"]


def _action_select_target(state, action) -> Tuple[bool, str, List[str]]:
    """Generic target selection resolver."""
    pending = state.pendingAction
    if not pending:
        return False, "No pending action", []

    ptype = pending.get("type", "")
    if ptype == "give_card":
        return _action_give_card(state, action)
    if ptype == "challenge_or_accept":
        return _action_challenge(state, action)

    return False, f"Unknown pending type: {ptype}", []


def _action_challenge(state, action) -> Tuple[bool, str, List[str]]:
    """Handle Wild Draw 4 challenge or acceptance."""
    pending = state.pendingAction
    if not pending or pending.get("type") != "challenge_or_accept":
        return False, "No challenge pending", []
    if action.playerId != pending["playerId"]:
        return False, "Not your challenge", []

    challenger = _get_player(state, pending["playerId"])
    challenged = _get_player(state, pending["challengedPlayerId"])
    draw_count = pending.get("drawCount", 4)
    do_challenge = (action.metadata or {}).get("challenge", False)

    state.pendingAction = None
    state.phase = "playing"
    state.metadata["pendingDraw"] = 0
    triggered = []

    if not do_challenge:
        if challenger:
            _draw_n(state, challenger, draw_count)
            state.log.append(_log(
                f"{challenger.name} accepts and draws {draw_count} cards.", "action", challenger.id,
            ))
        triggered.append(f"accepted:{draw_count}")
        _advance_turn(state)
    else:
        was_illegal = state.metadata.get("lastWildDraw4WasIllegal", False)
        if was_illegal:
            # Challenge successful: challenged player draws, challenger gets to play
            if challenged:
                _draw_n(state, challenged, 4)
                state.log.append(_log(
                    f"⚖️ Challenge SUCCESS! {challenged.name} draws 4! {challenger.name if challenger else '?'} plays.",
                    "effect",
                ))
            triggered.append("challenge_success")
            # Don't advance turn - challenger stays current and gets to play their turn
        else:
            # Challenge failed: challenger draws penalty and loses their turn
            penalty = draw_count + 2
            if challenger:
                _draw_n(state, challenger, penalty)
                state.log.append(_log(
                    f"⚖️ Challenge FAILED! {challenger.name} draws {penalty}.", "effect",
                ))
            triggered.append(f"challenge_failed:{penalty}")
            _advance_turn(state)

    return True, "", triggered


def _action_call_uno(state, action) -> Tuple[bool, str, List[str]]:
    player = _get_player(state, action.playerId)
    if not player or len(player.hand.cards) != 1:
        return False, "Can only call UNO with exactly 1 card", []
    called = state.metadata.setdefault("unoCalledBy", [])
    if player.id not in called:
        called.append(player.id)
    state.log.append(_log(f"🗣️ {player.name} calls UNO!", "effect", player.id))
    return True, "", ["uno_called"]


def _action_catch_uno(state, action) -> Tuple[bool, str, List[str]]:
    target = _get_player(state, action.targetPlayerId)
    catcher = _get_player(state, action.playerId)
    if not target or not catcher:
        return False, "Player not found", []
    if target.id in state.metadata.get("unoCalledBy", []):
        return False, f"{target.name} already called UNO", []
    if len(target.hand.cards) != 1:
        return False, "That player doesn't have 1 card", []
    _draw_n(state, target, 2)
    state.log.append(_log(
        f"🚨 {catcher.name} caught {target.name} not saying UNO! They draw 2.", "effect", catcher.id,
    ))
    return True, "", [f"caught_uno:{target.id}"]
