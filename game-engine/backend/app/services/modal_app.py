"""
Modal app for AI-powered card game generation.

Runs Perplexity Sonar research and Claude JSON generation on Modal's
infrastructure, then validates generated games in a Modal Sandbox.

Setup
-----
  1. pip install modal
  2. modal setup                              (authenticate)
  3. modal deploy app/services/modal_app.py   (deploy once)
"""
from __future__ import annotations

import modal
from pathlib import Path

# ── Modal App ────────────────────────────────────────────────────────────────

app = modal.App("boardify-game-generator")

# Resolve backend root at deploy time (locally) for .env secrets.
# Inside the Modal container _backend_root falls back to /root harmlessly.
try:
    _backend_root = Path(__file__).resolve().parents[2]       # .../backend
except (IndexError, OSError):
    _backend_root = Path("/root")

# Main image — NO local file mounts (template is inlined below)
image = (
    modal.Image.debian_slim(python_version="3.11")
    .pip_install("anthropic", "httpx", "pydantic>=2.0.0")
)

# ── Constants ────────────────────────────────────────────────────────────────

VALID_EFFECT_TYPES = [
    "number", "skip", "reverse", "draw", "self_draw", "wild", "wild_draw",
    "eliminate", "defuse", "peek", "shuffle", "steal", "give", "insert",
    "extra_turn", "swap_hands", "score", "any", "cancel",
]

VALID_CARD_TYPES = [
    "number", "action", "reaction", "defense", "wild", "special", "combo",
]

VALID_WIN_CONDITIONS = [
    "empty_hand", "last_standing", "most_points", "target_score",
]

VALID_TARGETS = [
    "self", "next_player", "all_others", "choose", "choose_player",
    "all", "draw_pile", "any_action",
]


# ── Game template (inlined from game.json) ───────────────────────────────────
# This is the schema reference given to Claude so it knows the exact JSON
# structure to produce.  It is NOT a real game — just annotated examples.

