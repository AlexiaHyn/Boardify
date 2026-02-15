"""
Base Template for Game-Specific Plugins
========================================
This file defines the interface that game-specific plugin files should implement.
Each game (UNO, Exploding Kittens, etc.) can create a plugin that extends this base.

A game plugin can:
1. Add custom action handlers (e.g., "choose_color", "defuse")
2. Add custom effect handlers (e.g., UNO-specific wild card behavior)
3. Add custom validation logic (e.g., UNO call requirements)
4. Hook into game lifecycle events (e.g., on_card_played, on_turn_end)

The universal.py engine will call into these plugins when needed.
"""
from typing import Any, Dict, List, Optional, Tuple
from app.models.game import GameState, Player, Card


class GamePluginBase:
    """
    Base class for game-specific plugins.
    Each game should create a class that inherits from this and implements
    the methods they need to customize.
    """

    def __init__(self, game_id: str, game_config: Dict[str, Any]):
        """
        Initialize the plugin.

        Args:
            game_id: Unique identifier for the game (e.g., "uno", "exploding_kittens")
            game_config: Game configuration from the JSON file
        """
        self.game_id = game_id
        self.config = game_config

    # -------------------------------------------------------------------------
    # Custom Action Handlers
    # -------------------------------------------------------------------------
    # Return a dict mapping action types to handler functions
    # Example: {"choose_color": self._handle_choose_color}

    def get_custom_actions(self) -> Dict[str, callable]:
        """
        Return a dictionary of custom action handlers.

        Returns:
            Dict mapping action type strings to handler functions.
            Each handler should have signature:
                (state: GameState, action) -> Tuple[bool, str, List[str]]
                Returns: (success, error_message, triggered_events)
        """
        return {}

    # -------------------------------------------------------------------------
    # Custom Effect Handlers
    # -------------------------------------------------------------------------
    # Return a dict mapping effect types to handler functions
    # Example: {"wild_color_choice": self._effect_wild_color_choice}

    def get_custom_effects(self) -> Dict[str, callable]:
        """
        Return a dictionary of custom effect handlers.

        Returns:
            Dict mapping effect type strings to handler functions.
            Each handler should have signature:
                (state, player, card, effect, action, triggered) -> Optional[Dict]
                Returns: Dict with control flags or None
        """
        return {}

    # -------------------------------------------------------------------------
    # Lifecycle Hooks
    # -------------------------------------------------------------------------
    # These hooks are called at specific points in the game flow

    def on_game_start(self, state: GameState) -> None:
        """Called after game setup is complete, before first turn."""
        pass

    def on_turn_start(self, state: GameState, player: Player) -> None:
        """Called at the start of each player's turn."""
        pass

    def on_card_played(self, state: GameState, player: Player, card: Card) -> Optional[Dict[str, Any]]:
        """
        Called after a card is played but before effects are applied.

        Returns:
            Optional dict with validation results:
            {"valid": bool, "error": str, "metadata": dict}
        """
        return None

    def on_turn_end(self, state: GameState, player: Player) -> None:
        """Called at the end of each player's turn, after turn advances."""
        pass

    def on_game_end(self, state: GameState, winner: Optional[Player]) -> None:
        """Called when the game ends."""
        pass

    # -------------------------------------------------------------------------
    # Custom Validation
    # -------------------------------------------------------------------------

    def validate_card_play(self, state: GameState, player: Player, card: Card) -> Tuple[bool, str]:
        """
        Add game-specific validation for card plays.

        Returns:
            (is_valid, error_message)
        """
        return True, ""

    def validate_action(self, state: GameState, action) -> Tuple[bool, str]:
        """
        Add game-specific validation for actions.

        Returns:
            (is_valid, error_message)
        """
        return True, ""

    # -------------------------------------------------------------------------
    # Helper Methods (available to all plugins)
    # -------------------------------------------------------------------------

    def get_active_players(self, state: GameState) -> List[Player]:
        """Get list of active (non-eliminated) players."""
        return [p for p in state.players if p.status not in ("eliminated", "winner")]

    def get_player(self, state: GameState, player_id: str) -> Optional[Player]:
        """Get player by ID."""
        return next((p for p in state.players if p.id == player_id), None)

    def get_current_player(self, state: GameState) -> Optional[Player]:
        """Get the current turn player."""
        return self.get_player(state, state.currentTurnPlayerId)

    def add_metadata(self, state: GameState, key: str, value: Any) -> None:
        """Add custom metadata to game state."""
        state.metadata[key] = value

    def get_metadata(self, state: GameState, key: str, default: Any = None) -> Any:
        """Get custom metadata from game state."""
        return state.metadata.get(key, default)
