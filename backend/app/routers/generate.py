"""Card-game blueprint generation router – powered by Perplexity Sonar."""

import json
import os

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter(tags=["generate"])

# ---------------------------------------------------------------------------
# Prompt
# ---------------------------------------------------------------------------
SYSTEM_PROMPT = """\
You are an expert card-game designer and game-systems architect. Given a design \
prompt, generate a COMPLETE game blueprint as valid JSON (no markdown, no code \
fences, just raw JSON) matching this exact schema:

{
  "game": {
    "game_id": "string (kebab-case, e.g. 'exploding-kittens-remix')",
    "name": "string",
    "description": "string (2-3 sentences)",
    "player_config": { "min_players": int, "max_players": int },
    "information_model": {
      "randomness_model": "string (e.g. 'deterministic seed')",
      "public_knowledge_rules": ["string"]
    }
  },
  "setup": {
    "deck_compositions": [
      {
        "deck_name": "string",
        "card_pool": [{ "card_id": "string", "count": int }],
        "shuffle_policy": "string"
      }
    ],
    "player_initialization": {
      "initial_hand_size": int,
      "hand_composition": "string",
      "starting_attributes": { "key": 0 }
    },
    "starting_turn": {
      "starting_player_rule": "string",
      "initial_turn_direction": "string",
      "pre_game_actions": ["string"]
    },
    "zone_initialization": [
      {
        "zone_id": "string",
        "zone_type": "string (deck|discard|hand|play|custom)",
        "owner": "string (global|player)",
        "initial_cards": "string describing initial placement"
      }
    ]
  },
  "turn_model": {
    "turn_order": {
      "direction": "string",
      "reverse_handling": "string",
      "extra_turn_rule": "string",
      "skip_rule": "string"
    },
    "action_policy": {
      "max_actions_per_turn": int,
      "forced_actions": ["string"],
      "draw_requirement_timing": "string",
      "end_of_turn_validation": "string"
    },
    "interrupt_policy": {
      "interrupt_allowed": bool,
      "who_can_react": "string (any|target|next_player)",
      "reaction_time_limit": int
    },
    "timeout_policy": {
      "per_turn_timer": int,
      "per_reaction_timer": int,
      "auto_resolve_behavior": "string"
    }
  },
  "cards": [
    {
      "card_id": "string (kebab-case)",
      "display_name": "string",
      "category": "string",
      "rule_description": "string",
      "art_prompt": "string (vivid, concise for image gen)",
      "count": int,
      "visibility": {
        "default_visibility": "string (public|private|hidden)",
        "reveal_conditions": ["string"]
      },
      "play_timing": {
        "own_turn_only": bool,
        "any_turn": bool,
        "reaction_only": bool,
        "end_of_turn_triggered": bool
      },
      "play_conditions": {
        "state_conditions": ["string"],
        "target_requirements": ["string"],
        "zone_requirements": ["string"],
        "stack_requirements": ["string"]
      },
      "effects": {
        "primary_effects": ["string"],
        "secondary_effects": ["string"],
        "triggered_effects": ["string"],
        "passive_effects": ["string"],
        "ongoing_effects": ["string"]
      },
      "stack_behavior": {
        "can_stack": bool,
        "cancels_previous": bool,
        "can_be_revoked": bool,
        "requires_target_confirmation": bool
      },
      "lifecycle": "string (instant|persistent|delayed|conditional_expiry)"
    }
  ],
  "rules": [
    {
      "rule_id": "string (kebab-case)",
      "name": "string",
      "rule_type": "string (match_validation|forced_draw|hand_limit|deck_exhaustion|elimination|turn_transition|simultaneous_effect)",
      "trigger_condition": "string",
      "validation_logic": "string",
      "resulting_effect": "string",
      "priority_level": int,
      "conflict_resolution": "string",
      "override_capability": bool
    }
  ],
  "win_loss": {
    "victory_conditions": [{ "type": "string", "description": "string" }],
    "loss_conditions": [{ "type": "string", "description": "string" }],
    "tie_handling": { "strategy": "string", "description": "string" }
  }
}

Design guidelines:
- Make the game fun, balanced, and mechanically interesting.
- Card counts across card_pool entries should be consistent with the cards array.
- Every card_id referenced in setup.deck_compositions.card_pool must exist in cards.
- Each card must have clear, distinct effects and well-defined play timing.
- art_prompt should be vivid enough for an image generator.
- Rules should cover edge cases (deck exhaustion, hand limits, etc.).
- If the user references an existing game, use it as inspiration but add a unique twist.
- Focus on card games (Exploding Kittens, UNO, etc.).

CRITICAL RULES:
- Return ONLY the raw JSON object. No text before or after. No explanations, \
no citations, no markdown. Start with { and end with }.
- Keep string values CONCISE (1-2 sentences max). Do not write paragraphs.
- Limit to 6-10 card types. Do not generate excessive cards.
- Limit to 4-6 global rules.
- Keep effect arrays to 1-3 items each, not more."""