GAME_TEMPLATE = r'''{
    "_template_version": "1.0",
    "_instructions": [
      "This is the master template for the Card Game Engine.",
      "Every key marked '// REQUIRED' must be present.",
      "Every key marked '// OPTIONAL' may be omitted; defaults are shown.",
      "Every key marked '// CHOOSE ONE' must be set to exactly one of the listed values.",
      "Delete all keys that start with '_' and all inline comments before use.",
      "Drop the finished file into:  backend/app/games/<your_game_id>.json",
      "The universal engine will load it automatically \u2014 no Python needed."
    ],

    "_section_overview": {
      "1_identity":     "id, name, description, version, theme",
      "2_rules":        "player count, hand size, turn structure, win condition, special rules",
      "3_config":       "engine behaviour flags (matching, stacking, wilds, etc.)",
      "4_cards":        "every card type with effects, counts, and metadata",
      "5_ui":           "labels, prompts, color picker, table colours"
    },


    "===== SECTION 1 \u2014 IDENTITY =====": "\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500",

    "id":          "my_game",
    "_id_note":    "REQUIRED. Lowercase, underscores only. Must match the filename (my_game.json).",

    "name":        "My Card Game",
    "_name_note":  "REQUIRED. Displayed in the lobby and room header.",

    "description": "A short one-sentence description of the game shown in the game picker.",

    "version":     "1.0.0",

    "themeColor":  "#4F46E5",
    "_themeColor_note": "OPTIONAL. Hex colour used for UI accents.",

    "backgroundEmoji": "\ud83c\udccf",
    "_backgroundEmoji_note": "OPTIONAL. Decorative emoji shown on the table background.",


    "===== SECTION 2 \u2014 RULES =====": "\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500",

    "rules": {

      "minPlayers": 2,
      "maxPlayers": 8,

      "handSize": 7,
      "_handSize_note": "Cards each player receives at game start.",

      "turnStructure": {

        "phases": [
          {
            "id":          "play",
            "name":        "Play a Card",
            "description": "Play one card from your hand that matches the current rule.",
            "isOptional":  true,
            "_isOptional_note": "true = player may skip this phase."
          },
          {
            "id":          "draw",
            "name":        "Draw a Card",
            "description": "Draw one card from the draw pile if you could not play.",
            "isOptional":  true
          }
        ],

        "canPassTurn": false,
        "_canPassTurn_note": "OPTIONAL (default false). true = player may end turn without playing or drawing.",

        "mustPlayCard": false,
        "_mustPlayCard_note": "OPTIONAL (default false). true = player MUST play a valid card if one exists.",

        "drawCount": 1,
        "_drawCount_note": "Cards drawn at end of turn when the player cannot play (or chooses to draw)."
      },

      "winCondition": {
        "type": "empty_hand",
        "_type_choose": [
          "empty_hand      \u2014 first player to empty their hand wins",
          "last_standing   \u2014 last player not eliminated wins",
          "most_points     \u2014 highest score when deck runs out",
          "target_score    \u2014 first player to reach N points wins (set targetScore in metadata)"
        ],
        "description": "First player to play all their cards wins!",
        "metadata": {
          "_target_score_example": "Set targetScore here if using target_score win condition.",
          "targetScore": 500
        }
      },

      "specialRules": [
        {
          "_note": "OPTIONAL array. Purely informational \u2014 displayed in the lobby rules panel.",
          "id":          "example_rule",
          "name":        "Example Rule Name",
          "trigger":     "on_play",
          "_trigger_choose": ["on_play", "on_draw", "on_combo", "on_turn_end", "on_discard"],
          "description": "A human-readable explanation of this special rule.",
          "metadata":    {}
        }
      ]
    },


    "===== SECTION 3 \u2014 CONFIG (engine behaviour) =====": "\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500",

    "config": {

      "_matching_note": "Play-legality rules. A card is playable if ANY enabled check passes.",

      "matchColor":  false,
      "_matchColor_note": "OPTIONAL (default false). Enforce color matching (UNO-style).",

      "matchNumber": false,
      "_matchNumber_note": "OPTIONAL (default false). Enforce value/number matching.",

      "matchType":   false,
      "_matchType_note": "OPTIONAL (default false). Enforce subtype matching (Skip-on-Skip, etc.).",

      "wildAlwaysPlayable": true,
      "_wildAlwaysPlayable_note": "OPTIONAL (default true). Cards with color='wild' bypass all match rules.",

      "stackableDraw": false,
      "_stackableDraw_note": "OPTIONAL (default false). Allow Draw cards to be stacked.",

      "reverseEqualsSkipTwoPlayers": false,
      "_reverseEqualsSkipTwoPlayers_note": "OPTIONAL. If true, Reverse acts as Skip in 2-player.",

      "startWithDiscard": false,
      "_startWithDiscard_note": "OPTIONAL. Flip one card face-up to seed the discard pile.",

      "excludeFromStartDiscard": [],
      "_excludeFromStartDiscard_note": "OPTIONAL. Card subtypes that must not be the first face-up card.",

      "drawUntilPlayable": false,
      "_drawUntilPlayable_note": "OPTIONAL. Player keeps drawing until they get a playable card.",

      "colors": ["red", "yellow", "green", "blue"],
      "_colors_note": "OPTIONAL. Valid color names. Remove if no color system.",

      "colorEmojis": {
        "red":    "\ud83d\udd34",
        "yellow": "\ud83d\udfe1",
        "green":  "\ud83d\udfe2",
        "blue":   "\ud83d\udd35",
        "wild":   "\ud83c\udf08"
      },

      "zones": [
        {
          "id":       "draw_pile",
          "name":     "Draw Pile",
          "type":     "deck",
          "isPublic": false
        },
        {
          "id":       "discard_pile",
          "name":     "Discard Pile",
          "type":     "discard",
          "isPublic": true
        }
      ]
    },


    "===== SECTION 4 \u2014 CARDS =====": "\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500",

    "_cards_note": [
      "REQUIRED array. Define every distinct card type.",
      "Each object becomes N copies in the deck where N = count."
    ],

    "cards": [
      {
        "_example": "Number card",
        "id": "red_5", "name": "Red 5", "type": "number", "subtype": "number",
        "emoji": "5\ufe0f\u20e3", "description": "Play on any red card or any 5.",
        "effects": [{"type": "number", "value": 5, "target": "self",
                     "description": "Play on matching color or number.",
                     "metadata": {"color": "red", "number": 5}}],
        "isPlayable": true, "isReaction": false, "count": 2,
        "metadata": {"color": "red", "number": 5, "points": 5}
      },
      {
        "_example": "Skip card",
        "id": "skip_example", "name": "Skip", "type": "action", "subtype": "skip",
        "emoji": "\ud83d\udeab", "description": "Next player loses their turn.",
        "effects": [{"type": "skip", "value": 1, "target": "next_player",
                     "description": "Next player loses their turn.", "metadata": {}}],
        "isPlayable": true, "isReaction": false, "count": 2, "metadata": {}
      },
      {
        "_example": "Reverse card",
        "id": "reverse_example", "name": "Reverse", "type": "action", "subtype": "reverse",
        "emoji": "\ud83d\udd04", "description": "Reverse the direction of play.",
        "effects": [{"type": "reverse", "target": "all",
                     "description": "Flip the turn order.", "metadata": {}}],
        "isPlayable": true, "isReaction": false, "count": 2, "metadata": {}
      },
      {
        "_example": "Draw 2 card",
        "id": "draw2_example", "name": "Draw 2", "type": "action", "subtype": "draw2",
        "emoji": "\u2795", "description": "Next player draws 2 and loses their turn.",
        "effects": [{"type": "draw", "value": 2, "target": "next_player",
                     "description": "Force next player to draw 2.", "metadata": {}}],
        "isPlayable": true, "isReaction": false, "count": 2, "metadata": {"points": 20}
      },
      {
        "_example": "Wild card",
        "id": "wild_example", "name": "Wild", "type": "wild", "subtype": "wild",
        "emoji": "\ud83c\udf08", "description": "Play on any card. Choose any color.",
        "effects": [{"type": "wild", "target": "self",
                     "description": "Change the active color.",
                     "metadata": {"color": "wild", "requiresColorChoice": true}}],
        "isPlayable": true, "isReaction": false, "count": 4,
        "metadata": {"color": "wild", "points": 50, "requiresColorChoice": true}
      },
      {
        "_example": "Elimination card (Exploding Kittens bomb)",
        "id": "bomb_example", "name": "Exploding Kitten", "type": "special", "subtype": "exploding",
        "emoji": "\ud83d\udca3", "description": "Eliminated unless you have a Defuse.",
        "effects": [{"type": "eliminate", "target": "self",
                     "description": "Eliminate the player unless they have a Defuse.",
                     "metadata": {"conditions": [{"type": "has_card_type", "value": "defuse"}]}}],
        "isPlayable": false, "isReaction": false, "count": 4,
        "metadata": {"notInStartDeck": true, "notInStartHand": true, "injectCount": "players_minus_one"}
      },
      {
        "_example": "Defuse card",
        "id": "defuse_example", "name": "Defuse", "type": "defense", "subtype": "defuse",
        "emoji": "\ud83d\udd27", "description": "Cancels an Exploding Kitten. Reinsert the bomb.",
        "effects": [{"type": "defuse", "consumes": "defuse", "target": "self",
                     "description": "Use a Defuse to survive.", "metadata": {"autoplay": true}}],
        "isPlayable": false, "isReaction": false, "count": 6,
        "metadata": {"guaranteedInStartHand": true, "autoplay": true}
      },
      {
        "_example": "Reaction / Counter card (Nope)",
        "id": "nope_example", "name": "Nope", "type": "reaction", "subtype": "nope",
        "emoji": "\ud83d\udeab", "description": "Cancel any action card played by another player.",
        "effects": [{"type": "cancel", "target": "any_action",
                     "description": "Cancel the last played action card.", "metadata": {}}],
        "isPlayable": true, "isReaction": true, "count": 5, "metadata": {}
      }
    ],


    "===== SECTION 5 \u2014 UI =====": "\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500",

    "ui": {
      "tableBackground": "#166534",
      "cardBack": "\ud83c\udca0",
      "deckLabel":    "Draw Pile",
      "discardLabel": "Discard Pile",
      "turnPrompt":  "It's your turn! Play a card or draw.",
      "waitPrompt":  "Waiting for {playerName}\u2026",
      "winMessage":  "\ud83c\udf89 {playerName} wins!",
      "eliminatedMessage": "\ud83d\udca5 {playerName} is out!",
      "actionLabels": {
        "draw_card":    "Draw Card \ud83c\udccf",
        "play_card":    "Play",
        "call_uno":     "UNO! \ud83d\udde3\ufe0f",
        "choose_color": "Choose Color",
        "challenge":    "Challenge!",
        "insert_card":  "Place Card",
        "select_target":"Choose Target"
      },
      "specialPrompts": {
        "choose_color":         "Choose a color to continue play",
        "stack_draw":           "You were hit with a draw! Stack or draw {total}?",
        "challenge_draw4":      "Challenge the Wild Draw 4?",
        "uno_call":             "You're down to 1 card \u2014 say UNO!",
        "uno_penalty":          "{playerName} forgot to say UNO \u2014 they draw 2!",
        "insert_card":          "Choose where to insert the card (0 = top)",
        "favor_target_select":  "Choose a player to request a card from",
        "steal_target_select":  "Choose a player to steal from",
        "combo_target_select":  "Choose a player to steal from"
      },
      "colorPicker": {
        "red":    { "label": "Red",    "emoji": "\ud83d\udd34", "bg": "#dc2626" },
        "yellow": { "label": "Yellow", "emoji": "\ud83d\udfe1", "bg": "#ca8a04" },
        "green":  { "label": "Green",  "emoji": "\ud83d\udfe2", "bg": "#16a34a" },
        "blue":   { "label": "Blue",   "emoji": "\ud83d\udd35", "bg": "#2563eb" }
      }
    },


    "===== FULL EFFECT TYPE REFERENCE =====": "\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500",

    "_effect_reference": {
      "number":     "Standard numbered/colored card.",
      "skip":       "Next player(s) lose their turn. value = how many to skip.",
      "reverse":    "Flip turn direction.",
      "draw":       "Target draws N cards.",
      "self_draw":  "The playing player draws N cards.",
      "wild":       "Prompts color choice, sets active color.",
      "wild_draw":  "Wild + forces target to draw N.",
      "eliminate":  "Removes a player. Use with has_card_type condition for defuse.",
      "defuse":     "Consumes card from hand to block elimination.",
      "peek":       "Reveals top N draw pile cards to player.",
      "shuffle":    "Shuffles the draw pile.",
      "steal":      "Takes a card from target.",
      "give":       "Forces target to give player one card.",
      "insert":     "Place a card back into draw pile at chosen position.",
      "extra_turn": "Current player takes another turn.",
      "swap_hands": "Swap entire hand with chosen player.",
      "score":      "Add or subtract points.",
      "any":        "No-op / cosmetic.",
      "cancel":     "Cancels previous action."
    },

    "_card_metadata_reference": {
      "color":                  "Card color for matchColor logic.",
      "number":                 "Card numeric value for matchNumber logic.",
      "points":                 "Point value for scoring.",
      "guaranteedInStartHand":  "true = one copy dealt to every player before random filling.",
      "notInStartDeck":         "true = excluded from initial deck.",
      "injectCount":            "Integer or 'players_minus_one'.",
      "requiresColorChoice":    "Show color picker on play.",
      "requiresTarget":         "Show target selector on play.",
      "challengeable":          "Show challenge button.",
      "autoplay":               "Triggers automatically.",
      "comboGroup":             "Cards sharing a comboGroup can be paired."
    }
}'''


