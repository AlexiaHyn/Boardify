"""
Exploding Kittens Plugin (Example)
===================================
This is a plugin version that works WITH universal.py.

Note: The current exploding_kittens.py is a complete standalone engine.
This plugin version shows how Exploding Kittens COULD be implemented
using the universal engine + plugin system.

To use this plugin instead of the standalone engine:
1. Rename exploding_kittens.py to exploding_kittens_standalone.py (backup)
2. Update plugin_loader.py to register this plugin
3. Ensure your JSON uses universal-compatible card effects
"""
import uuid
import random
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


class ExplodingKittensPlugin(GamePluginBase):
    """
    Exploding Kittens plugin for use with universal.py.

    Handles EK-specific mechanics:
    - Defuse card mechanism
    - Nope card (cancel actions)
    - See the Future
    - Insert card into deck
    - Attack card (2 turns)
    """

    def __init__(self, game_id: str, game_config: Dict[str, Any]):
        super().__init__(game_id, game_config)

    # -------------------------------------------------------------------------
    # Custom Actions
    # -------------------------------------------------------------------------

    def get_custom_actions(self) -> Dict[str, callable]:
        """Register Exploding Kittens custom actions."""
        return {
            "defuse_kitten": self._action_defuse,
            "insert_card": self._action_insert_card,
            "nope": self._action_nope,
        }

    def _action_defuse(self, state: GameState, action) -> Tuple[bool, str, List[str]]:
        """
        Use Defuse card when drawing an Exploding Kitten.
        Player must have a Defuse card in hand.
        """
        player = self.get_current_player(state)
        if not player:
            return False, "No current player", []

        # Check if player actually drew an exploding kitten
        if not state.metadata.get("drewExplodingKitten"):
            return False, "No exploding kitten to defuse", []

        # Find defuse card in hand
        defuse_card = next(
            (c for c in player.hand.cards if c.subtype == "defuse"),
            None
        )
        if not defuse_card:
            return False, "No Defuse card in hand", []

        # Use the Defuse card (remove from hand)
        player.hand.cards.remove(defuse_card)

        state.log.append(_log(
            f"🔧 {player.name} used a Defuse card!",
            "effect",
            player.id
        ))

        # Now player needs to choose where to put the kitten back
        from app.services.engines.universal import _draw_zone
        draw = _draw_zone(state)
        deck_size = len(draw.cards) if draw else 0

        state.phase = "awaiting_response"
        state.pendingAction = {
            "type": "insert_exploding_kitten",
            "playerId": player.id,
            "deckSize": deck_size,
        }

        return True, "", ["defused"]

    def _action_insert_card(self, state: GameState, action) -> Tuple[bool, str, List[str]]:
        """
        Insert the Exploding Kitten back into the deck at chosen position.
        """
        pending = state.pendingAction
        if not pending or pending.get("type") != "insert_exploding_kitten":
            return False, "No card insertion pending", []

        if action.playerId != pending["playerId"]:
            return False, "Not your action", []

        # Get chosen position (0 = top of deck)
        position = (action.metadata or {}).get("position", 0)

        from app.services.engines.universal import _draw_zone, _advance_turn
        draw = _draw_zone(state)

        # Get the exploding kitten card from metadata
        kitten_card_data = state.metadata.get("explodingKittenCard")
        if kitten_card_data and draw:
            # Recreate the card
            from app.models.game import Card as CardModel
            if isinstance(kitten_card_data, dict):
                kitten = CardModel(**kitten_card_data)
            else:
                kitten = kitten_card_data

            # Insert at chosen position
            position = max(0, min(position, len(draw.cards)))
            draw.cards.insert(position, kitten)

        # Clear defuse state
        state.metadata["drewExplodingKitten"] = False
        state.metadata.pop("explodingKittenCard", None)
        state.pendingAction = None
        state.phase = "playing"

        state.log.append(_log(
            f"🃏 Exploding Kitten secretly placed back in deck.",
            "system"
        ))

        # Advance turn
        _advance_turn(state)

        return True, "", ["kitten_inserted"]

    def _action_nope(self, state: GameState, action) -> Tuple[bool, str, List[str]]:
        """
        Play a Nope card to cancel the last action.
        Nope cards can be Nope'd back!
        """
        player = self.get_player(state, action.playerId)
        if not player:
            return False, "Player not found", []

        # Check if player has a Nope card
        nope_card = next(
            (c for c in player.hand.cards if c.subtype == "nope"),
            None
        )
        if not nope_card:
            return False, "No Nope card in hand", []

        # Check if there's something to Nope
        nopeable_action = state.metadata.get("lastNopeableAction")
        if not nopeable_action:
            return False, "Nothing to Nope", []

        # Play the Nope card
        player.hand.cards.remove(nope_card)

        # Track Nope count (for Nope chains)
        nope_count = state.metadata.get("nopeCount", 0)
        state.metadata["nopeCount"] = nope_count + 1

        state.log.append(_log(
            f"🚫 {player.name} plays NOPE!",
            "effect",
            player.id
        ))

        # If odd number of Nopes, action is cancelled
        # If even, action happens
        # (Nope cancels, Nope-Nope allows, Nope-Nope-Nope cancels, etc.)

        return True, "", ["nope_played"]

    # -------------------------------------------------------------------------
    # Lifecycle Hooks
    # -------------------------------------------------------------------------

    def on_card_played(self, state: GameState, player: Player, card: Card) -> Optional[Dict[str, Any]]:
        """
        Mark certain actions as Nopeable.
        """
        # Actions that can be Nope'd
        nopeable = {"favor", "attack", "shuffle", "see_future", "targeted_attack"}

        if card.subtype in nopeable:
            state.metadata["lastNopeableAction"] = card.subtype
            state.metadata["nopeCount"] = 0

        return None

    def on_turn_start(self, state: GameState, player: Player) -> None:
        """Clear Nope state at start of each turn."""
        state.metadata.pop("lastNopeableAction", None)
        state.metadata.pop("nopeCount", None)

    # -------------------------------------------------------------------------
    # Custom Effects
    # -------------------------------------------------------------------------

    def get_custom_effects(self) -> Dict[str, callable]:
        """Custom effect handlers for Exploding Kittens."""
        return {
            "attack": self._effect_attack,
            "see_future": self._effect_see_future,
        }

    def _effect_attack(self, state, player, card, effect, action, triggered):
        """
        Attack card - next player takes 2 turns.
        This is handled by setting metadata that the turn system respects.
        """
        state.metadata["attacksPending"] = state.metadata.get("attacksPending", 0) + 2

        state.log.append(_log(
            f"⚔️ {player.name} played Attack! Next player takes 2 turns.",
            "action",
            player.id,
            card.id
        ))

        triggered.append("attack")
        return None  # Turn advances normally

    def _effect_see_future(self, state, player, card, effect, action, triggered):
        """
        See the Future - reveal top 3 cards without drawing them.
        """
        from app.services.engines.universal import _draw_zone
        draw = _draw_zone(state)

        if not draw or not draw.cards:
            return {"error": "Deck is empty"}

        # Get top 3 cards
        top_cards = draw.cards[:min(3, len(draw.cards))]
        card_names = [c.name for c in top_cards]

        state.log.append(_log(
            f"🔮 {player.name} sees the future...",
            "action",
            player.id,
            card.id
        ))

        # Return card info (frontend can display this to the player)
        triggered.append(f"saw_future:{','.join(card_names)}")
        return {"future_cards": card_names}


# Factory function to create plugin instance
def create_plugin(game_config: Dict[str, Any]) -> ExplodingKittensPlugin:
    """Create and return an Exploding Kittens plugin instance."""
    return ExplodingKittensPlugin("exploding_kittens", game_config)
