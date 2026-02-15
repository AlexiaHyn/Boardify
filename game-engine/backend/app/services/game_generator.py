"""
Local orchestrator for AI game generation.

Calls the deployed Modal functions:
  research -> generate JSON -> validate -> generate plugin -> generate card images -> save & register

Retries on validation failure with error feedback, persists the final game
JSON into /games and the plugin into /engines, card images into /static, and registers the plugin.
"""
from __future__ import annotations

import ast
import json
import logging
import re
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional

import modal

logger = logging.getLogger(__name__)

# ── Constants ─────────────────────────────────────────────────────────────────

_MODAL_APP_NAME = "boardify-game-generator"
_MAX_RETRIES = 3
_GAMES_DIR = Path(__file__).resolve().parent.parent / "games"
_ENGINES_DIR = Path(__file__).resolve().parent / "engines"
_PLUGIN_LOADER = _ENGINES_DIR / "plugin_loader.py"
_STATIC_DIR = Path(__file__).resolve().parent.parent.parent / "static"

# Progress callback type: (step, message) -> None
ProgressFn = Callable[[str, str], None]


# ── Helpers ───────────────────────────────────────────────────────────────────

def _lookup(fn_name: str) -> modal.Function:
    """Look up a deployed Modal function by name."""
    return modal.Function.from_name(_MODAL_APP_NAME, fn_name)


def _noop_progress(_step: str, _msg: str) -> None:
    """Default no-op progress callback."""


def _strip_code_fences(text: str) -> str:
    """Remove markdown code fences if the AI wrapped the output."""
    text = text.strip()
    if text.startswith("```"):
        # Remove opening fence (```python or ```)
        text = re.sub(r"^```[a-zA-Z]*\n?", "", text)
    if text.endswith("```"):
        text = text[:-3]
    return text.strip()


def _validate_plugin_syntax(code: str) -> Optional[str]:
    """Check that the plugin code is syntactically valid Python.
    Returns None if valid, or an error message string."""
    try:
        ast.parse(code)
        return None
    except SyntaxError as exc:
        return f"Line {exc.lineno}: {exc.msg}"


def _generate_and_save_card_images(
    game_id: str,
    game_name: str,
    game_data: Dict[str, Any],
    emit: ProgressFn,
) -> bool:
    """
    Generate card images via Flux on Modal and save them to static/.

    Updates game_data in-place with imageUrl on each card definition.
    Returns True on success, False on failure (non-fatal).
    """
    card_defs = game_data.get("cards", [])
    if not card_defs:
        return False

    theme_color = game_data.get("themeColor", "#4F46E5")

    try:
        emit("images", f"Generating {len(card_defs)} card images with Flux ...")
        logger.info("Starting card image generation for %s (%d cards)", game_id, len(card_defs))

        gen_fn = _lookup("generate_card_images")
        images: Dict[str, bytes] = gen_fn.remote(
            game_name, card_defs, theme_color,
        )

        # Save images to static/cards/{game_id}/
        cards_dir = _STATIC_DIR / "cards" / game_id
        cards_dir.mkdir(parents=True, exist_ok=True)

        saved = 0
        for card_def in card_defs:
            cid = card_def["id"]
            img_bytes = images.get(cid)
            if not img_bytes:
                logger.warning("No image returned for card %s", cid)
                continue

            img_path = cards_dir / f"{cid}.jpg"
            img_path.write_bytes(img_bytes)

            # Set the imageUrl on the card definition (relative to static mount)
            card_def["imageUrl"] = f"/static/cards/{game_id}/{cid}.jpg"
            saved += 1

        emit("images_done", f"Generated {saved}/{len(card_defs)} card images.")
        logger.info("Saved %d/%d card images for %s", saved, len(card_defs), game_id)
        return saved > 0

    except Exception as exc:
        emit("images_warn", f"Card image generation failed: {exc}. Continuing without images.")
        logger.warning("Card image generation failed for %s: %s", game_id, exc)
        return False


def _register_plugin(game_id: str) -> None:
    """Add the game to PLUGIN_MODULES in plugin_loader.py."""
    loader_text = _PLUGIN_LOADER.read_text(encoding="utf-8")

    module_path = f"app.services.engines.{game_id}"
    entry = f'    "{game_id}": "{module_path}",'

    # Already registered?
    if f'"{game_id}"' in loader_text:
        logger.info("Plugin %s already registered in plugin_loader.py", game_id)
        return

    # Insert before the closing brace of PLUGIN_MODULES = { ... }
    # Find the pattern: last entry line before the closing }
    pattern = r"(PLUGIN_MODULES\s*=\s*\{[^}]*)"
    match = re.search(pattern, loader_text, re.DOTALL)
    if match:
        insert_pos = match.end()
        loader_text = loader_text[:insert_pos] + "\n" + entry + loader_text[insert_pos:]
        _PLUGIN_LOADER.write_text(loader_text, encoding="utf-8")
        logger.info("Registered plugin %s in plugin_loader.py", game_id)
    else:
        logger.warning("Could not find PLUGIN_MODULES dict to register %s", game_id)