# ── Step 1: Research game rules via Perplexity Sonar ─────────────────────────

@app.function(
    image=image,
    secrets=[modal.Secret.from_dotenv(path=str(_backend_root / ".env"))],
    timeout=60,
)
def research_game_rules(game_name: str) -> str:
    """Call Perplexity Sonar API to look up comprehensive card game rules."""
    import httpx
    import os

    api_key = os.environ["PERPLEXITY_API_KEY"]

    response = httpx.post(
        "https://api.perplexity.ai/chat/completions",
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        json={
            "model": "sonar",
            "messages": [
                {
                    "role": "system",
                    "content": (
                        "You are a card game rules expert. Provide comprehensive, "
                        "detailed rules for card games. Include: all card types and "
                        "their quantities, setup instructions, turn structure, special "
                        "rules, and win conditions. Be exhaustive and precise about "
                        "numbers and mechanics."
                    ),
                },
                {
                    "role": "user",
                    "content": (
                        f'Provide the complete official rules for the card game '
                        f'"{game_name}". Include:\n'
                        "1. All card types, their names, descriptions, and exact "
                        "quantities in a standard deck\n"
                        "2. Setup: how many cards each player gets, any special "
                        "setup steps\n"
                        "3. Turn structure: what happens on each turn, in order\n"
                        "4. All special card effects and interactions\n"
                        "5. Win condition(s)\n"
                        "6. Any special rules (e.g. stacking, challenging, calling "
                        "out)\n"
                        "7. Player count range (min and max players)\n\n"
                        "Be as detailed and precise as possible. Include exact card "
                        "counts."
                    ),
                },
            ],
        },
        timeout=30.0,
    )
    response.raise_for_status()
    data = response.json()
    return data["choices"][0]["message"]["content"]


