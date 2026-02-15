"""
Plugin Loader - Integration Between Universal Engine and Game-Specific Plugins
===============================================================================
This module handles loading and integrating game-specific plugins with the
universal engine.

Usage:
    from app.services.engines import plugin_loader

    # Get plugin for a game
    plugin = plugin_loader.get_plugin("uno", game_config)

    # Get custom actions
    custom_actions = plugin.get_custom_actions()

    # Call lifecycle hooks
    plugin.on_card_played(state, player, card)
"""
import importlib
import os
from pathlib import Path
from typing import Any, Dict, Optional

from app.services.engines.game_plugin_base import GamePluginBase


def _discover_plugins() -> Dict[str, str]:
    """
    Automatically discover game plugins by scanning the games directory.

    For each game JSON file (e.g., uno.json), checks if a corresponding
    plugin module exists (e.g., app.services.engines.uno).

    Returns:
        Dictionary mapping game_id -> plugin_module_path
    """
    discovered = {}

    # Get path to games directory
    engines_dir = Path(__file__).parent
    games_dir = engines_dir.parent.parent / "games"

    if not games_dir.exists():
        return discovered

    # Scan all JSON files in games directory
    for json_file in games_dir.glob("*.json"):
        game_id = json_file.stem  # e.g., "uno" from "uno.json"

        # Check if a corresponding plugin module exists
        # Try common plugin naming patterns
        possible_names = [
            f"app.services.engines.{game_id}",              # e.g., uno.py
            f"app.services.engines.{game_id}_plugin",       # e.g., uno_plugin.py
        ]

        for module_name in possible_names:
            try:
                # Try to import the module to check if it exists
                importlib.import_module(module_name)
                # If import succeeds, register it
                discovered[game_id] = module_name
                print(f"✓ Discovered plugin: {game_id} -> {module_name}")
                break
            except ImportError:
                # Module doesn't exist, try next pattern
                continue

    return discovered


# Automatically discover and register plugins
PLUGIN_MODULES = _discover_plugins()


def get_plugin(game_id: str, game_config: Dict[str, Any]) -> Optional[GamePluginBase]:
    """
    Load and return the game-specific plugin for the given game ID.

    Args:
        game_id: Unique identifier for the game (e.g., "uno", "exploding_kittens")
        game_config: Game configuration from the JSON file

    Returns:
        GamePluginBase instance or None if no plugin exists
    """
    module_name = PLUGIN_MODULES.get(game_id)

    if not module_name:
        # No plugin registered for this game - use universal engine only
        return None

    try:
        # Dynamically import the plugin module
        module = importlib.import_module(module_name)

        # Call the create_plugin factory function
        if hasattr(module, 'create_plugin'):
            plugin = module.create_plugin(game_config)
            return plugin
        else:
            print(f"Warning: Plugin module {module_name} has no create_plugin function")
            return None

    except ImportError as e:
        print(f"Warning: Could not load plugin for {game_id}: {e}")
        return None
    except Exception as e:
        print(f"Error creating plugin for {game_id}: {e}")
        return None


def has_plugin(game_id: str) -> bool:
    """Check if a game has a registered plugin."""
    return game_id in PLUGIN_MODULES


def register_plugin(game_id: str, module_path: str) -> None:
    """
    Register a new game plugin.

    Args:
        game_id: Unique identifier for the game
        module_path: Python module path (e.g., "app.services.engines.my_game")
    """
    PLUGIN_MODULES[game_id] = module_path


def list_plugins() -> Dict[str, str]:
    """Get a dictionary of all registered plugins."""
    return PLUGIN_MODULES.copy()


# Integration helpers for universal engine

def apply_action_with_plugin(state, action, plugin: Optional[GamePluginBase]) -> tuple:
    """
    Apply an action, checking plugin custom actions first.

    Args:
        state: GameState
        action: Action object with .type, .playerId, etc.
        plugin: Optional game plugin

    Returns:
        (success, error_message, triggered_events) or None if not handled by plugin
    """
    if not plugin:
        return None

    custom_actions = plugin.get_custom_actions()
    handler = custom_actions.get(action.type)

    if handler:
        # Plugin handles this action
        return handler(state, action)

    # Plugin doesn't handle this action - fall through to universal
    return None


def get_effect_handler(effect_type: str, plugin: Optional[GamePluginBase]):
    """
    Get effect handler, checking plugin custom effects first.

    Args:
        effect_type: Type of effect (e.g., "draw", "skip", "custom_effect")
        plugin: Optional game plugin

    Returns:
        Effect handler function or None
    """
    if not plugin:
        return None

    custom_effects = plugin.get_custom_effects()
    return custom_effects.get(effect_type)


def validate_card_play(state, player, card, plugin: Optional[GamePluginBase]) -> tuple:
    """
    Validate card play with plugin-specific rules.

    Returns:
        (is_valid, error_message)
    """
    if not plugin:
        return True, ""

    return plugin.validate_card_play(state, player, card)


def validate_action(state, action, plugin: Optional[GamePluginBase]) -> tuple:
    """
    Validate action with plugin-specific rules.

    Returns:
        (is_valid, error_message)
    """
    if not plugin:
        return True, ""

    return plugin.validate_action(state, action)


# Example usage in universal.py:
"""
# At the top of universal.py:
from app.services.engines import plugin_loader

# In apply_action function:
def apply_action(state: GameState, action) -> Tuple[bool, str, List[str]]:
    # Get game plugin
    game_id = state.metadata.get("gameId", "")
    game_config = state.metadata.get("gameConfig", {})
    plugin = plugin_loader.get_plugin(game_id, game_config)

    # Try plugin custom actions first
    result = plugin_loader.apply_action_with_plugin(state, action, plugin)
    if result:
        return result

    # Fall through to universal action handlers
    dispatch = {
        "play_card": _action_play_card,
        "draw_card": _action_draw_card,
        # ... other universal actions
    }
    handler = dispatch.get(action.type)
    if not handler:
        return False, f"Unknown action: {action.type}", []
    return handler(state, action, plugin)  # Pass plugin to handler

# In card play handler:
def _action_play_card(state, action, plugin=None):
    # ... existing code ...

    # Validate with plugin
    valid, error = plugin_loader.validate_card_play(state, player, card, plugin)
    if not valid:
        return False, error, []

    # Call lifecycle hook
    if plugin:
        result = plugin.on_card_played(state, player, card)
        if result and not result.get("valid", True):
            return False, result.get("error", "Invalid play"), []

    # ... rest of existing code ...
"""