# ── Main pipeline ─────────────────────────────────────────────────────────────

def generate_game(
    game_name: str,
    on_progress: Optional[ProgressFn] = None,
) -> Dict[str, Any]:
    """
    End-to-end game generation pipeline.

    1. Research rules via Perplexity Sonar (Modal)
    2. Generate JSON via Anthropic Claude (Modal)
    3. Validate JSON (Modal)
    4. Retry with error feedback if validation fails
    5. Generate Python plugin (Modal)
    6. Save JSON + plugin to disk and register plugin

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

        # ── Step 2 + 3: Generate JSON -> Validate (with retries) ─────────
        error_feedback = ""
        all_warnings: List[str] = []
        raw_json = ""
        game_data = {}

        for attempt in range(1, _MAX_RETRIES + 1):
            emit(
                "generate",
                f"Generating game rule context...",
            )
            logger.info("Generation attempt %d/%d", attempt, _MAX_RETRIES)

            generate_fn = _lookup("generate_game_json")
            raw_json = generate_fn.remote(
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

            # Validate
            emit("validate", "Validating game definition ...")
            validate_fn = _lookup("validate_in_sandbox")
            result: dict = validate_fn.remote(raw_json)

            all_warnings.extend(result.get("warnings", []))

            if result.get("valid"):
                emit("validate_ok", "Validation passed!")
                logger.info("Validation passed on attempt %d", attempt)
                break

            errors = result.get("errors", [])
            error_feedback = "\n".join(f"- {e}" for e in errors)
            emit(
                "validate_fail",
                f"Attempt {attempt} had {len(errors)} error(s). Retrying ...",
            )
            logger.warning("Validation failed attempt %d: %s", attempt, errors)
        else:
            return {
                "success": False,
                "game_id": "",
                "game_name": game_name,
                "error": (
                    f"JSON generation failed after {_MAX_RETRIES} attempts. "
                    f"Last errors: {error_feedback}"
                ),
                "errors": result.get("errors", []),
                "warnings": all_warnings,
            }

        game_id = game_data.get("id", game_name.lower().replace(" ", "_"))

        # ── Step 4: Generate Python plugin ────────────────────────────────
        emit("plugin", f"Generating Python plugin for {game_name} ...")
        logger.info("Generating plugin for %s", game_id)

        plugin_fn = _lookup("generate_game_plugin")
        raw_plugin: str = plugin_fn.remote(
            game_name, game_id, raw_json, rules_text,
        )
        plugin_code = _strip_code_fences(raw_plugin)

        # Validate syntax
        syntax_err = _validate_plugin_syntax(plugin_code)
        if syntax_err:
            emit("plugin_warn", f"Plugin has syntax error: {syntax_err}. Skipping plugin.")
            logger.warning("Plugin syntax error for %s: %s", game_id, syntax_err)
            plugin_code = None
        else:
            emit("plugin_ok", "Plugin generated and validated!")
            logger.info("Plugin syntax OK for %s", game_id)

        # ── Step 5: Generate card images via Flux ──────────────────────────
        _generate_and_save_card_images(game_id, game_name, game_data, emit)
        # game_data cards now have imageUrl fields (if generation succeeded)

        # ── Step 6: Save everything ───────────────────────────────────────
        # Save game JSON (includes imageUrl fields from step 5)
        out_path = _GAMES_DIR / f"{game_id}.json"
        emit("save", f"Saving {game_id}.json ...")
        _GAMES_DIR.mkdir(parents=True, exist_ok=True)
        out_path.write_text(json.dumps(game_data, indent=2), encoding="utf-8")
        logger.info("Saved game JSON to %s", out_path)

        # Save plugin
        if plugin_code:
            plugin_path = _ENGINES_DIR / f"{game_id}.py"
            emit("save_plugin", f"Saving {game_id}.py plugin ...")
            plugin_path.write_text(plugin_code, encoding="utf-8")
            logger.info("Saved plugin to %s", plugin_path)

            # Register in plugin_loader.py
            _register_plugin(game_id)
            emit("register", f"Registered {game_id} plugin.")

        return {
            "success": True,
            "game_id": game_id,
            "game_name": game_data.get("name", game_name),
            "description": game_data.get("description", ""),
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