# ── Step 2: Generate game JSON via Anthropic Claude ──────────────────────────

@app.function(
    image=image,
    secrets=[modal.Secret.from_dotenv(path=str(_backend_root / ".env"))],
    timeout=180,
)
def generate_game_json(
    game_name: str,
    rules_text: str,
    error_feedback: str = "",
) -> str:
    """Use Anthropic Claude to produce a game-definition JSON string."""
    import anthropic

    # Template is inlined as GAME_TEMPLATE constant — no file I/O needed
    template = GAME_TEMPLATE

    error_section = ""
    if error_feedback:
        error_section = (
            "\n\nIMPORTANT -- YOUR PREVIOUS ATTEMPT HAD ERRORS. FIX ALL OF THEM:\n"
            f"{error_feedback}\n"
        )

    effect_list = ", ".join(VALID_EFFECT_TYPES)
    card_type_list = ", ".join(VALID_CARD_TYPES)
    wc_list = ", ".join(VALID_WIN_CONDITIONS)
    target_list = ", ".join(VALID_TARGETS)

    client = anthropic.Anthropic()  # reads ANTHROPIC_API_KEY from env

    message = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=16384,
        system=(
            "You are an expert card game engine developer. You generate game "
            "definition JSON files for a universal card game engine.\n\n"
            "Your output must be ONLY valid JSON -- no markdown, no code fences, "
            "no explanation text. Output the raw JSON object and nothing else."
        ),
        messages=[
            {
                "role": "user",
                "content": (
                    f'Generate a complete game JSON definition for "{game_name}" '
                    f"based on these researched rules:\n\n"
                    f"--- GAME RULES ---\n{rules_text}\n--- END RULES ---\n\n"
                    f"--- JSON TEMPLATE (follow this schema exactly) ---\n"
                    f"{template}\n--- END TEMPLATE ---\n\n"
                    "Requirements:\n"
                    f"1. Use ONLY these valid effect types: {effect_list}\n"
                    f"2. Use ONLY these card types: {card_type_list}\n"
                    f"3. Use ONLY these win conditions: {wc_list}\n"
                    f"4. Use ONLY these targets: {target_list}\n"
                    "5. Every card MUST have: id, name, type, subtype, emoji, "
                    "description, effects, isPlayable, isReaction, count, metadata\n"
                    "6. Every effect MUST have: type, target, description\n"
                    "7. The top-level 'id' field must be lowercase with underscores "
                    "only (e.g. 'crazy_eights')\n"
                    "8. Remove ALL keys starting with '_' (template comments)\n"
                    "9. Remove ALL keys starting with '=====' (section headers)\n"
                    "10. Include realistic card counts matching the official game\n"
                    "11. Include a complete UI section with prompts and labels\n"
                    "12. The config section must accurately reflect the game's "
                    "matching / stacking / color rules\n"
                    "13. The 'id' must match the intended filename "
                    "(e.g. 'crazy_eights' -> crazy_eights.json)\n"
                    f"{error_section}\n"
                    "Output ONLY the JSON object, nothing else."
                ),
            }
        ],
    )

    return message.content[0].text


