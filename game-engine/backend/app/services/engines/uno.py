"""
UNO Game Plugin
===============
Handles UNO-specific game logic that can't be covered by universal.py.

Includes:
- Color choice for Wild cards (with UI prompt)
- UNO call mechanism
- Wild Draw 4 challenge logic
- Color validation
"""
import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

from app.models.game import GameState, Player, Card, LogEntry
from app.services.engines.game_plugin_base import GamePluginBase


def _ts() -> int:
    return int(datetime.now().timestamp() * 1000)


def _log(msg: str, type_: str = "action", pid: str = None, cid: str = None) -> LogEntry:
    return LogEntry(
        id=str(uuid.uuid4()),
        timestamp=_ts(),
        message=msg,
        type=type_,
        playerId=pid,
        cardId=cid
    )


class UnoPlugin(GamePluginBase):
    """UNO-specific game logic plugin."""

    def __init__(self, game_id: str, game_config: Dict[str, Any]):
        super().__init__(game_id, game_config)

    # -------------------------------------------------------------------------
    # Custom Actions
    # -------------------------------------------------------------------------

    def get_custom_actions(self) -> Dict[str, callable]:
        """Register UNO-specific actions."""
        return {
            "choose_color": self._action_choose_color,
            "call_uno": self._action_call_uno,
            "catch_uno": self._action_catch_uno,
            "challenge_wild_draw4": self._action_challenge,
        }

    def _action_choose_color(self, state: GameState, action) -> Tuple[bool, str, List[str]]:
        """
        Handle color selection for Wild and Wild Draw 4 cards.
        This is called when a player selects a color from the UI.
        """
        pending = state.pendingAction
        if not pending or pending.get("type") != "choose_color":
            return False, "No color choice pending", []

        if action.playerId != pending["playerId"]:
            return False, "Not your color choice", []

        # Get chosen color from action
        chosen = (action.metadata or {}).get("color")
        valid_colors = self.config.get("colors", ["red", "yellow", "green", "blue"])

        if chosen not in valid_colors:
            return False, f"Invalid color: {chosen}. Must be one of {valid_colors}", []

        # Set the active color
        state.metadata["activeColor"] = chosen

        # Update the card's metadata to reflect chosen color
        from app.services.engines.universal import _discard_zone
        discard = _discard_zone(state)
        if discard and discard.cards:
            top = discard.cards[0]
            top.metadata = {**(top.metadata or {}), "color": chosen}

        # Log the color choice
        player = self.get_player(state, pending["playerId"])
        color_emojis = self.config.get("colorEmojis", {})
        state.log.append(_log(
            f"🎨 {player.name if player else '?'} chose {color_emojis.get(chosen, chosen)}!",
            "action",
            pending["playerId"]
        ))

        # Clear pending action and return to playing
        state.pendingAction = None
        state.phase = "playing"

        triggered = [f"color_chosen:{chosen}"]

        # Check if this was a Wild Draw - if so, advance turn
        is_wild_draw = pending.get("isWildDraw", False)
        if is_wild_draw:
            from app.services.engines.universal import _advance_turn
            _advance_turn(state)

        # Check win condition
        if player and not player.hand.cards:
            player.status = "winner"
            state.winner = player
            state.phase = "ended"
            state.log.append(_log(f"🎉 {player.name} wins!", "system"))
            triggered.append("win")

        return True, "", triggered

    def _action_call_uno(self, state: GameState, action) -> Tuple[bool, str, List[str]]:
        """Handle UNO call when a player has 1 card left."""
        player = self.get_player(state, action.playerId)
        if not player:
            return False, "Player not found", []

        # Validate that player has exactly 1 card
        if len(player.hand.cards) != 1:
            return False, "Can only call UNO with exactly 1 card", []

        # Record UNO call
        called = state.metadata.setdefault("unoCalledBy", [])
        if player.id not in called:
            called.append(player.id)

        state.log.append(_log(
            f"🗣️ {player.name} calls UNO!",
            "effect",
            player.id
        ))

        return True, "", ["uno_called"]

    def _action_catch_uno(self, state: GameState, action) -> Tuple[bool, str, List[str]]:
        """Catch a player who forgot to call UNO."""
        target_id = action.targetPlayerId or (action.metadata or {}).get("targetPlayerId")
        target = self.get_player(state, target_id)
        catcher = self.get_player(state, action.playerId)

        if not target or not catcher:
            return False, "Player not found", []

        # Check if target already called UNO
        if target.id in state.metadata.get("unoCalledBy", []):
            return False, f"{target.name} already called UNO", []

        # Check if target has exactly 1 card
        if len(target.hand.cards) != 1:
            return False, "That player doesn't have 1 card", []

        # Apply penalty - target draws 2 cards
        from app.services.engines.universal import _draw_n
        _draw_n(state, target, 2)

        state.log.append(_log(
            f"🚨 {catcher.name} caught {target.name} not saying UNO! They draw 2.",
            "effect",
            catcher.id
        ))

        return True, "", [f"caught_uno:{target.id}"]

    def _action_challenge(self, state: GameState, action) -> Tuple[bool, str, List[str]]:
        """Handle Wild Draw 4 challenge."""
        pending = state.pendingAction
        if not pending or pending.get("type") != "challenge_or_accept":
            return False, "No challenge pending", []

        if action.playerId != pending["playerId"]:
            return False, "Not your challenge", []

        challenger = self.get_player(state, pending["playerId"])
        challenged = self.get_player(state, pending["challengedPlayerId"])
        draw_count = pending.get("drawCount", 4)
        do_challenge = (action.metadata or {}).get("challenge", False)

        state.pendingAction = None
        state.phase = "playing"
        state.metadata["pendingDraw"] = 0
        triggered = []

        from app.services.engines.universal import _draw_n, _advance_turn

        if not do_challenge:
            # Accept - draw cards and lose turn
            if challenger:
                _draw_n(state, challenger, draw_count)
                state.log.append(_log(
                    f"{challenger.name} accepts and draws {draw_count} cards.",
                    "action",
                    challenger.id
                ))
            triggered.append(f"accepted:{draw_count}")
            _advance_turn(state)
        else:
            # Challenge - check if Wild Draw 4 was legal
            was_illegal = state.metadata.get("lastWildDraw4WasIllegal", False)

            if was_illegal:
                # Challenge successful - challenged player draws 4
                if challenged:
                    _draw_n(state, challenged, 4)
                    state.log.append(_log(
                        f"⚖️ Challenge SUCCESS! {challenged.name} draws 4! {challenger.name if challenger else '?'} plays.",
                        "effect"
                    ))
                triggered.append("challenge_success")
                # Challenger gets to play
            else:
                # Challenge failed - challenger draws penalty
                penalty = draw_count + 2
                if challenger:
                    _draw_n(state, challenger, penalty)
                    state.log.append(_log(
                        f"⚖️ Challenge FAILED! {challenger.name} draws {penalty}.",
                        "effect"
                    ))
                triggered.append(f"challenge_failed:{penalty}")
                _advance_turn(state)

        return True, "", triggered

    # -------------------------------------------------------------------------
    # Lifecycle Hooks
    # -------------------------------------------------------------------------

    def on_turn_start(self, state: GameState, player: Player) -> None:
        """Check if player needs to call UNO at start of turn."""
        # Reset UNO call list at start of each round
        # (UNO call only valid for current turn)
        pass

    def on_card_played(self, state: GameState, player: Player, card: Card) -> Optional[Dict[str, Any]]:
        """
        Validate UNO-specific rules when a card is played.
        Check if player should have called UNO before playing down to 1 card.
        """
        # If player plays down to 1 card, trigger UNO warning
        if len(player.hand.cards) == 1:
            # Initialize unoCalledBy list if not exists
            state.metadata.setdefault("unoCalledBy", [])

        # For Wild Draw 4, check if it's legal (no matching color in hand)
        if card.subtype == "wild_draw4":
            active_color = state.metadata.get("activeColor")
            if active_color:
                # Check if player has any cards of the active color
                has_matching_color = any(
                    c.metadata and c.metadata.get("color") == active_color
                    for c in player.hand.cards
                    if c.id != card.id  # Exclude the card being played
                )
                state.metadata["lastWildDraw4WasIllegal"] = has_matching_color

        return None

    # -------------------------------------------------------------------------
    # Custom Validation
    # -------------------------------------------------------------------------

    def validate_card_play(self, state: GameState, player: Player, card: Card) -> Tuple[bool, str]:
        """
        UNO-specific validation for card plays.
        """
        # Check color matching rules
        if self.config.get("matchColor", False):
            pending_draw = state.metadata.get("pendingDraw", 0)

            # If there's a pending draw, only draw cards can be played (stacking)
            if pending_draw > 0 and self.config.get("stackableDraw", False):
                has_draw_effect = any(e.type in ("draw", "wild_draw") for e in card.effects)
                if not has_draw_effect:
                    # Allow wild cards
                    card_color = card.metadata.get("color") if card.metadata else None
                    if card_color != "wild":
                        return False, "Must play a draw card to stack or draw cards"

        return True, ""


# Factory function to create UNO plugin instance
def create_plugin(game_config: Dict[str, Any]) -> UnoPlugin:
    """Create and return a UNO plugin instance."""
    return UnoPlugin("uno", game_config)
