---
name: DSL Pipeline Generalization
overview: Build Pydantic models that validate the card game DSL, prompt templates for Perplexity research and DSL generation via OpenAI Codex 5.3 High, and a pipeline that chains research -> generation -> validation with retry. Late stage (future) pipes validated DSL into Claude for code generation against a templated board game webapp.
todos:
    - id: pydantic-schemas
      content: "Build Pydantic models: primitives.py, operations.py (~24 op types with discriminated union including peek, insert_at, choose_player, eliminate_player, choose_from_zone), components.py (Zone with on_draw triggers), actions.py (Action with reaction_window, card_count, card_match_rule, any_phase, nullable max_per_turn), game.py with cross-reference validators, and verify uno.json validates against GameSchema"
      status: pending
    - id: prompt-templates
      content: "Write prompt templates for Codex 5.3 High: Perplexity research prompt (structured sections mapping to DSL including INTERRUPT/REACTION MECHANICS and COMBO/MULTI-CARD PLAY sections), two-phase generation prompts (plan then JSON), and retry prompt with validation error feedback"
      status: pending
    - id: pipeline-impl
      content: "Implement pipeline: research.py (Perplexity Sonar call), generate.py (Codex 5.3 High plan + DSL generation + Pydantic validation retry loop), orchestrator.py (chains all steps, SSE streaming)"
      status: pending
    - id: api-endpoint
      content: "Add POST /api/v1/generate endpoint with SSE streaming: accepts game name, streams stage progress, returns validated GameSchema JSON. Add GET /api/v1/generate/{job_id} for status polling fallback."
      status: pending
    - id: validate-examples
      content: "Validate the pipeline by running it on 3-4 diverse games: Uno (static validation), Exploding Kittens (interrupts, combos, elimination), Poker (betting, hand eval), Go Fish (player targeting, set collection)"
      status: pending
isProject: false
---

# Boardify DSL Pipeline for Generalized Card Games

## Architecture Overview

The pipeline has 4 stages. Stages 1-3 are implemented now. Stage 4 is a future late-stage where Claude generates code against the templated webapp.

```mermaid
flowchart TB
    subgraph stage1 [Stage 1: Research]
        A[User Input: game name] --> B[Perplexity Sonar]
        B --> C[Structured rules document]
    end

    subgraph stage2 [Stage 2: DSL Generation]
        C --> D[Codex 5.3 High: game plan]
        D --> E[Codex 5.3 High: DSL JSON]
    end

    subgraph stage3 [Stage 3: Validation]
        E --> F{Pydantic validates?}
        F -->|fail| G[Feed errors back to Codex]
        G --> E
        F -->|pass| H[Valid GameSchema JSON]
    end

    subgraph stage4 [Stage 4: Code Gen -- FUTURE]
        H --> I[Claude: reads DSL + template webapp]
        I --> J[Modified game instance]
        J --> K[Playable webapp with WebSockets]
    end
```

### Provider roles

- **Perplexity Sonar** -- web search for authoritative game rules (Stage 1)
- **OpenAI Codex 5.3 High** -- DSL plan generation and JSON schema output (Stage 2), retry corrections (Stage 3)
- **Claude** -- code generation against the templated board game webapp (Stage 4, future). Receives the validated DSL JSON + the template app source and produces a modified game instance with all components, game logic, and WebSocket event handlers wired up.

### Stage 4 design notes (future, not implemented now)

The templated board game webapp already has:

- WebSocket infrastructure for real-time multiplayer
- Generic UI components (card rendering, zones, player panels, action buttons)
- Game state management shell

Claude's job in Stage 4 will be to take the validated `GameSchema` JSON and:

1. Wire deck_manifest into the card rendering system
2. Map zones to the zone layout components
3. Implement the FSM (turn phases, routines) as game state transitions
4. Bind actions to UI event handlers (click_card, click_zone, click_button, reaction)
5. Implement card_effects as post-play hooks
6. Handle reaction_windows as interrupt UI flows
7. Connect everything to the WebSocket event system

This stage will be a separate pipeline step with its own prompt template that includes the DSL JSON and key template webapp source files as context.

### Core insight for generalization

**The Pydantic schema IS the prompt.** When you call `GameSchema.model_json_schema()`, it produces a JSON Schema with all your `Field(description=...)` annotations baked in. This schema gets passed directly to Codex 5.3 High as its output format constraint. Every description you write on a Pydantic field becomes documentation the LLM reads.

---

## 1. Pydantic Schema Design (the "generalization grammar")

### File structure

```
backend/app/schemas/
    primitives.py    # ValueRef, Condition, PlayerCount
    operations.py    # All op types + Operation discriminated union
    components.py    # Zone, DeckManifestEntry, CardEffect, Variables
    actions.py       # Action (with reaction_window, combos), FSM
    game.py          # GameSchema (top-level)
    __init__.py      # Re-exports GameSchema
```

### Key technique: Discriminated unions for operations

The `op` field is the discriminator. Each operation gets its own model with a `Literal` op type, so the LLM knows exactly which fields belong to which operation:

```python
from typing import Annotated, Literal, Union
from pydantic import BaseModel, Field

class MoveOp(BaseModel):
    op: Literal["move"] = "move"
    entity: str | None = Field(None, description="Card ref like '$card'. Omit when using from+count.")
    from_: str | None = Field(None, alias="from", description="Source zone name, e.g. 'draw_pile', or '$args.target_player.hand' for stealing")
    to: str = Field(..., description="Dest zone or '$player.hand'")
    count: int | str | None = Field(None, description="Cards to move. Int or '$global.stack_penalty'")
    random: bool = Field(False, description="If true, pick card(s) randomly from source (for stealing)")
    store_as: str | None = Field(None, description="Store moved card(s) in $args.{name}")

class BranchOp(BaseModel):
    op: Literal["branch"] = "branch"
    condition: "Condition" = Field(..., description="Boolean condition tree")
    if_true: list["Operation"] = Field(..., description="Sequence when true")
    if_false: list["Operation"] = Field(default_factory=list, description="Sequence when false")

# ... ~24 total op types

Operation = Annotated[
    Union[MoveOp, ShuffleOp, DealOp, BranchOp, SetGlobalOp, ...],
    Field(discriminator="op")
]
```

### Complete operation set (~24 ops)

**Core ops (from Uno DSL):**

- `spawn_from_manifest` -- create cards from deck manifest templates
- `shuffle` -- randomize a zone
- `deal` -- distribute cards to all players
- `move` -- move card(s) between zones (now with `random` flag for stealing)
- `move_all_except_top` -- recycle zone leaving top card
- `set_global` -- set a global variable
- `set_player_var` -- set a per-player variable
- `mutate_global` -- arithmetic mutation (add, negate, multiply)
- `branch` -- conditional if/else with nested sequences
- `advance_turn` -- move to next player (skips eliminated players)
- `transition_phase` -- change FSM phase
- `trigger_routine` -- call a named routine
- `prompt` -- ask player to choose from options (color pick, etc.)
- `game_over` -- end game with winner
- `log` -- debug/UI message

**Broad card game ops (Poker, Rummy, Go Fish, War):**

- `reveal` -- flip hidden cards face-up
- `evaluate_hand` -- rank a hand by rule set (poker_standard, rummy_sets_runs)
- `compare_hands` -- compare two hands and branch on winner
- `add_score` -- add/subtract points per player
- `collect_to_pot` / `award_pot` -- betting mechanics
- `for_each_player` -- iterate over all players with a sequence
- `check_group` -- test if cards form a valid set/run

**Exploding Kittens ops (interrupts, targeting, elimination):**

- `**peek**` -- view top N cards of a zone without moving them (See the Future)
- `**insert_at**` -- insert a card at a player-chosen position in a zone (Defuse mechanic)
- `**choose_player**` -- prompt player to select a target, store as `$args.{name}` (Favor, cat combos)
- `**eliminate_player**` -- remove player from game, skip in turn order (Exploding Kitten death)
- `**choose_from_zone**` -- pick a specific card from a visible zone (5-different cat combo picking from discard)

### Exploding Kittens gap analysis -- why these ops are needed

| Mechanic                            | DSL Gap                    | Solution                                                               |
| ----------------------------------- | -------------------------- | ---------------------------------------------------------------------- |
| **Nope (interrupt)**                | No out-of-turn play        | `reaction_window` on Action + `any_phase` flag                         |
| **See the Future**                  | No peek without moving     | `peek` op                                                              |
| **Defuse + reinsert**               | `move` always goes to top  | `insert_at` op with `position: "player_choice"`                        |
| **Favor (give card)**               | No targeting other players | `choose_player` op + `prompt` with `player: "$args.target"`            |
| **Cat combo (steal)**               | No random steal            | `move` with `random: true` + `from: "$args.target.hand"`               |
| **3-of-a-kind (named steal)**       | No named card steal        | `prompt` (name a card) + `branch` (has it?) + `move`                   |
| **5-different (pick from discard)** | No browsing a zone         | `choose_from_zone` op                                                  |
| **Exploding Kitten (death)**        | No player elimination      | `eliminate_player` op                                                  |
| **Attack (multi-turn)**             | No turn count modification | `turns_remaining` per-player var + `mutate_player_var` op              |
| **Free play phase**                 | `max_per_turn: 1` forced   | `max_per_turn: null` (nullable int)                                    |
| **Multi-card combos**               | Single-card actions only   | `card_count` + `card_match_rule` on Action                             |
| **Draw triggers**                   | No on-draw event           | `on_draw` trigger in Zone config or `branch` after `move` + `store_as` |

### FSM / Action extensions for interrupt games