# ── Step 3: Generate game-specific Python plugin ─────────────────────────────

# Base class that all plugins extend (inlined for the prompt)
_PLUGIN_BASE = r'''
from typing import Any, Dict, List, Optional, Tuple
from app.models.game import GameState, Player, Card

class GamePluginBase:
    def __init__(self, game_id: str, game_config: Dict[str, Any]):
        self.game_id = game_id
        self.config = game_config

    def get_custom_actions(self) -> Dict[str, callable]:
        """Return dict mapping action type strings to handler functions.
        Handler signature: (state: GameState, action) -> Tuple[bool, str, List[str]]"""
        return {}

    def get_custom_effects(self) -> Dict[str, callable]:
        """Return dict mapping effect type strings to handler functions.
        Handler signature: (state, player, card, effect, action, triggered) -> Optional[Dict]"""
        return {}

    def on_game_start(self, state: GameState) -> None: pass
    def on_turn_start(self, state: GameState, player: Player) -> None: pass
    def on_card_played(self, state: GameState, player: Player, card: Card) -> Optional[Dict[str, Any]]: return None
    def on_turn_end(self, state: GameState, player: Player) -> None: pass
    def on_game_end(self, state: GameState, winner: Optional[Player]) -> None: pass

    def validate_card_play(self, state: GameState, player: Player, card: Card) -> Tuple[bool, str]:
        return True, ""

    def validate_action(self, state: GameState, action) -> Tuple[bool, str]:
        return True, ""

    # Helpers
    def get_active_players(self, state): return [p for p in state.players if p.status not in ("eliminated", "winner")]
    def get_player(self, state, pid): return next((p for p in state.players if p.id == pid), None)
    def get_current_player(self, state): return self.get_player(state, state.currentTurnPlayerId)
    def add_metadata(self, state, key, val): state.metadata[key] = val
    def get_metadata(self, state, key, default=None): return state.metadata.get(key, default)
'''

