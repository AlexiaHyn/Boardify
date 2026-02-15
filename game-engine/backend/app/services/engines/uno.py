"""
UNO Game Plugin
===============
Minimal plugin for UNO-specific customizations.

NOTE: Currently, all UNO actions are handled directly in universal.py:
- choose_color (Wild card color selection)
- call_uno (UNO call when down to 1 card)
- catch_uno (Catch player who forgot to call UNO)
- challenge (Wild Draw 4 challenge)

This plugin provides lifecycle hooks for future extensibility.
"""
from typing import Any, Dict, Optional, Tuple

from app.models.game import GameState, Player, Card
from app.services.engines.game_plugin_base import GamePluginBase


class UnoPlugin(GamePluginBase):
    """
    UNO-specific game logic plugin.

    All UNO actions are currently handled in universal.py.
    This plugin is reserved for future UNO-specific customizations.
    """

    def __init__(self, game_id: str, game_config: Dict[str, Any]):
        super().__init__(game_id, game_config)

    # -------------------------------------------------------------------------
    # Lifecycle Hooks
    # -------------------------------------------------------------------------

    def on_card_played(self, state: GameState, player: Player, card: Card) -> Optional[Dict[str, Any]]:
        """
        Track UNO-specific state when cards are played.

        For Wild Draw 4, determines if the play was legal (for challenge mechanic).
        """
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

        # If player plays down to 1 card, ensure unoCalledBy list exists
        if len(player.hand.cards) == 1:
            state.metadata.setdefault("unoCalledBy", [])

        return None

    def on_turn_start(self, state: GameState, player: Player) -> None:
        """Called at the start of each player's turn."""
        # UNO call state is tracked in metadata["unoCalledBy"]
        # Could add turn-based reset logic here if needed
        pass


# Factory function to create UNO plugin instance
def create_plugin(game_config: Dict[str, Any]) -> UnoPlugin:
    """Create and return a UNO plugin instance."""
    return UnoPlugin("uno", game_config)