```python
class ReactionWindow(BaseModel):
    """After this action resolves, other players may play reaction cards."""
    eligible_card_type: str = Field(..., description="Card type that can react, e.g. 'nope'")
    allows_chain: bool = Field(True, description="Can reactions be reacted to? (Nope the Nope)")
    timeout_seconds: int | None = Field(None, description="Seconds before window closes. null=until all pass")

class Action(BaseModel):
    phase: str | list[str] = Field(..., description="Phase(s) when this action is available")
    trigger: str = Field(..., description="UI trigger: click_card, click_zone, click_button, reaction")
    source_zone: str | None = Field(None)
    mutex_group: str | None = Field(None)
    max_per_turn: int | None = Field(None, description="Max times per turn. null=unlimited (free play). 1=once.")
    card_count: int = Field(1, description="Cards required for this action. 2 for two-of-a-kind combo, 3 for three-of-a-kind, 5 for five-different.")
    card_match_rule: str | None = Field(None, description="'same_type' for matching combos, 'all_different' for 5-different combo, null for single card")
    any_phase: bool = Field(False, description="If true, can be played outside normal turn order (interrupt/reaction cards like Nope)")
    reaction_window: ReactionWindow | None = Field(None, description="If set, after this action, other players get a chance to react (e.g. play Nope)")
    conditions: list["Condition"] = Field(default_factory=list)
    sequence: list["Operation"] = Field(...)
    ui_label: str | None = Field(None, description="Button label for click_button triggers")
```

### Zone extensions for draw triggers

```python
class Zone(BaseModel):
    behavior: str = Field(..., description="stack, hand_fan, spread, grid")
    visibility: str = Field(..., description="hidden, top_only, owner_only, all")
    per_player: bool = Field(False)
    on_empty: OnEmpty | None = Field(None, description="What happens when zone is empty")
    on_draw: list["Operation"] | None = Field(None, description="Sequence triggered after a card is drawn from this zone. Use $args.drawn_card to reference the drawn card. Example: check if drawn card is Exploding Kitten.")
```

### Condition tree (recursive, composable)

```python
class LeafCondition(BaseModel):
    op: Literal["eq", "neq", "gt", "lt", "gte", "lte"]
    val1: str | int | float | bool | None = Field(..., description="Left operand. Use '$global.x', '$player.x', '$card.data.y', '$args.target.hand.count', etc.")
    val2: str | int | float | bool | None = Field(..., description="Right operand")

class CompoundCondition(BaseModel):
    op: Literal["and", "or"]
    args: list["Condition"] = Field(..., min_length=2)

class NotCondition(BaseModel):
    op: Literal["not"]
    arg: "Condition"

class HasMatchingCondition(BaseModel):
    """Check if a zone has N cards matching a field value. Used for combo validation."""
    op: Literal["has_matching"]
    zone: str = Field(..., description="Zone to search, e.g. '$player.hand'")
    field: str = Field(..., description="Card data field to match on, e.g. 'data.type'")
    count: int = Field(..., description="Minimum number of matching cards required")

class PlayerAliveCondition(BaseModel):
    """Check if a player is still in the game."""
    op: Literal["is_alive"]
    player: str = Field(..., description="Player reference, e.g. '$current_player' or '$args.target'")

Condition = Union[LeafCondition, CompoundCondition, NotCondition, HasMatchingCondition, PlayerAliveCondition]
```

### $-Reference extensions for Exploding Kittens

New reference paths beyond what Uno uses:

- `$args.target_player` -- player ref stored by `choose_player`
- `$args.target_player.hand` -- target player's hand zone (for steal moves)
- `$args.drawn_card` -- card just drawn (for on_draw triggers)
- `$args.drawn_card.data.type` -- type of drawn card (branch on "exploding_kitten")
- `$player.is_alive` -- elimination check
- `$player.turns_remaining` -- multi-turn tracking (Attack card)

### Exploding Kittens DSL sketch (key fragments)

Setup deals Defuse to each player, then inserts Exploding Kittens into deck:

```json
{
	"setup": [
		{
			"op": "spawn_from_manifest",
			"manifest": "base_deck",
			"dest": "draw_pile"
		},
		{
			"op": "deal",
			"from": "draw_pile",
			"count": 1,
			"to": "all_players",
			"filter": { "data.type": "defuse" }
		},
		{ "op": "deal", "from": "draw_pile", "count": 7, "to": "all_players" },
		{
			"op": "spawn_from_manifest",
			"manifest": "exploding_kittens",
			"dest": "draw_pile"
		},
		{ "op": "shuffle", "zone": "draw_pile" }
	]
}
```

Draw triggers Exploding Kitten check:

```json
{
	"draw_card": {
		"phase": "must_draw",
		"trigger": "click_zone",
		"source_zone": "draw_pile",
		"max_per_turn": 1,
		"sequence": [
			{
				"op": "move",
				"from": "draw_pile",
				"count": 1,
				"to": "$player.hand",
				"store_as": "drawn_card"
			},
			{
				"op": "branch",
				"condition": {
					"op": "eq",
					"val1": "$args.drawn_card.data.type",
					"val2": "exploding_kitten"
				},
				"if_true": [
					{
						"op": "branch",
						"condition": {
							"op": "has_matching",
							"zone": "$player.hand",
							"field": "data.type",
							"count": 1
						},
						"if_true": [
							{
								"op": "move",
								"entity": "$player.hand.find(data.type=defuse)",
								"to": "discard_pile"
							},
							{
								"op": "insert_at",
								"entity": "$args.drawn_card",
								"zone": "draw_pile",
								"position": "player_choice"
							}
						],
						"if_false": [
							{
								"op": "eliminate_player",
								"player": "$current_player"
							},
							{
								"op": "move",
								"entity": "$args.drawn_card",
								"to": "discard_pile"
							}
						]
					}
				],
				"if_false": [{ "op": "transition_phase", "to": "turn_end" }]
			}
		]
	}
}
```

Nope as an interrupt action:

```json
{
	"play_nope": {
		"any_phase": true,
		"trigger": "reaction",
		"source_zone": "player_hand",
		"conditions": [
			{ "op": "eq", "val1": "$card.data.type", "val2": "nope" }
		],
		"reaction_window": {
			"eligible_card_type": "nope",
			"allows_chain": true
		},
		"sequence": [
			{ "op": "move", "entity": "$card", "to": "discard_pile" },
			{ "op": "log", "message": "NOPED!" }
		]
	}
}
```

Two-of-a-kind cat combo (steal random):

```json
{
	"two_of_a_kind": {
		"phase": "play_cards",
		"trigger": "click_card",
		"source_zone": "player_hand",
		"card_count": 2,
		"card_match_rule": "same_type",
		"max_per_turn": null,
		"reaction_window": {
			"eligible_card_type": "nope",
			"allows_chain": true
		},
		"sequence": [
			{ "op": "move", "entity": "$cards", "to": "discard_pile" },
			{
				"op": "choose_player",
				"player": "$current_player",
				"message": "Steal from whom?",
				"exclude_self": true,
				"store_as": "target_player"
			},
			{
				"op": "move",
				"from": "$args.target_player.hand",
				"to": "$player.hand",
				"count": 1,
				"random": true
			}
		]
	}
}
```

### Cross-reference validators

Add model-level validators on `GameSchema` that check semantic correctness -- zone names in operations actually exist in `zones`, variable keys in `set_global` exist in `variables.global`, etc. This catches errors that JSON Schema alone cannot:

```python
class GameSchema(BaseModel):
    # ... fields ...

    @model_validator(mode="after")
    def validate_zone_references(self) -> "GameSchema":
        zone_names = set(self.zones.keys())
        # Walk all operations in FSM routines and actions,
        # check that zone refs like "draw_pile" exist in zone_names
        ...
        return self

    @model_validator(mode="after")
    def validate_reaction_windows(self) -> "GameSchema":
        # If any action has reaction_window, verify there exists
        # an action with any_phase=True that can respond
        ...
        return self
```

---

## 2. Orchestration Endpoint and Sequence Diagram

### Sequence diagram -- full pipeline

```mermaid
sequenceDiagram
    participant Client
    participant API as FastAPI Backend
    participant PX as Perplexity Sonar
    participant Codex as Codex 5.3 High
    participant Val as Pydantic Validator
    participant Claude as Claude Code -- FUTURE

    Client->>API: POST /api/v1/generate {game_name}
    API-->>Client: SSE stream opened

    Note over API: Stage 1 -- Research
    API-->>Client: event: stage {stage: "research", status: "started"}
    API->>PX: system + user prompt with game_name
    PX-->>API: structured rules document
    API-->>Client: event: stage {stage: "research", status: "done"}

    Note over API: Stage 2a -- Game Plan
    API-->>Client: event: stage {stage: "plan", status: "started"}
    API->>Codex: PLAN_SYSTEM + PLAN_USER with research output
    Codex-->>API: natural language game plan
    API-->>Client: event: stage {stage: "plan", status: "done"}

    Note over API: Stage 2b -- DSL JSON
    API-->>Client: event: stage {stage: "dsl", status: "started"}
    API->>Codex: DSL_SYSTEM + DSL_USER with plan + JSON schema + uno example
    Codex-->>API: raw JSON string
    API-->>Client: event: stage {stage: "dsl", status: "done"}

    Note over API: Stage 3 -- Validate + Retry
    API-->>Client: event: stage {stage: "validation", status: "started"}
    API->>Val: GameSchema.model_validate_json(raw_json)

    alt Validation passes
        Val-->>API: GameSchema instance
        API-->>Client: event: stage {stage: "validation", status: "done"}
    else Validation fails (up to 3 retries)
        Val-->>API: ValidationError
        API-->>Client: event: stage {stage: "validation", status: "retry", attempt: 1}
        API->>Codex: RETRY prompt with validation errors
        Codex-->>API: corrected JSON
        API->>Val: re-validate
        Val-->>API: GameSchema instance
        API-->>Client: event: stage {stage: "validation", status: "done"}
    end

    API-->>Client: event: result {dsl: GameSchema JSON}
    API-->>Client: SSE stream closed

    Note over Client,Claude: Stage 4 -- FUTURE
    Client->>API: POST /api/v1/codegen {dsl_json, template_id}
    API->>Claude: DSL JSON + template webapp source files
    Claude-->>API: modified game source code
    API-->>Client: game instance files / deployment URL
```

