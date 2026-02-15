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

# Engine source files read at deploy time (locally) and inlined as strings
# so the plugin generator can pass them to the AI as context.
_engines_dir = Path(__file__).resolve().parent / "engines"


def _read_engine_file(name: str) -> str:
    """Read an engine source file at deploy time. Returns empty comment on failure."""
    try:
        return (_engines_dir / name).read_text(encoding="utf-8")
    except (FileNotFoundError, OSError):
        return f"# {name} not available"


_SRC_GENERIC = _read_engine_file("generic.py")
_SRC_PLUGIN_LOADER = _read_engine_file("plugin_loader.py")
_SRC_UNIVERSAL = _read_engine_file("universal.py")
_SRC_UNO_PLUGIN = _read_engine_file("uno.py")
_SRC_PLUGIN_BASE = _read_engine_file("game_plugin_base.py")

# Main image
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
      ],

      "defaultActions": [
        {
          "_note": "OPTIONAL array. Declares action buttons shown to players during gameplay.",
          "_note2": "These become real buttons in the UI. Each action needs an id, label, actionType, showCondition, and inputType.",
          "id": "example_button",
          "label": "Draw Card 🃏",
          "icon": "🃏",
          "description": "Draw a card from the deck",
          "actionType": "draw_card",
          "showCondition": { "type": "is_current_turn" },
          "_showCondition_types": [
            "is_current_turn        — show when it is this player's turn",
            "is_current_turn_and_phase — show during a specific phase (set 'phase' key)",
            "metadata_equals        — show when state.metadata[key] == value",
            "metadata_gt            — show when state.metadata[key] > value",
            "metadata_lt            — show when state.metadata[key] < value",
            "has_cards_in_hand      — show when player has cards",
            "always                 — always show (any phase, any turn)",
            "compound               — combine conditions with 'all' (AND) or 'any' (OR) arrays",
            "self_has_one_card      — (legacy) UNO-style: player has exactly 1 card",
            "opponent_has_one_card_no_call — (legacy) UNO-style: opponent forgot to call"
          ],
          "color": "blue",
          "_color_choose": ["red", "yellow", "green", "blue", "gray"],
          "inputType": "button",
          "_inputType_choose": [
            "button  — simple click action, fires immediately",
            "number  — numeric input with +/- stepper and confirm (e.g. bet amount). Set inputConfig.",
            "choice  — inline choice chips (e.g. pick a suit/color). Set inputConfig.choices."
          ],
          "inputConfig": {
            "_note": "Only needed for 'number' or 'choice' inputType.",
            "_for_number": "{ min, max, step, label, metadataMin, metadataMax }",
            "_for_choice": "{ label, choices: [{value, label, icon?, color?}], metadataChoicesKey }"
          }
        },
        {
          "_example": "Number input (e.g. Poker bet)",
          "id": "bet_example",
          "label": "Bet 💰",
          "icon": "💰",
          "description": "Place a bet",
          "actionType": "bet",
          "showCondition": { "type": "is_current_turn" },
          "color": "green",
          "inputType": "number",
          "inputConfig": { "min": 1, "metadataMax": "playerChips", "step": 1, "label": "Bet amount" }
        },
        {
          "_example": "Choice input (e.g. Go Fish ask rank)",
          "id": "choice_example",
          "label": "Choose Color",
          "icon": "🎨",
          "actionType": "choose_color",
          "showCondition": { "type": "is_current_turn" },
          "color": "blue",
          "inputType": "choice",
          "inputConfig": {
            "label": "Pick a color",
            "choices": [
              { "value": "red", "label": "Red", "icon": "🔴" },
              { "value": "blue", "label": "Blue", "icon": "🔵" }
            ]
          }
        }
      ],
      "_defaultActions_note": "IMPORTANT: Include defaultActions for ANY game that has turn-based actions beyond simple card play. Examples: Hit/Stay (Blackjack/Flip Seven), Check/Bet/Call/Raise/Fold (Poker), Ask for Rank (Go Fish), Knock/Draw (Gin Rummy). Use inputType 'button' for simple actions, 'number' for bet/wager amounts, 'choice' for picking from options.",

      "blinds": {
        "_note": "OPTIONAL. Automatic blind posting at game start (Texas Hold'em, etc.).",
        "_note2": "Engine deducts chips from first two players, sets currentBet = bigBlind, adds to pot.",
        "smallBlind": 10,
        "bigBlind": 20
      },

      "roundActions": [
        {
          "_note": "OPTIONAL array. Defines automatic actions that fire after each complete round of turns (all active players have acted). Phases execute in order — phase 0 fires after the first round, phase 1 after the second, etc.",
          "phase": "descriptive_name",
          "actions": [
            {
              "type": "deal_to_zone",
              "_type_choose": [
                "burn_card      — discard one card face-down from the deck (poker rule: burn before community deals)",
                "deal_to_zone   — deal N cards from deck to a named zone (e.g. community cards)",
                "reset_bets     — reset currentBet and per-player currentRoundBet to 0",
                "end_round      — end the game/round (triggers showdown/scoring)",
                "log            — append a message to the game log"
              ],
              "zone": "community",
              "count": 3,
              "message": "The flop: {cards}"
            }
          ]
        },
        {
          "_example_poker_flop": true,
          "phase": "flop",
          "actions": [
            { "type": "burn_card" },
            { "type": "deal_to_zone", "zone": "community", "count": 3, "message": "The flop: {cards}" },
            { "type": "reset_bets" }
          ]
        }
      ],
      "_roundActions_note": "Use for: Poker (burn card + deal flop/turn/river between betting rounds), multi-phase games with automatic card dealing or state changes between player rounds."
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
      },
      "layout": {
        "_note": "OPTIONAL. Controls which table zones are visible and other UI hints.",
        "hideDrawPile": false,
        "_hideDrawPile_note": "true = do not show the draw pile (e.g. Poker has no player draw).",
        "hideDiscardPile": false,
        "_hideDiscardPile_note": "true = do not show the discard pile.",
        "showZones": [],
        "_showZones_note": "Array of custom zone IDs to display on the table (e.g. ['community'] for Poker).",
        "showScoreboard": false,
        "_showScoreboard_note": "true = display a live scoreboard (useful for point-based games like Flip Seven).",
        "primaryActionArea": "buttons",
        "_primaryActionArea_note": "OPTIONAL. 'buttons' (default) = action buttons at bottom. Could be extended later."
      },
      "playerDisplayFields": [
        {
          "_note": "OPTIONAL array. Defines per-player stats shown next to each player on the table.",
          "_note2": "Values are read from state.metadata.playerData[playerId][key]. Use defaultValue if key might be missing.",
          "key": "playerChips",
          "label": "Chips",
          "icon": "🪙",
          "format": "number",
          "_format_choose": ["number", "text"],
          "defaultValue": 1000
        }
      ],
      "_playerDisplayFields_note": "Use for: chip counts (Poker), score (point games), health (custom games), etc.",
      "gameDisplayFields": [
        {
          "_note": "OPTIONAL array. Defines game-wide stats shown at top of table (visible to all).",
          "_note2": "Values are read from state.metadata[key]. Use defaultValue if key might be missing.",
          "key": "pot",
          "label": "Pot",
          "icon": "🏆",
          "format": "number",
          "defaultValue": 0
        }
      ],
      "_gameDisplayFields_note": "Use for: pot size (Poker), round number, deck remaining, etc."
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

    "_builtin_actionType_reference": {
      "_note": "These actionTypes are handled natively by the universal engine. Use them in defaultActions.",
      "play_card":    "Play a card from hand (standard turn action).",
      "draw_card":    "Draw card(s) from the deck. Draws max(1, drawCount) cards.",
      "stay":         "End turn without acting (e.g. 'Stay' in Flip Seven, bank points).",
      "check":        "Pass without betting when no bet is active (poker). Same as stay internally.",
      "bet":          "Place a bet. Requires inputType:'number', amount from metadata. Resets roundActedPlayers.",
      "call":         "Match the current bet (poker). Amount auto-calculated from currentBet.",
      "raise":        "Increase the current bet. Requires inputType:'number'. Resets roundActedPlayers.",
      "fold":         "Fold — player is eliminated from the round.",
      "all_in":       "Bet all remaining chips.",
      "choose_color": "Choose a color (wild card resolution). Requires inputType:'choice'.",
      "call_uno":     "Declare UNO (1 card left).",
      "catch_uno":    "Catch opponent who forgot UNO.",
      "challenge":    "Challenge a play."
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
                        "You are a world-class card game rules authority who ONLY "
                        "provides OFFICIAL, PUBLISHED rules. You treat game rules "
                        "like a legal document — every number, every edge case, every "
                        "phase of play must be exact and verifiable. You NEVER "
                        "improvise, simplify, or paraphrase rules. If something is "
                        "ambiguous in the official rules, you explicitly note the "
                        "ambiguity rather than guessing. You always cite the most "
                        "authoritative source (official rulebook, publisher website, "
                        "or tournament standard). Be exhaustive and precise."
                    ),
                },
                {
                    "role": "user",
                    "content": (
                        f'Provide the COMPLETE, STRICT, OFFICIAL rules for the card '
                        f'game "{game_name}". This will be used to build a digital '
                        f'version, so every detail matters. Do NOT simplify or skip '
                        f'anything.\n\n'
                        "Provide ALL of the following sections with EXACT numbers:\n\n"
                        "1. DECK COMPOSITION:\n"
                        "   - Every distinct card type, its name, and EXACT count\n"
                        "   - Total cards in the deck\n"
                        "   - Card values/rankings if applicable (e.g. Ace high/low)\n"
                        "   - Suits, colors, or categories if applicable\n\n"
                        "2. GAME SETUP:\n"
                        "   - Exact number of cards dealt to each player\n"
                        "   - How the remaining deck is placed\n"
                        "   - Any community/shared card areas and how they start\n"
                        "   - Any forced bets (blinds, antes) with exact amounts\n"
                        "   - Who goes first and how that is determined\n\n"
                        "3. TURN STRUCTURE (step-by-step, in EXACT order):\n"
                        "   - What the active player MUST do\n"
                        "   - What the active player MAY do (optional actions)\n"
                        "   - What they CANNOT do\n"
                        "   - When the turn ends and how play passes\n\n"
                        "4. GAME PHASES / ROUNDS (if the game has multiple phases):\n"
                        "   - Name each phase (e.g. pre-flop, flop, turn, river)\n"
                        "   - What triggers the transition between phases\n"
                        "   - What happens automatically between phases (e.g. burn "
                        "cards, deal community cards, reset bets)\n"
                        "   - How many rounds/phases exist in total\n\n"
                        "5. ALL AVAILABLE PLAYER ACTIONS:\n"
                        "   - List EVERY action a player can take (e.g. hit, stay, "
                        "bet, call, raise, fold, draw, discard, knock, etc.)\n"
                        "   - The EXACT conditions under which each action is allowed\n"
                        "   - The EXACT effect of each action on the game state\n"
                        "   - Any minimum/maximum constraints (e.g. minimum raise "
                        "amount, max hand size)\n\n"
                        "6. SPECIAL CARD EFFECTS:\n"
                        "   - Every card with a special ability\n"
                        "   - Exact trigger and resolution\n"
                        "   - Interaction with other special cards\n\n"
                        "7. WIN CONDITION:\n"
                        "   - EXACT condition(s) for winning\n"
                        "   - How ties are broken\n"
                        "   - Hand rankings if applicable (list ALL ranks in order)\n"
                        "   - Scoring formula if applicable\n\n"
                        "8. EDGE CASES & SPECIAL RULES:\n"
                        "   - What happens if the deck runs out\n"
                        "   - Rules for 2-player games vs multiplayer\n"
                        "   - Any penalty rules\n"
                        "   - Official variant rules (if commonly played)\n\n"
                        "9. PLAYER COUNT: Exact minimum and maximum players\n\n"
                        "IMPORTANT: Do NOT leave any numbers as 'varies' or "
                        "'typically'. Give the EXACT official number. If there are "
                        "multiple official variants, state the STANDARD version first."
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
            "You are an expert card game engine developer who generates game "
            "definition JSON files for a universal card game engine.\n\n"
            "CRITICAL RULES:\n"
            "1. Your output must be ONLY valid JSON — no markdown, no code fences, "
            "no explanation text. Output the raw JSON object and nothing else.\n"
            "2. You MUST faithfully implement EVERY rule from the researched rules. "
            "Do NOT simplify, skip, or approximate any game mechanic.\n"
            "3. Every player action described in the rules MUST appear as a "
            "defaultAction with correct showCondition logic.\n"
            "4. Game phases and automatic between-round actions (dealing community "
            "cards, burning cards, resetting bets) MUST be encoded in roundActions.\n"
            "5. All card counts, hand sizes, scoring values, and bet amounts must "
            "match the official rules EXACTLY.\n"
            "6. If the game has betting, you MUST include blinds/antes config, "
            "chip tracking via playerDisplayFields, and pot/bet tracking via "
            "gameDisplayFields.\n"
            "7. Do NOT invent mechanics that are not in the researched rules."
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
                    "\n"
                    "--- CRITICAL: GAME ACTIONS & UI ---\n"
                    "14. EVERY game with turn-based actions MUST have config.defaultActions.\n"
                    "    - Betting games (poker, blackjack): check, bet, call, raise, fold, all_in buttons\n"
                    "    - Draw-or-play games (Flip Seven, Go Fish): draw_card, stay buttons\n"
                    "    - Standard card games (UNO): draw_card, play_card buttons\n"
                    "    - Each action needs: id, label, icon, description, actionType, showCondition, color, inputType\n"
                    "    - Use 'showCondition' with compound/metadata_equals/metadata_gt types for conditional visibility\n"
                    "    - Use inputType 'button' for simple actions, 'number' for amounts, 'choice' for picking options\n"
                    "    - See the _builtin_actionType_reference in the template for all engine-supported action types\n"
                    "15. Games with betting MUST have config.blinds (smallBlind, bigBlind).\n"
                    "16. Games with community cards or multi-phase dealing MUST have config.roundActions.\n"
                    "    - Include burn_card before community deals (proper poker rules)\n"
                    "    - Include reset_bets between betting rounds\n"
                    "    - End with end_round at the final phase\n"
                    "17. Define config.zones for ALL card areas:\n"
                    "    - Deck zone (type: 'deck', isPublic: false)\n"
                    "    - Community/shared zones if needed (isPublic: true)\n"
                    "    - Burn zone if needed (isPublic: false)\n"
                    "18. Use ui.playerDisplayFields for per-player stats (chips, score, bet).\n"
                    "19. Use ui.gameDisplayFields for game-wide stats (pot, round number, current bet).\n"
                    "20. Use ui.layout to control visibility: hideDrawPile, hideDiscardPile, showZones, showScoreboard.\n"
                    "\n"
                    "--- RULES FIDELITY (MANDATORY) ---\n"
                    "21. Cross-check EVERY mechanic in your JSON against the researched rules above.\n"
                    "    - If the rules say 'burn a card before the flop', your roundActions MUST include burn_card.\n"
                    "    - If the rules say 'small blind 10, big blind 20', your blinds config MUST match.\n"
                    "    - If the rules list specific player actions (hit, stay, double down, split, etc.), "
                    "EACH ONE must be a defaultAction with correct showCondition.\n"
                    "    - If the rules describe phases (pre-flop, flop, turn, river), "
                    "EACH phase must be a roundActions entry.\n"
                    "    - Card counts must be EXACT. A standard 52-card deck has 13 ranks x 4 suits = 52 cards.\n"
                    "22. Do NOT omit actions because they seem minor. Every action a player can take in the "
                    "real game MUST be represented.\n"
                    "23. Do NOT simplify game flow. If there are 4 betting rounds in poker, there must be "
                    "4 phases in roundActions (pre-flop betting is implicit, then flop, turn, river, showdown).\n"
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

    Uses the actual engine source files (read at deploy time) so the AI
    understands the full plugin architecture and available primitives:
      - generic.py         : basic fallback engine (structure reference)
      - plugin_loader.py   : how plugins are loaded and registered
      - universal.py       : all effect primitives, actions, utilities
      - game_plugin_base.py: base class to inherit from
      - uno.py             : well-structured example plugin
    """
    import anthropic

    # Source files are read at deploy time and stored as module-level constants
    generic_src = _SRC_GENERIC
    plugin_loader_src = _SRC_PLUGIN_LOADER
    universal_src = _SRC_UNIVERSAL
    uno_plugin_src = _SRC_UNO_PLUGIN
    plugin_base_src = _SRC_PLUGIN_BASE

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
                    "SYSTEM ARCHITECTURE OVERVIEW:\n"
                    "The engine has a layered architecture:\n"
                    "1. generic.py   - Basic fallback engine for simple card games\n"
                    "2. universal.py - Full data-driven engine with all effect "
                    "primitives (number, skip, reverse, draw, wild, eliminate, "
                    "defuse, peek, shuffle, steal, give, insert, extra_turn, "
                    "swap_hands, score, etc.)\n"
                    "3. Game plugins - Game-specific customizations that hook into "
                    "universal.py via GamePluginBase\n"
                    "4. plugin_loader.py - Dynamically loads & registers plugins\n\n"
                    "Your plugin will be loaded by plugin_loader.py and called by "
                    "universal.py at the appropriate lifecycle points. Study the "
                    "source files below to understand what the engine ALREADY "
                    "handles (so you don't duplicate logic) and what needs a "
                    "plugin hook.\n\n"
                    f"--- GENERIC ENGINE (basic engine structure reference) ---\n"
                    f"{generic_src}\n--- END GENERIC ENGINE ---\n\n"
                    f"--- PLUGIN LOADER (how plugins are loaded and integrated) "
                    f"---\n"
                    f"{plugin_loader_src}\n--- END PLUGIN LOADER ---\n\n"
                    f"--- UNIVERSAL ENGINE (all available effect primitives, "
                    f"actions, and utilities your plugin can leverage) ---\n"
                    f"{universal_src}\n--- END UNIVERSAL ENGINE ---\n\n"
                    f"--- PLUGIN BASE CLASS (inherit from this) ---\n"
                    f"{plugin_base_src}\n--- END BASE CLASS ---\n\n"
                    f"--- EXAMPLE: UNO PLUGIN (well-structured minimal plugin) "
                    f"---\n"
                    f"{uno_plugin_src}\n--- END EXAMPLE ---\n\n"
                    f"--- GAME RULES (researched) ---\n{rules_text}\n"
                    f"--- END RULES ---\n\n"
                    f"--- GAME JSON DEFINITION ---\n{game_json_str}\n"
                    f"--- END JSON ---\n\n"
                    "Requirements:\n"
                    "1. Create a class that inherits from GamePluginBase\n"
                    "2. The class name should be PascalCase of the game name + "
                    f"'Plugin' (e.g. '{game_name.replace(' ', '')}Plugin')\n"
                    "3. Only implement get_custom_actions() for game-specific "
                    "actions that are NOT already handled by universal.py "
                    "(check the universal engine source to see what is built "
                    "in)\n"
                    "\n"
                    "IMPORTANT: The universal engine ALREADY handles these "
                    "action types natively — do NOT reimplement them:\n"
                    "  - play_card, draw_card, stay, check, bet, call, raise, "
                    "fold, all_in, choose_color, call_uno, catch_uno, challenge\n"
                    "  - Betting logic (deducting chips, updating pot, "
                    "currentBet, re-opening round on raise)\n"
                    "  - Blind posting (config.blinds)\n"
                    "  - Round actions (config.roundActions: burn_card, "
                    "deal_to_zone, reset_bets, end_round, log)\n"
                    "  - Player/game display fields (ui.playerDisplayFields, "
                    "ui.gameDisplayFields)\n"
                    "  - Zone management (custom zones, draw/discard piles)\n"
                    "Only add plugin hooks for mechanics the engine does NOT "
                    "handle (e.g. hand evaluation for poker showdown, combo "
                    "detection, special scoring rules).\n"
                    "\n"
                    "4. Implement on_card_played() for any card-specific state "
                    "tracking (see how UNO tracks Wild Draw 4 legality)\n"
                    "5. Implement validate_card_play() for additional play-"
                    "legality rules beyond what universal.py already enforces\n"
                    "6. Import from the engine only what you need:\n"
                    "   from app.services.engines.game_plugin_base import "
                    "GamePluginBase\n"
                    "   from app.models.game import GameState, Player, Card, "
                    "LogEntry\n"
                    "   from app.services.engines.universal import _draw_n, "
                    "_advance_turn, _discard_zone  # as needed\n"
                    "7. Include a create_plugin(game_config) factory function "
                    "at the bottom\n"
                    "8. Add game log entries using LogEntry for important "
                    "actions\n"
                    "9. Handle edge cases gracefully (missing players, empty "
                    "hands, etc.)\n"
                    "10. Only implement hooks that the game actually needs -- "
                    "leave others as the base class default\n"
                    "11. If the game has no special mechanics beyond what "
                    "universal.py handles, create a minimal plugin like the "
                    "UNO example (just lifecycle hooks + factory function)\n"
                    "12. Follow the exact pattern shown in the UNO plugin "
                    "example: module docstring, imports, class, lifecycle "
                    "hooks, factory function\n\n"
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
    cfg = game.get("config", {})
    for k in list(cfg.keys()):
        if k.startswith("_"):
            errors.append(f"Config: template key '{k}'")

    # 7b. Require defaultActions — every card game needs player action buttons
    _VALID_ACTION_TYPES = {
        "play_card", "draw_card", "stay", "check", "bet", "call",
        "raise", "fold", "all_in", "choose_color", "call_uno",
        "catch_uno", "challenge",
    }
    _VALID_INPUT_TYPES = {"button", "number", "choice"}
    default_actions = cfg.get("defaultActions", [])

    # Every game MUST have at least one defaultAction for the UI to work
    if not default_actions:
        errors.append(
            "config.defaultActions is REQUIRED but missing. "
            "Every game needs action buttons (e.g. draw_card, play_card, "
            "stay, check, bet, fold). Add defaultActions with at least: "
            "id, label, actionType, showCondition, color, inputType for "
            "each player action the game supports."
        )

    # Detect game type from rules and check for expected actions
    turn_struct = rules.get("turnStructure", {})
    has_draw = turn_struct.get("drawCount", 0) > 0
    can_pass = turn_struct.get("canPassTurn", False)
    has_betting = bool(cfg.get("blinds"))
    action_types_present = {da.get("actionType") for da in default_actions}

    # Games with drawing need a draw button
    if has_draw and "draw_card" not in action_types_present and default_actions:
        warnings.append(
            "Game has drawCount > 0 but no 'draw_card' defaultAction. "
            "Players may not be able to draw cards."
        )

    # Games where passing is allowed need a stay/check button
    if can_pass and not (action_types_present & {"stay", "check"}) and default_actions:
        warnings.append(
            "Game has canPassTurn=true but no 'stay' or 'check' defaultAction. "
            "Players may not be able to end their turn."
        )

    # Betting games need the full set of betting actions
    if has_betting:
        required_betting = {"check", "bet", "fold"}
        missing_betting = required_betting - action_types_present
        if missing_betting:
            errors.append(
                f"Game has config.blinds (betting game) but is missing "
                f"required betting actions: {', '.join(sorted(missing_betting))}. "
                f"Betting games must have at least: check, bet, call, raise, "
                f"fold, all_in defaultActions."
            )

    # Games with community zones likely need roundActions
    has_community = any(
        z.get("isPublic") and z.get("type") != "deck"
        for z in cfg.get("zones", [])
        if z.get("id") not in ("discard_pile", "burn")
    )
    if has_community and not cfg.get("roundActions"):
        warnings.append(
            "Game has public community zones but no roundActions defined. "
            "Community cards typically need roundActions to deal them "
            "automatically between betting rounds (e.g. flop/turn/river in poker)."
        )

    for i, da in enumerate(default_actions):
        da_id = da.get("id", f"action_{i}")
        for f in ("id", "label", "actionType", "showCondition", "inputType"):
            if f not in da:
                errors.append(f"defaultAction '{da_id}': missing '{f}'")
        if da.get("actionType") and da["actionType"] not in _VALID_ACTION_TYPES:
            warnings.append(
                f"defaultAction '{da_id}': actionType '{da['actionType']}' "
                f"is not a built-in type — ensure a plugin handles it"
            )
        if da.get("inputType") and da["inputType"] not in _VALID_INPUT_TYPES:
            errors.append(
                f"defaultAction '{da_id}': invalid inputType '{da['inputType']}'"
            )
        if da.get("inputType") in ("number", "choice") and "inputConfig" not in da:
            errors.append(
                f"defaultAction '{da_id}': inputType '{da['inputType']}' "
                f"requires 'inputConfig'"
            )
        for k in list(da.keys()):
            if k.startswith("_"):
                errors.append(f"defaultAction '{da_id}': template key '{k}'")

    # 7c. Validate roundActions structure
    _VALID_ROUND_ACTION_TYPES = {
        "burn_card", "deal_to_zone", "reset_bets", "end_round", "log",
    }
    round_actions = cfg.get("roundActions", [])
    zone_ids = {z.get("id") for z in cfg.get("zones", [])}
    for i, ra in enumerate(round_actions):
        phase_name = ra.get("phase", f"phase_{i}")
        if "actions" not in ra:
            errors.append(f"roundAction '{phase_name}': missing 'actions' array")
            continue
        for j, act in enumerate(ra.get("actions", [])):
            act_type = act.get("type")
            if not act_type:
                errors.append(
                    f"roundAction '{phase_name}' action {j}: missing 'type'"
                )
            elif act_type not in _VALID_ROUND_ACTION_TYPES:
                errors.append(
                    f"roundAction '{phase_name}' action {j}: "
                    f"invalid type '{act_type}'"
                )
            if act_type == "deal_to_zone":
                zone = act.get("zone", "")
                if zone and zone_ids and zone not in zone_ids:
                    errors.append(
                        f"roundAction '{phase_name}' action {j}: "
                        f"zone '{zone}' not defined in config.zones"
                    )
            for k in list(act.keys()):
                if k.startswith("_"):
                    errors.append(
                        f"roundAction '{phase_name}' action {j}: "
                        f"template key '{k}'"
                    )

    # 7d. Validate blinds structure
    blinds = cfg.get("blinds")
    if blinds:
        if "smallBlind" not in blinds or "bigBlind" not in blinds:
            errors.append("config.blinds must have 'smallBlind' and 'bigBlind'")
        elif blinds.get("smallBlind", 0) >= blinds.get("bigBlind", 0):
            warnings.append("config.blinds: smallBlind should be less than bigBlind")

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
