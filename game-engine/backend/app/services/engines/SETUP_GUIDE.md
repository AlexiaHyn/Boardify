# Game Plugin System - Setup Guide

## What I've Created

A complete plugin architecture that allows each game to have its own specific logic file (like `uno.py`) that works alongside `universal.py`.

### Files Created:

1. **`game_plugin_base.py`** - Base template that all game plugins inherit from
2. **`uno.py`** - UNO-specific plugin with color choice, UNO call, and challenge logic
3. **`plugin_loader.py`** - Integration layer between universal engine and plugins
4. **`PLUGIN_SYSTEM_README.md`** - Complete documentation
5. **`SETUP_GUIDE.md`** - This file!

## How It Works

```
┌─────────────────┐
│   uno.json      │ ← Game definition
└────────┬────────┘
         │
         ↓
┌─────────────────┐      ┌──────────────────┐
│  universal.py   │ ←───→│   uno.py         │
│  (general)      │      │   (UNO-specific) │
└─────────────────┘      └──────────────────┘
         ↓                        ↓
   Common mechanics        Color choice
   - Draw                  UNO call
   - Skip                  Challenge
   - Reverse               etc.
```

## Quick Integration with Universal.py

### Step 1: Update `universal.py`

Add at the top:
```python
from app.services.engines import plugin_loader
```

Modify `apply_action` function:
```python
def apply_action(state: GameState, action) -> Tuple[bool, str, List[str]]:
    # Get game plugin
    game_id = state.metadata.get("gameId", "")
    game_config = state.metadata.get("gameConfig", {})
    plugin = plugin_loader.get_plugin(game_id, game_config)

    # Try plugin custom actions first
    result = plugin_loader.apply_action_with_plugin(state, action, plugin)
    if result:
        return result

    # Fall through to universal handlers (existing code)
    dispatch = {
        "play_card": _action_play_card,
        "draw_card": _action_draw_card,
        "choose_color": _action_choose_color,  # ← Can be removed (now in plugin)
        # ... rest
    }
    # ... existing code
```

### Step 2: Update Game Metadata

Make sure your game state includes:
```python
state.metadata["gameId"] = "uno"  # or "exploding_kittens"
state.metadata["gameConfig"] = config_from_json
```

This should be set in `setup_game` when loading the game JSON.

### Step 3: Test UNO Color Choice

Now when a player plays Wild Draw 4:
1. Universal engine checks if plugin handles it
2. UNO plugin handles the color choice action
3. Universal engine continues with draw logic

## For UNO Specifically

### Actions Now Handled by Plugin:

| Action | Handler | Description |
|--------|---------|-------------|
| `choose_color` | `uno.py` | Color selection for Wild cards |
| `call_uno` | `uno.py` | Player calls UNO |
| `catch_uno` | `uno.py` | Catch opponent who forgot UNO |
| `challenge_wild_draw4` | `uno.py` | Challenge Wild Draw 4 |

### Universal Actions (Still in universal.py):

| Action | Handler | Description |
|--------|---------|-------------|
| `play_card` | `universal.py` | Play any card |
| `draw_card` | `universal.py` | Draw cards |

## Example: Playing Wild Draw 4 in UNO

### Before (All in universal.py):
```
Player plays Wild Draw 4
  ↓
Universal handles everything
  ↓
Gets messy with color choice logic
```

### After (Split between universal + plugin):
```
Player plays Wild Draw 4
  ↓
Universal: Sets up color choice needed
  ↓
UNO Plugin: Shows UI color picker
  ↓
Player chooses color
  ↓
UNO Plugin: Processes color choice
  ↓
Universal: Continues with draw logic
```

## Benefits

### ✅ **Clean Separation**
- Universal mechanics stay general
- UNO-specific logic in `uno.py`
- Easy to maintain

### ✅ **Easy UI Integration**
- Plugin can request UI prompts
- `{"needs_ui_prompt": "color_picker"}`
- Frontend shows appropriate UI

### ✅ **No Breaking Changes**
- Existing games still work
- Universal engine unchanged
- Backward compatible

### ✅ **Easy to Add Games**
Just create `your_game.py` and register it!

## Next Steps

### 1. Test with UNO (Minimal Changes)

Just add to the game initialization:
```python
# In your game setup code
state.metadata["gameId"] = "uno"
state.metadata["gameConfig"] = uno_config
```

### 2. Create Custom Game Plugin

```python
# app/services/engines/my_game.py

from app.services.engines.game_plugin_base import GamePluginBase

class MyGamePlugin(GamePluginBase):
    def get_custom_actions(self):
        return {
            "my_action": self._handle_my_action
        }

    def _handle_my_action(self, state, action):
        # Your logic
        return True, "", ["done"]

def create_plugin(game_config):
    return MyGamePlugin("my_game", game_config)
```

### 3. Register Your Plugin

```python
# In plugin_loader.py
PLUGIN_MODULES = {
    "uno": "app.services.engines.uno",
    "my_game": "app.services.engines.my_game",  # Add this
}
```

### 4. Use in Game JSON

```json
{
  "id": "my_game",
  "name": "My Awesome Game"
}
```

Done! Your game now has its own plugin!

## Troubleshooting

### Plugin not loading?
- Check `gameId` is set correctly in state.metadata
- Verify plugin is registered in `PLUGIN_MODULES`
- Ensure `create_plugin()` function exists

### Action not working?
- Check action type matches plugin registration
- Verify return format: `(bool, str, list)`
- Add debug logging in plugin handler

### UI not showing?
- Plugin should return metadata for UI
- Example: `return True, "", {"show_color_picker": True}`
- Frontend needs to handle the metadata

## Example: Full UNO Flow

```python
# 1. Player plays Wild Draw 4 (no color chosen)
action = {"type": "play_card", "cardId": "wild_draw4_id"}

# 2. Universal engine processes card play
# 3. Wild draw effect sees no color → requests color choice
# 4. State changes to "awaiting_response"

# 5. Frontend shows color picker UI

# 6. Player selects color
action = {"type": "choose_color", "metadata": {"color": "red"}}

# 7. Plugin loader routes to UNO plugin
# 8. UNO plugin processes color choice
# 9. Sets activeColor = "red"
# 10. Returns to "playing" state
# 11. Universal engine continues with draw logic
```

## Questions?

Read the comprehensive docs:
- **PLUGIN_SYSTEM_README.md** - Full documentation
- **uno.py** - Working example
- **game_plugin_base.py** - Available hooks

Happy coding! 🎮