### Orchestration endpoint -- request/response models

File: `backend/app/routers/generate.py`

```python
from pydantic import BaseModel, Field
from enum import Enum

class GenerateRequest(BaseModel):
    game_name: str = Field(..., description="Name of the card game, e.g. 'Exploding Kittens'")
    player_count: int | None = Field(None, description="Override player count for dynamic deck sizing")

class StageStatus(str, Enum):
    started = "started"
    done = "done"
    retry = "retry"
    error = "error"

class StageEvent(BaseModel):
    """SSE event sent during pipeline execution."""
    stage: str  # "research" | "plan" | "dsl" | "validation"
    status: StageStatus
    attempt: int | None = None  # for retry events
    detail: str | None = None   # human-readable progress message
    elapsed_ms: int | None = None

class GenerateResult(BaseModel):
    """Final SSE event with the validated DSL."""
    game_name: str
    dsl: dict  # The validated GameSchema as JSON
    research_summary: str | None = None  # condensed rules for debugging
    stages_elapsed_ms: dict[str, int]  # timing per stage

# Future Stage 4 endpoint (stub)
class CodegenRequest(BaseModel):
    dsl_json: dict = Field(..., description="Validated GameSchema JSON from /generate")
    template_id: str = Field("default", description="Which template webapp to use")

class CodegenResult(BaseModel):
    game_id: str
    files_modified: list[str]
    preview_url: str | None = None
```

### Orchestration endpoint -- SSE streaming implementation

```python
from fastapi import APIRouter
from fastapi.responses import StreamingResponse
import json, time

router = APIRouter(prefix="/generate", tags=["generate"])

@router.post("")
async def generate_game(request: GenerateRequest):
    """Generate a game DSL via SSE-streamed pipeline."""

    async def event_stream():
        t0 = time.monotonic()
        timings = {}

        # --- Stage 1: Research ---
        yield sse_event("stage", {"stage": "research", "status": "started"})
        t1 = time.monotonic()
        research = await research_game(request.game_name)
        timings["research"] = int((time.monotonic() - t1) * 1000)
        yield sse_event("stage", {"stage": "research", "status": "done", "elapsed_ms": timings["research"]})

        # --- Stage 2a: Game Plan ---
        yield sse_event("stage", {"stage": "plan", "status": "started"})
        t2 = time.monotonic()
        plan = await generate_game_plan(research)
        timings["plan"] = int((time.monotonic() - t2) * 1000)
        yield sse_event("stage", {"stage": "plan", "status": "done", "elapsed_ms": timings["plan"]})

        # --- Stage 2b: DSL JSON ---
        yield sse_event("stage", {"stage": "dsl", "status": "started"})
        t3 = time.monotonic()
        json_schema = GameSchema.model_json_schema()
        uno_example = load_example("uno.json")
        raw_json = await generate_dsl_json(plan, json_schema, uno_example)
        timings["dsl"] = int((time.monotonic() - t3) * 1000)
        yield sse_event("stage", {"stage": "dsl", "status": "done", "elapsed_ms": timings["dsl"]})

        # --- Stage 3: Validate + Retry ---
        yield sse_event("stage", {"stage": "validation", "status": "started"})
        t4 = time.monotonic()
        max_retries = settings.PIPELINE_MAX_RETRIES
        schema = None
        for attempt in range(max_retries):
            try:
                schema = GameSchema.model_validate_json(raw_json)
                break
            except ValidationError as e:
                if attempt == max_retries - 1:
                    yield sse_event("stage", {"stage": "validation", "status": "error", "detail": str(e)})
                    yield sse_event("error", {"message": f"Validation failed after {max_retries} retries"})
                    return
                yield sse_event("stage", {"stage": "validation", "status": "retry", "attempt": attempt + 1})
                raw_json = await retry_with_errors(raw_json, str(e))

        timings["validation"] = int((time.monotonic() - t4) * 1000)
        yield sse_event("stage", {"stage": "validation", "status": "done", "elapsed_ms": timings["validation"]})

        # --- Final result ---
        yield sse_event("result", {
            "game_name": request.game_name,
            "dsl": schema.model_dump(by_alias=True),
            "stages_elapsed_ms": timings,
        })

    return StreamingResponse(event_stream(), media_type="text/event-stream")


def sse_event(event_type: str, data: dict) -> str:
    return f"event: {event_type}\ndata: {json.dumps(data)}\n\n"
```

### Polling fallback (for clients that cannot use SSE)

