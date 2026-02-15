"""
Local orchestrator for AI game generation.

Calls the deployed Modal functions (research → generate → validate),
retries on validation failure with error feedback, and persists the
final game JSON into the /games directory.
"""
from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Any, Callable, Dict, Optional

import modal

logger = logging.getLogger(__name__)

# ── Constants ─────────────────────────────────────────────────────────────────

_MODAL_APP_NAME = "boardify-game-generator"
_MAX_RETRIES = 3
_GAMES_DIR = Path(__file__).resolve().parent.parent / "games"

# Progress callback type: (step, message) → None
ProgressFn = Callable[[str, str], None]


# ── Helpers ───────────────────────────────────────────────────────────────────

def _lookup(fn_name: str) -> modal.Function:
    """Look up a deployed Modal function by name."""
    return modal.Function.from_name(_MODAL_APP_NAME, fn_name)


def _noop_progress(_step: str, _msg: str) -> None:
    """Default no-op progress callback."""


# ── Main pipeline ─────────────────────────────────────────────────────────────

def generate_game(
    game_name: str,
    on_progress: Optional[ProgressFn] = None,
) -> Dict[str, Any]:
    """
    End-to-end game generation pipeline.

    1. Research rules via Perplexity Sonar (Modal)
    2. Generate JSON via Anthropic Claude (Modal)
    3. Validate in Modal Sandbox
    4. Retry with error feedback if validation fails
    5. Save the valid JSON to disk

    Returns a dict suitable for ``GenerateGameResponse``.
    """
    emit = on_progress or _noop_progress

    try:
        # ── Step 1: Research ──────────────────────────────────────────────
        emit("research", f'Researching rules for "{game_name}" ...')
        logger.info("Researching rules for %s", game_name)

        research_fn = _lookup("research_game_rules")
        rules_text: str = research_fn.remote(game_name)

        emit("research_done", "Rules research complete.")
        logger.info("Research complete (%d chars)", len(rules_text))

        # ── Step 2 + 3: Generate → Validate (with retries) ───────────────
        error_feedback = ""
        all_warnings: List[str] = []

        for attempt in range(1, _MAX_RETRIES + 1):
            # Generate
            emit(
                "generate",
                f"Generating game JSON (attempt {attempt}/{_MAX_RETRIES}) ...",
            )
            logger.info("Generation attempt %d/%d", attempt, _MAX_RETRIES)

            generate_fn = _lookup("generate_game_json")
            raw_json: str = generate_fn.remote(
                game_name, rules_text, error_feedback,
            )

            # Quick-parse check
            try:
                game_data = json.loads(raw_json)
            except json.JSONDecodeError as exc:
                error_feedback = f"Output was not valid JSON: {exc}"
                emit("validate_fail", f"Invalid JSON on attempt {attempt}.")
                logger.warning("JSON parse failure on attempt %d: %s", attempt, exc)
                continue

            # Validate in sandbox
            emit("validate", "Validating game definition in sandbox ...")
            validate_fn = _lookup("validate_in_sandbox")
            result: dict = validate_fn.remote(raw_json)

            all_warnings.extend(result.get("warnings", []))

            if result.get("valid"):
                emit("validate_ok", "Validation passed!")
                logger.info("Validation passed on attempt %d", attempt)
                break

            # Build feedback for next attempt
            errors = result.get("errors", [])
            error_feedback = "\n".join(f"- {e}" for e in errors)
            emit(
                "validate_fail",
                f"Attempt {attempt} had {len(errors)} error(s). Retrying ...",
            )
            logger.warning(
                "Validation failed on attempt %d: %s", attempt, errors,
            )
        else:
            # All retries exhausted
            return {
                "success": False,
                "game_id": "",
                "game_name": game_name,
                "error": (
                    f"Generation failed after {_MAX_RETRIES} attempts. "
                    f"Last errors: {error_feedback}"
                ),
                "errors": result.get("errors", []),
                "warnings": all_warnings,
            }

        # ── Step 4: Save ──────────────────────────────────────────────────
        game_id = game_data.get("id", game_name.lower().replace(" ", "_"))
        out_path = _GAMES_DIR / f"{game_id}.json"

        emit("save", f"Saving {game_id}.json ...")
        _GAMES_DIR.mkdir(parents=True, exist_ok=True)
        out_path.write_text(json.dumps(game_data, indent=2), encoding="utf-8")
        logger.info("Saved game to %s", out_path)

        return {
            "success": True,
            "game_id": game_id,
            "game_name": game_data.get("name", game_name),
            "message": f"Successfully generated {game_data.get('name', game_name)}!",
            "errors": [],
            "warnings": all_warnings,
        }

    except Exception as exc:
        logger.exception("Game generation pipeline failed")
        return {
            "success": False,
            "game_id": "",
            "game_name": game_name,
            "error": str(exc),
            "errors": [str(exc)],
            "warnings": [],
        }
