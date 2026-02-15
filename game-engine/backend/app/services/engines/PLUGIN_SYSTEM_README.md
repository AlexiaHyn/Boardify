# Game Plugin System

A modular architecture for adding game-specific logic alongside the universal card game engine.

## Architecture

```
universal.py          ← Universal game mechanics (skip, draw, reverse, etc.)
       ↓
game_plugin_base.py  ← Base template for all game plugins
       ↓
   ┌───┴───┐
uno.py   exploding_kittens_plugin.py   ← Game-specific plugins
   ↓
plugin_loader.py     ← Integration layer
```

## Quick Start

### 1. Create a New Game Plugin

```python
# app/services/engines/my_game.py

from app.services.engines.game_plugin_base import GamePluginBase

class MyGamePlugin(GamePluginBase):
    def __init__(self, game_id: str, game_config: dict):
        super().__init__(game_id, game_config)

    def get_custom_actions(self) -> dict:
        """Register custom actions."""
        return {
            "my_special_action": self._handle_special_action,
        }

    def _handle_special_action(self, state, action):
        """Handle custom action logic."""
        # Your logic here
        return True, "", ["action_completed"]

def create_plugin(game_config: dict) -> MyGamePlugin:
    """Factory function - required!"""
    return MyGamePlugin("my_game", game_config)
```

### 2. Register Your Plugin

```python
# In plugin_loader.py, add to PLUGIN_MODULES:

PLUGIN_MODULES = {
    "uno": "app.services.engines.uno",
    "my_game": "app.services.engines.my_game",  # ← Add this
}
```

### 3. Use in Your Game JSON

```json
{
  "id": "my_game",
  "name": "My Awesome Game",
  ...
}
```

The plugin system will automatically load `my_game.py` when this game is played!

## Plugin Capabilities

### Custom Actions

Handle game-specific actions that aren't covered by universal.py:

```python
def get_custom_actions(self) -> dict:
    return {
        "choose_color": self._choose_color,      # UNO wild card color
        "call_uno": self._call_uno,              # UNO call
        "defuse": self._defuse,                  # Exploding Kittens defuse
        "nope": self._nope,                      # Exploding Kittens nope
    }

def _choose_color(self, state, action):
    # Custom logic for color selection
    chosen_color = action.metadata.get("color")
    state.metadata["activeColor"] = chosen_color
    return True, "", [f"color_chosen:{chosen_color}"]
```

### Custom Effects

Add new card effect types beyond the universal ones:

```python
def get_custom_effects(self) -> dict:
    return {
        "wild_with_ui": self._effect_wild_with_ui,
    }

def _effect_wild_with_ui(self, state, player, card, effect, action, triggered):
    # Trigger UI for color selection
    return {"needs_ui_prompt": "color_picker"}
```

### Lifecycle Hooks

React to game events:

```python
def on_game_start(self, state):
    """Called when game starts."""
    state.metadata["unoCalledBy"] = []

def on_card_played(self, state, player, card):
    """Called whenever a card is played."""
    if len(player.hand.cards) == 1:
        # Trigger UNO warning
        return {"show_uno_button": True}
    return None

def on_turn_end(self, state, player):
    """Called at end of turn."""
    # Clear temporary state
    state.metadata.pop("tempData", None)
```

### Custom Validation

Add game-specific rules:

```python
def validate_card_play(self, state, player, card):
    """Validate if a card can be played."""
    # Check if player forgot to call UNO
    if len(player.hand.cards) == 1:
        if player.id not in state.metadata.get("unoCalledBy", []):
            return False, "Must call UNO first!"
    return True, ""
```

## Example: UNO Plugin

The UNO plugin (`uno.py`) demonstrates:

✅ **Custom Actions:**
- `choose_color` - Handle wild card color selection with UI
- `call_uno` - Player calls UNO when down to 1 card
- `catch_uno` - Catch opponent who forgot to call UNO
- `challenge_wild_draw4` - Challenge illegal Wild Draw 4

✅ **Lifecycle Hooks:**
- `on_card_played` - Track if Wild Draw 4 is legal
- `on_turn_start` - Reset UNO call status

✅ **Custom Validation:**
- Ensure color matching rules
- Validate UNO call requirements

## Integration with Universal Engine

The plugin system integrates seamlessly:

```python
# In universal.py (pseudocode):

from app.services.engines import plugin_loader

def apply_action(state, action):
    # Load game plugin
    plugin = plugin_loader.get_plugin(state.gameId, state.gameConfig)

    # Try plugin custom actions first
    result = plugin_loader.apply_action_with_plugin(state, action, plugin)
    if result:
        return result  # Plugin handled it

    # Fall through to universal handlers
    return universal_handler(state, action)
```

## File Structure

```
app/services/engines/
├── universal.py                 ← Universal engine (shared mechanics)
├── game_plugin_base.py          ← Base class for plugins
├── plugin_loader.py             ← Integration layer
├── uno.py                       ← UNO-specific plugin
├── exploding_kittens_plugin.py  ← Exploding Kittens plugin
├── PLUGIN_SYSTEM_README.md      ← This file
└── [your_game].py               ← Your custom plugin
```

## Benefits

### ✅ Separation of Concerns
- Universal mechanics in `universal.py`
- Game-specific logic in plugins
- Clean, maintainable code

### ✅ Easy to Add New Games
- Create one Python file
- Register in `plugin_loader.py`
- Done!

### ✅ No Breaking Changes
- Universal engine unchanged
- Games without plugins still work
- Backward compatible

### ✅ Reusable Components
- Share common logic in universal.py
- Customize only what's unique
- Extend with plugins

## Common Use Cases

### Color Selection (UNO, Crazy Eights)
```python
def get_custom_actions(self):
    return {"choose_color": self._choose_color}

def _choose_color(self, state, action):
    color = action.metadata.get("color")
    state.metadata["activeColor"] = color
    state.phase = "playing"
    return True, "", [f"color:{color}"]
```

### Defuse Mechanism (Exploding Kittens)
```python
def get_custom_actions(self):
    return {
        "defuse": self._defuse,
        "insert_card": self._insert_card,
    }

def _defuse(self, state, action):
    # Player survives explosion
    # Prompt for card insertion position
    state.pendingAction = {"type": "insert_exploding_kitten"}
    return True, "", ["defused"]
```

### Special Combos (Card Games)
```python
def validate_card_play(self, state, player, card):
    # Check if playing 2-of-a-kind combo
    if is_combo(player.hand, card):
        return True, ""
    return False, "Not a valid combo"
```

## Testing Your Plugin

```python
# test_my_game_plugin.py

from app.services.engines.my_game import create_plugin

def test_custom_action():
    config = {"colors": ["red", "blue"]}
    plugin = create_plugin(config)

    # Create mock state and action
    state = MockGameState()
    action = MockAction(type="choose_color", metadata={"color": "red"})

    # Test custom action
    success, error, events = plugin.get_custom_actions()["choose_color"](state, action)

    assert success == True
    assert state.metadata["activeColor"] == "red"
```

## Next Steps

1. **Create your plugin** using `game_plugin_base.py` template
2. **Register it** in `plugin_loader.py`
3. **Test it** with your game JSON
4. **Enjoy** modular, maintainable game logic!

## Questions?

- Check `uno.py` for a complete example
- Read `game_plugin_base.py` for all available hooks
- See `plugin_loader.py` for integration details