```python
# In-memory job store (swap for Redis in production)
_jobs: dict[str, dict] = {}

@router.post("/async")
async def generate_game_async(request: GenerateRequest):
    """Start pipeline as background task, return job_id for polling."""
    job_id = str(uuid.uuid4())
    _jobs[job_id] = {"status": "running", "stage": "research", "result": None}
    background_tasks.add_task(run_pipeline, job_id, request)
    return {"job_id": job_id}

@router.get("/{job_id}")
async def get_job_status(job_id: str):
    """Poll pipeline progress."""
    job = _jobs.get(job_id)
    if not job:
        raise HTTPException(404, "Job not found")
    return job
```

---

## 3. Prompt Templates

### Stage 1: Perplexity Sonar -- Structured Rules Research

The key here is asking Perplexity for output in **sections that map 1:1 to DSL sections**. This makes the LLM's job in Stage 2 much easier. Sections now include interrupt mechanics and combos.

File: `backend/app/pipeline/prompts/research.py`

```python
RESEARCH_SYSTEM = """You are a board game rules researcher. Extract COMPLETE, PRECISE rules.
Do NOT summarize or simplify. Include exact card counts, exact turn sequences, and all edge cases."""

RESEARCH_USER = """Research the card game "{game_name}" and provide COMPLETE rules in these exact sections:

## DECK COMPOSITION
- Every distinct card type
- Exact count of each type
- Card properties (suit, color, rank, value, special attributes)
- Cards with dynamic count based on player number (e.g. Exploding Kittens = players - 1)

## GAME ZONES
- All areas where cards exist (draw pile, discard pile, hands, melds, community cards, pot, etc.)
- How many cards are visible in each zone and to whom
- What happens when a zone is empty

## TURN STRUCTURE
- List every phase of a turn in order
- What the active player MUST do and what they MAY do in each phase
- Can multiple cards be played per turn? Is there a mandatory action (e.g. must draw)?

## CARD EFFECTS
- What happens when each card type is played/revealed
- Special interactions between card types
- Cards that trigger on DRAW rather than on PLAY

## COMBO / MULTI-CARD PLAYS
- Can multiple cards be played together as a combo?
- What combinations are valid (pairs, triples, N-of-a-kind, N-different)?
- What does each combo do?

## INTERRUPT / REACTION MECHANICS
- Can any card be played OUT OF TURN to cancel or counter another card?
- Can interrupts be chained (e.g. counter the counter)?
- What is the timing window for reactions?

## PLAYER TARGETING
- Do any cards require choosing another player as a target?
- What happens when a player is targeted? (steal, give, reveal, etc.)

## PLAYER ELIMINATION
- Can players be eliminated mid-game?
- What triggers elimination?
- How does the game handle eliminated players (turn order, win condition)?

## WIN CONDITION
- How the game ends
- How the winner is determined (last alive, highest score, empty hand, etc.)
- Scoring rules if applicable

## SPECIAL MECHANICS
- Betting, asking for cards, challenging, slapping, melding, etc.
- Penalty rules
- Any mechanics involving inserting cards at a specific position in a deck

Be exhaustive. Missing a rule means the game will be broken."""
```

### Stage 2: DSL Generation via Codex 5.3 High -- Two-Phase Prompting

This is the most critical prompt. The **two-phase approach** dramatically improves generalization. Both phases use **OpenAI Codex 5.3 High** for its strong structured output and JSON schema adherence.

**Phase 2a**: Generate a "game plan" in natural language first (what zones, what phases, what variables). This forces Codex to reason about game structure before committing to JSON.

**Phase 2b**: Generate the actual DSL JSON from the plan, constrained by the Pydantic JSON Schema passed as `response_format`.

File: `backend/app/pipeline/prompts/generation.py`

```python
# Model: OpenAI Codex 5.3 High (via OpenAI API)
# Use response_format={"type": "json_schema", "json_schema": {...}} for Phase 2b

PLAN_SYSTEM = """You are a game architect designing a data-driven card game engine.
Given researched rules, produce a DESIGN PLAN listing every zone, variable, phase, action, and card effect needed.
Think step by step. Be exhaustive."""

PLAN_USER = """Design a game engine plan for the following card game.

## Researched Rules
{research_output}

Produce a plan with these sections:
1. ZONES: name, behavior (stack/hand_fan/spread/grid), visibility, on_draw triggers
2. VARIABLES: global vars and per-player vars with types and defaults
   - Include turns_remaining (for attack/extra-turn mechanics) and is_alive (for elimination games) if needed
3. DECK MANIFEST: all card templates with template_vars
4. TURN PHASES: ordered list (include free-play phase if players can play multiple cards)
5. ROUTINES: what happens in each phase (pseudocode using move, branch, set_global, etc.)
6. ACTIONS: what the player can do, with conditions
   - For each action: can it be interrupted? (reaction_window)
   - For each action: is it a multi-card combo? (card_count + card_match_rule)
   - For each action: can it be played out of turn? (any_phase)
7. CARD EFFECTS: what each special card does post-play
8. INTERRUPT FLOW: if the game has interrupt/reaction cards, describe the resolution stack"""

DSL_SYSTEM = """You are a JSON code generator. Convert the game plan into a valid game DSL JSON document.

## $-Reference Conventions
- $global.{key} -- read a global variable
- $player.{key} -- read current player's variable
- $card -- the card being acted on (single card actions)
- $cards -- the cards being played (multi-card combo actions)
- $card.data.{field} -- a property of that card
- $zone.{name}.top -- top card of a zone
- $zone.{name}.top.data.{field} -- property of top card
- $player.hand -- current player's hand zone
- $player.hand.count -- card count in hand
- $current_player -- reference to the acting player
- $args.{key} -- value stored earlier via store_as
- $args.target_player -- player chosen by choose_player op
- $args.target_player.hand -- target player's hand zone
- $args.drawn_card -- card stored after a move with store_as
- $args.drawn_card.data.{field} -- property of stored card

## Action Fields
- any_phase: true -- card can be played outside normal turn (Nope-style interrupts)
- reaction_window: {...} -- after this action, other players can react
- card_count: N -- how many cards this action plays (2 for pairs, 3 for triples)
- card_match_rule: "same_type" | "all_different" | null
- max_per_turn: null -- unlimited plays per turn (free play phase)

Output ONLY valid JSON. No markdown, no explanation."""

DSL_USER = """## JSON Schema (your output MUST conform to this)
{json_schema}

## Complete Working Example (Uno)
{uno_example}

## Game Design Plan
{game_plan}

Generate the complete game DSL JSON for this game."""
```