# UNO plugin as a working example for the AI
_UNO_PLUGIN_EXAMPLE = r'''
"""
UNO Game Plugin - handles color choice, UNO call, Wild Draw 4 challenge.
"""
import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple
from app.models.game import GameState, Player, Card, LogEntry
from app.services.engines.game_plugin_base import GamePluginBase

def _ts(): return int(datetime.now().timestamp() * 1000)
def _log(msg, type_="action", pid=None, cid=None):
    return LogEntry(id=str(uuid.uuid4()), timestamp=_ts(), message=msg, type=type_, playerId=pid, cardId=cid)

class UnoPlugin(GamePluginBase):
    def get_custom_actions(self):
        return {
            "choose_color": self._action_choose_color,
            "call_uno": self._action_call_uno,
            "catch_uno": self._action_catch_uno,
            "challenge_wild_draw4": self._action_challenge,
        }

    def _action_choose_color(self, state, action):
        pending = state.pendingAction
        if not pending or pending.get("type") != "choose_color":
            return False, "No color choice pending", []
        if action.playerId != pending["playerId"]:
            return False, "Not your color choice", []
        chosen = (action.metadata or {}).get("color")
        valid_colors = self.config.get("colors", ["red", "yellow", "green", "blue"])
        if chosen not in valid_colors:
            return False, f"Invalid color: {chosen}", []
        state.metadata["activeColor"] = chosen
        from app.services.engines.universal import _discard_zone
        discard = _discard_zone(state)
        if discard and discard.cards:
            top = discard.cards[0]
            top.metadata = {**(top.metadata or {}), "color": chosen}
        player = self.get_player(state, pending["playerId"])
        state.log.append(_log(f"{player.name} chose {chosen}!", "action", pending["playerId"]))
        state.pendingAction = None
        state.phase = "playing"
        triggered = [f"color_chosen:{chosen}"]
        if pending.get("isWildDraw", False):
            from app.services.engines.universal import _advance_turn
            _advance_turn(state)
        if player and not player.hand.cards:
            player.status = "winner"; state.winner = player; state.phase = "ended"
            triggered.append("win")
        return True, "", triggered

    def _action_call_uno(self, state, action):
        player = self.get_player(state, action.playerId)
        if not player: return False, "Player not found", []
        if len(player.hand.cards) != 1: return False, "Can only call UNO with 1 card", []
        called = state.metadata.setdefault("unoCalledBy", [])
        if player.id not in called: called.append(player.id)
        state.log.append(_log(f"{player.name} calls UNO!", "effect", player.id))
        return True, "", ["uno_called"]

    def _action_catch_uno(self, state, action):
        target_id = action.targetPlayerId or (action.metadata or {}).get("targetPlayerId")
        target = self.get_player(state, target_id)
        catcher = self.get_player(state, action.playerId)
        if not target or not catcher: return False, "Player not found", []
        if target.id in state.metadata.get("unoCalledBy", []): return False, "Already called UNO", []
        if len(target.hand.cards) != 1: return False, "Player doesn't have 1 card", []
        from app.services.engines.universal import _draw_n
        _draw_n(state, target, 2)
        state.log.append(_log(f"{catcher.name} caught {target.name}! Draw 2.", "effect", catcher.id))
        return True, "", [f"caught_uno:{target.id}"]

    def _action_challenge(self, state, action):
        pending = state.pendingAction
        if not pending or pending.get("type") != "challenge_or_accept": return False, "No challenge pending", []
        challenger = self.get_player(state, pending["playerId"])
        challenged = self.get_player(state, pending["challengedPlayerId"])
        draw_count = pending.get("drawCount", 4)
        do_challenge = (action.metadata or {}).get("challenge", False)
        state.pendingAction = None; state.phase = "playing"; state.metadata["pendingDraw"] = 0
        from app.services.engines.universal import _draw_n, _advance_turn
        triggered = []
        if not do_challenge:
            if challenger: _draw_n(state, challenger, draw_count)
            triggered.append(f"accepted:{draw_count}"); _advance_turn(state)
        else:
            if state.metadata.get("lastWildDraw4WasIllegal", False):
                if challenged: _draw_n(state, challenged, 4)
                triggered.append("challenge_success")
            else:
                penalty = draw_count + 2
                if challenger: _draw_n(state, challenger, penalty)
                triggered.append(f"challenge_failed:{penalty}"); _advance_turn(state)
        return True, "", triggered

    def on_card_played(self, state, player, card):
        if len(player.hand.cards) == 1:
            state.metadata.setdefault("unoCalledBy", [])
        if card.subtype == "wild_draw4":
            active_color = state.metadata.get("activeColor")
            if active_color:
                has_match = any(c.metadata and c.metadata.get("color") == active_color for c in player.hand.cards if c.id != card.id)
                state.metadata["lastWildDraw4WasIllegal"] = has_match
        return None

    def validate_card_play(self, state, player, card):
        if self.config.get("matchColor") and state.metadata.get("pendingDraw", 0) > 0 and self.config.get("stackableDraw"):
            if not any(e.type in ("draw", "wild_draw") for e in card.effects):
                if not (card.metadata and card.metadata.get("color") == "wild"):
                    return False, "Must play a draw card to stack or draw"
        return True, ""

def create_plugin(game_config):
    return UnoPlugin("uno", game_config)
'''