# ---------------------------------------------------------------------------
# Request / Response models (lightweight — we validate structure, not every field)
# ---------------------------------------------------------------------------
class GenerateRequest(BaseModel):
    prompt: str


class GenerateResponse(BaseModel):
    game: dict
    setup: dict
    turn_model: dict
    cards: list[dict]
    rules: list[dict]
    win_loss: dict


# ---------------------------------------------------------------------------
# Endpoint
# ---------------------------------------------------------------------------
@router.post("/generate", response_model=GenerateResponse)
async def generate_game(body: GenerateRequest):
    """Accept a design prompt and return a complete game blueprint."""

    if not body.prompt or not body.prompt.strip():
        raise HTTPException(status_code=400, detail="Prompt cannot be empty.")

    import openai

    api_key = os.environ.get("PERPLEXITY_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="Perplexity API key is not configured.")

    client = openai.OpenAI(
        api_key=api_key,
        base_url="https://api.perplexity.ai",
    )

    try:
        response = client.chat.completions.create(
            model="sonar-pro",
            max_tokens=16384,
            temperature=0.7,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": body.prompt},
            ],
        )
    except openai.APIError as exc:
        raise HTTPException(status_code=502, detail=f"Perplexity API error: {exc}")

    raw = response.choices[0].message.content.strip()

    # Strip markdown code fences if the model wraps the JSON
    if raw.startswith("```"):
        raw = raw.split("\n", 1)[1] if "\n" in raw else raw[3:]
        if raw.endswith("```"):
            raw = raw[:-3]
        raw = raw.strip()

    # Perplexity often adds citations or text before/after the JSON.
    # Extract the first complete JSON object from the response.
    import re
    if not raw.startswith("{"):
        match = re.search(r"\{", raw)
        if match:
            raw = raw[match.start():]

    # Find the matching closing brace by counting braces
    depth = 0
    end_pos = -1
    in_string = False
    escape = False
    for i, ch in enumerate(raw):
        if escape:
            escape = False
            continue
        if ch == "\\":
            escape = True
            continue
        if ch == '"' and not escape:
            in_string = not in_string
            continue
        if in_string:
            continue
        if ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                end_pos = i
                break
    if end_pos > 0:
        raw = raw[: end_pos + 1]

    try:
        data = json.loads(raw)
    except json.JSONDecodeError as exc:
        # Log first 500 chars so we can debug
        preview = raw[:500] if raw else "(empty)"
        print(f"[generate] JSON parse failed: {exc}")
        print(f"[generate] Raw response preview: {preview}")
        raise HTTPException(
            status_code=502,
            detail=f"AI returned invalid JSON: {exc}. Preview: {preview[:200]}",
        )

    # Validate top-level keys exist
    required = {"game", "setup", "turn_model", "cards", "rules", "win_loss"}
    missing = required - set(data.keys())
    if missing:
        raise HTTPException(
            status_code=502,
            detail=f"AI response missing sections: {', '.join(missing)}. Please try again.",
        )

    try:
        return GenerateResponse(**data)
    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Schema validation error: {exc}",
        )