### Stage 3: Retry with Validation Errors (Codex 5.3 High)

When Pydantic rejects the output, feed the exact errors back to Codex:

```python
RETRY_USER = """The JSON you generated failed validation with these errors:

{validation_errors}

Fix ONLY the errors above. Keep everything else the same. Output the complete corrected JSON."""
```

### Stage 4: Claude Code Generation (FUTURE -- not implemented now)

This stage will use Claude to transform the validated DSL into a working game instance by modifying the template webapp. Prompt sketch:

```python
CODEGEN_SYSTEM = """You are modifying a templated multiplayer card game webapp.
The template already has WebSocket infrastructure, generic card/zone/player UI components,
and a game state management shell. Your job is to wire everything up according to the DSL.

Do NOT rewrite the WebSocket layer or generic components. Only modify game-specific files."""

CODEGEN_USER = """## Game DSL (validated schema)
{dsl_json}

## Template files you may modify
{template_file_listing}

## Key template source files
{template_sources}

Wire up the game:
1. Populate deck from deck_manifest
2. Layout zones according to zones config
3. Implement FSM turn phases and routines as state transitions
4. Bind actions to UI event handlers
5. Implement card_effects as post-play hooks
6. Handle reaction_windows as interrupt UI flows (pause, show reaction prompt to other players)
7. Connect all state mutations to WebSocket broadcast

Output the modified files."""
```

---

## 4. Pipeline Orchestrator Implementation

File: `backend/app/pipeline/orchestrator.py`

```python
import json
from typing import Callable
from pydantic import ValidationError

from app.llm import get_model, generate_text_sync
from app.schemas.game import GameSchema
from app.pipeline.prompts.research import RESEARCH_SYSTEM, RESEARCH_USER
from app.pipeline.prompts.generation import (
    PLAN_SYSTEM, PLAN_USER, DSL_SYSTEM, DSL_USER, RETRY_USER,
)


def _load_example(name: str) -> str:
    """Load a reference DSL example from backend/app/examples/."""
    import pathlib
    path = pathlib.Path(__file__).parent.parent / "examples" / name
    return path.read_text()


async def generate_game_dsl(
    game_name: str,
    max_retries: int = 3,
    on_stage: Callable | None = None,
) -> GameSchema:
    """Full pipeline: research -> plan -> DSL -> validate.

    Providers:
      - Perplexity Sonar for Stage 1 (web search)
      - OpenAI Codex 5.3 High for Stages 2-3 (generation + retry)
    """

    perplexity = get_model("perplexity", "sonar")
    codex = get_model("openai", "codex-5.3-high")

    # --- Stage 1: Research via Perplexity Sonar ---
    if on_stage: await on_stage("research", "started")
    research = generate_text_sync(
        perplexity,
        prompt=RESEARCH_USER.format(game_name=game_name),
        system=RESEARCH_SYSTEM,
    ).text
    if on_stage: await on_stage("research", "done")

    # --- Stage 2a: Game plan (natural language reasoning) ---
    if on_stage: await on_stage("plan", "started")
    plan = generate_text_sync(
        codex,
        prompt=PLAN_USER.format(research_output=research),
        system=PLAN_SYSTEM,
    ).text
    if on_stage: await on_stage("plan", "done")

    # --- Stage 2b: DSL JSON (structured output) ---
    if on_stage: await on_stage("dsl", "started")
    json_schema = GameSchema.model_json_schema()
    uno_example = _load_example("uno.json")
    raw_json = generate_text_sync(
        codex,
        prompt=DSL_USER.format(
            json_schema=json.dumps(json_schema, indent=2),
            uno_example=uno_example,
            game_plan=plan,
        ),
        system=DSL_SYSTEM,
        response_format={"type": "json_schema", "json_schema": json_schema},
    ).text
    if on_stage: await on_stage("dsl", "done")

    # --- Stage 3: Validate + retry loop ---
    if on_stage: await on_stage("validation", "started")
    for attempt in range(max_retries):
        try:
            schema = GameSchema.model_validate_json(raw_json)
            if on_stage: await on_stage("validation", "done")
            return schema
        except ValidationError as e:
            if attempt == max_retries - 1:
                raise
            if on_stage: await on_stage("validation", "retry", attempt=attempt + 1)
            raw_json = generate_text_sync(
                codex,
                prompt=RETRY_USER.format(validation_errors=str(e)),
                system=DSL_SYSTEM,
                response_format={"type": "json_schema", "json_schema": json_schema},
            ).text

    # Should not reach here, but satisfy type checker
    raise RuntimeError("Unreachable")
```