@app.function(
    image=image,
    secrets=[modal.Secret.from_dotenv(path=str(_backend_root / ".env"))],
    timeout=180,
)
def generate_game_plugin(
    game_name: str,
    game_id: str,
    game_json_str: str,
    rules_text: str,
) -> str:
    """
    Use Anthropic Claude to generate a game-specific Python plugin file.

    The plugin extends GamePluginBase and adds custom actions, effects,
    validation, and lifecycle hooks specific to the game.
    """
    import anthropic

    client = anthropic.Anthropic()

    message = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=16384,
        system=(
            "You are an expert Python game engine developer. You generate "
            "game-specific plugin files for a universal card game engine.\n\n"
            "Your output must be ONLY valid Python code -- no markdown, no code "
            "fences, no explanation text. Output the raw Python file and nothing else.\n\n"
            "IMPORTANT: The plugin must be syntactically valid Python 3.9+. "
            "Use standard imports only. The plugin will be dynamically imported."
        ),
        messages=[
            {
                "role": "user",
                "content": (
                    f'Generate a Python plugin file for the card game "{game_name}" '
                    f"(game_id: {game_id}).\n\n"
                    f"--- PLUGIN BASE CLASS (inherit from this) ---\n"
                    f"{_PLUGIN_BASE}\n--- END BASE CLASS ---\n\n"
                    f"--- EXAMPLE PLUGIN (UNO -- follow this pattern) ---\n"
                    f"{_UNO_PLUGIN_EXAMPLE}\n--- END EXAMPLE ---\n\n"
                    f"--- GAME RULES (researched) ---\n{rules_text}\n--- END RULES ---\n\n"
                    f"--- GAME JSON DEFINITION ---\n{game_json_str}\n--- END JSON ---\n\n"
                    "Requirements:\n"
                    "1. Create a class that inherits from GamePluginBase\n"
                    "2. The class name should be PascalCase of the game name + 'Plugin' "
                    f"(e.g. '{game_name.replace(' ', '')}Plugin')\n"
                    "3. Implement get_custom_actions() for any game-specific actions "
                    "(e.g. special calls, challenges, choices)\n"
                    "4. Implement on_card_played() for card-specific validation\n"
                    "5. Implement validate_card_play() for play-legality rules\n"
                    "6. Use the same imports as the UNO example\n"
                    "7. Include a create_plugin(game_config) factory function at the bottom\n"
                    "8. Use helper functions from universal engine via lazy imports:\n"
                    "   from app.services.engines.universal import _draw_n, _advance_turn, _discard_zone\n"
                    "9. Add game log entries using LogEntry for important actions\n"
                    "10. Handle edge cases gracefully (missing players, empty hands, etc.)\n"
                    "11. Only implement hooks that the game actually needs -- leave others "
                    "as the base class default\n"
                    "12. If the game has no special mechanics beyond what universal.py "
                    "handles, create a minimal plugin with just the factory function\n\n"
                    "Output ONLY the Python code, nothing else."
                ),
            }
        ],
    )

    return message.content[0].text


# ── Step 4: Validate generated game JSON ──────────────────────────────────────

