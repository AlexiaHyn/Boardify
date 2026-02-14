"""Card-game generation router – powered by GPT-4o."""

import json
import os

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter(tags=["generate"])

# ---------------------------------------------------------------------------
# Prompt
# ---------------------------------------------------------------------------
SYSTEM_PROMPT = """\
You are an expert card-game designer. Given a design prompt from the user, \
generate a complete, playable card game. Return your response as valid JSON \
matching this exact schema (no markdown, no code fences, just raw JSON):

{
  "name": "string — the name of the game",
  "tagline": "string — a one-sentence hook",
  "player_count": {"min": int, "max": int},
  "overview": "string — 2-3 sentence summary of the game concept",
  "components": {
    "description": "string — what physical pieces are needed",
    "total_cards": int
  },
  "card_types": [
    {
      "name": "string — card type name (e.g. 'Exploding Kitten')",
      "count": int,
      "description": "string — what this card does",
      "art_prompt": "string — a short visual description for generating card art"
    }
  ],
  "setup": ["string — step-by-step setup instructions"],
  "rules": {
    "turn_structure": ["string — what happens on each turn, in order"],
    "winning_condition": "string — how you win",
    "special_rules": ["string — any additional rules or edge cases"]
  }
}

Design guidelines:
- Make the game fun, balanced, and easy to learn.
- Card counts should add up to components.total_cards.
- Each card_type must have a clear, distinct mechanical purpose.
- art_prompt should be concise but vivid enough for an image generator.
- If the user references an existing game, use it as inspiration but create \
something original with a unique twist.
- Focus on card games (like Exploding Kittens, UNO, etc.)."""


# ---------------------------------------------------------------------------
# Request / Response models
# ---------------------------------------------------------------------------
class GenerateRequest(BaseModel):
    """Design prompt from the user."""
    prompt: str


class CardType(BaseModel):
    name: str
    count: int
    description: str
    art_prompt: str


class Components(BaseModel):
    description: str
    total_cards: int


class PlayerCount(BaseModel):
    min: int
    max: int


class Rules(BaseModel):
    turn_structure: list[str]
    winning_condition: str
    special_rules: list[str]


class GenerateResponse(BaseModel):
    name: str
    tagline: str
    player_count: PlayerCount
    overview: str
    components: Components
    card_types: list[CardType]
    setup: list[str]
    rules: Rules


# ---------------------------------------------------------------------------
# Endpoint
# ---------------------------------------------------------------------------
@router.post("/generate", response_model=GenerateResponse)
async def generate_game(body: GenerateRequest):
    """Accept a design prompt and return a complete card game definition."""

    if not body.prompt or not body.prompt.strip():
        raise HTTPException(status_code=400, detail="Prompt cannot be empty.")

    import openai

    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="OpenAI API key is not configured.")

    client = openai.OpenAI(api_key=api_key)

    try:
        response = client.chat.completions.create(
            model="gpt-4o",
            max_tokens=4096,
            temperature=0.8,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": body.prompt},
            ],
        )
    except openai.APIError as exc:
        raise HTTPException(status_code=502, detail=f"OpenAI API error: {exc}")

    raw = response.choices[0].message.content.strip()

    # Strip markdown code fences if the model wraps the JSON
    if raw.startswith("```"):
        raw = raw.split("\n", 1)[1] if "\n" in raw else raw[3:]
        if raw.endswith("```"):
            raw = raw[:-3]
        raw = raw.strip()

    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        raise HTTPException(
            status_code=502,
            detail="AI returned invalid JSON. Please try again.",
        )

    try:
        return GenerateResponse(**data)
    except Exception:
        raise HTTPException(
            status_code=502,
            detail="AI response did not match the expected schema. Please try again.",
        )