### Stage 4 hook (future -- not implemented now)

The orchestrator is designed so Stage 4 can be appended without changing Stages 1-3:

```python
async def generate_game_full(game_name: str) -> dict:
    """Full pipeline including code generation (future Stage 4)."""
    # Stages 1-3: produce validated DSL
    schema = await generate_game_dsl(game_name)

    # Stage 4 (future) -- Claude code generation against template webapp
    # claude = get_model("anthropic", "claude-sonnet-4-20250514")
    # template_files = load_template_webapp_sources()
    # modified_code = generate_text_sync(
    #     claude,
    #     prompt=CODEGEN_USER.format(
    #         dsl_json=schema.model_dump_json(indent=2, by_alias=True),
    #         template_file_listing=list_template_files(),
    #         template_sources=template_files,
    #     ),
    #     system=CODEGEN_SYSTEM,
    # ).text
    # return {"dsl": schema, "code": modified_code}

    return {"dsl": schema}
```

### Why two-phase generation matters for generalization

When you ask Codex to go directly from "Exploding Kittens rules" to a 500-line JSON blob, it often:

- Forgets zones it needs
- Gets the FSM phase order wrong
- Misses edge-case card effects
- Omits the reaction window for Nope cards
- Forgets that draw triggers need to check for Exploding Kittens

The plan phase forces it to explicitly enumerate all components first. The JSON phase then has a concrete blueprint to follow. This is analogous to chain-of-thought prompting but structured for schema generation.

---

## 5. Files to Create/Modify

New files:

- `[backend/app/schemas/primitives.py](backend/app/schemas/primitives.py)` -- ValueRef, Condition (6 types including HasMatchingCondition, PlayerAliveCondition), PlayerCount
- `[backend/app/schemas/operations.py](backend/app/schemas/operations.py)` -- ~24 operation models + Operation discriminated union (including peek, insert_at, choose_player, eliminate_player, choose_from_zone)
- `[backend/app/schemas/components.py](backend/app/schemas/components.py)` -- Zone (with on_draw trigger), DeckManifestEntry, CardEffect, Variables
- `[backend/app/schemas/actions.py](backend/app/schemas/actions.py)` -- Action (with reaction_window, card_count, card_match_rule, any_phase), ReactionWindow, FSM
- `[backend/app/schemas/game.py](backend/app/schemas/game.py)` -- GameSchema with cross-ref validators (including reaction window consistency check)
- `[backend/app/schemas/__init__.py](backend/app/schemas/__init__.py)` -- Re-export GameSchema
- `[backend/app/pipeline/__init__.py](backend/app/pipeline/__init__.py)`
- `[backend/app/pipeline/prompts/__init__.py](backend/app/pipeline/prompts/__init__.py)`
- `[backend/app/pipeline/prompts/research.py](backend/app/pipeline/prompts/research.py)` -- Perplexity prompt templates (with interrupt, combo, elimination sections)
- `[backend/app/pipeline/prompts/generation.py](backend/app/pipeline/prompts/generation.py)` -- DSL generation prompts (with $-reference docs for targeting and reactions)
- `[backend/app/pipeline/research.py](backend/app/pipeline/research.py)` -- Perplexity research step
- `[backend/app/pipeline/generate.py](backend/app/pipeline/generate.py)` -- DSL generation + retry step
- `[backend/app/pipeline/orchestrator.py](backend/app/pipeline/orchestrator.py)` -- Full pipeline
- `[backend/app/routers/generate.py](backend/app/routers/generate.py)` -- POST /api/v1/generate endpoint
- `[backend/app/examples/exploding_kittens.json](backend/app/examples/exploding_kittens.json)` -- Second reference example for the LLM (demonstrates interrupts, combos, elimination)

Modified files:

- `[backend/app/main.py](backend/app/main.py)` -- Register generate router
- `[backend/app/config.py](backend/app/config.py)` -- Add pipeline config (PIPELINE_MAX_RETRIES, DEFAULT_CODEX_MODEL="codex-5.3-high")
- `[backend/requirements.txt](backend/requirements.txt)` -- Already has pydantic, httpx, openai; may need `sse-starlette` for SSE support