@app.function(image=image, timeout=120)
def validate_in_sandbox(game_json_str: str) -> dict:
    """
    Validate the generated game JSON inside an isolated Modal function.

    Runs pure-Python validation logic directly — the Modal function
    container is already sandboxed infrastructure.
    """
    import json
    import random

    try:
        game = json.loads(game_json_str)
    except json.JSONDecodeError as e:
        return {"valid": False, "errors": [f"Invalid JSON: {e}"], "warnings": []}

    errors = []
    warnings = []

    _EFF = {
        "number", "skip", "reverse", "draw", "self_draw", "wild", "wild_draw",
        "eliminate", "defuse", "peek", "shuffle", "steal", "give", "insert",
        "extra_turn", "swap_hands", "score", "any", "cancel", "combo_steal",
    }
    _CTYPES = {"number", "action", "reaction", "defense", "wild", "special", "combo"}
    _WC = {"empty_hand", "last_standing", "most_points", "target_score"}

    # 1. Required top-level fields
    for f in ("id", "name", "description", "rules", "cards"):
        if f not in game:
            errors.append(f"Missing required top-level field: '{f}'")

    # 2. Template artefacts
    for k in list(game.keys()):
        if k.startswith("_") or k.startswith("="):
            errors.append(f"Template artefact not removed: '{k}'")

    # 3. ID format
    gid = game.get("id", "")
    if not gid:
        errors.append("Game 'id' is empty")
    elif not all(c.isalnum() or c == "_" for c in gid) or gid != gid.lower():
        errors.append(f"Invalid game id '{gid}': must be lowercase with underscores")

    # 4. Rules
    rules = game.get("rules", {})
    for f in ("minPlayers", "maxPlayers", "handSize", "turnStructure", "winCondition"):
        if f not in rules:
            errors.append(f"Missing rules field: '{f}'")

    if "phases" not in rules.get("turnStructure", {}):
        errors.append("rules.turnStructure.phases is required")

    wc = rules.get("winCondition", {})
    if wc.get("type") not in _WC:
        errors.append(f"Invalid win condition: '{wc.get('type')}'")

    min_p = rules.get("minPlayers", 2)
    max_p = rules.get("maxPlayers", 10)
    hs = rules.get("handSize", 7)
    if not isinstance(min_p, int) or min_p < 1:
        errors.append(f"Invalid minPlayers: {min_p}")
    if not isinstance(max_p, int) or max_p < min_p:
        errors.append(f"Invalid maxPlayers: {max_p}")
    if not isinstance(hs, int) or hs < 1:
        errors.append(f"Invalid handSize: {hs}")

    # 5. Cards
    cards = game.get("cards", [])
    if not cards:
        errors.append("No cards defined")

    total = 0
    ids = set()
    for i, card in enumerate(cards):
        cid = card.get("id", f"card_{i}")
        for f in ("id", "name", "type", "effects", "count"):
            if f not in card:
                errors.append(f"Card '{cid}': missing '{f}'")
        if card.get("type") not in _CTYPES:
            errors.append(f"Card '{cid}': invalid type '{card.get('type')}'")
        if cid in ids:
            errors.append(f"Duplicate card id: '{cid}'")
        ids.add(cid)
        cnt = card.get("count", 0)
        if not isinstance(cnt, int) or cnt < 1:
            errors.append(f"Card '{cid}': bad count {cnt}")
        elif not card.get("metadata", {}).get("notInStartDeck", False):
            total += cnt
        for j, eff in enumerate(card.get("effects", [])):
            if eff.get("type") not in _EFF:
                errors.append(f"Card '{cid}' effect {j}: invalid type '{eff.get('type')}'")
        for k in list(card.keys()):
            if k.startswith("_"):
                errors.append(f"Card '{cid}': template key '{k}'")

    # 6. Deck size
    need = min_p * hs
    if total < need:
        errors.append(f"Not enough cards ({total}) to deal {hs} to {min_p} players ({need} needed)")

    # 7. Config artefacts
    for k in list(game.get("config", {}).keys()):
        if k.startswith("_"):
            errors.append(f"Config: template key '{k}'")

    # 8. UI
    ui = game.get("ui", {})
    if not ui:
        warnings.append("No UI section")
    for k in list(ui.keys()):
        if k.startswith("_"):
            errors.append(f"UI: template key '{k}'")

    # 9. Quick deal simulation
    if not errors:
        try:
            deck = []
            for card in cards:
                if not card.get("metadata", {}).get("notInStartDeck", False):
                    deck.extend([card["id"]] * card.get("count", 1))
            random.shuffle(deck)
            for _ in range(min_p):
                for _ in range(hs):
                    if deck:
                        deck.pop()
            if len(deck) < 1:
                warnings.append(f"Only {len(deck)} card(s) remain after dealing")
        except Exception as e:
            errors.append(f"Simulation failed: {e}")

    return {"valid": len(errors) == 0, "errors": errors, "warnings": warnings}
