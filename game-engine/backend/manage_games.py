#!/usr/bin/env python3
"""
Boardify Game Manager CLI
=========================
List, delete, or purge installed games from the backend.

Usage:
    python manage_games.py list                 # List all installed games
    python manage_games.py delete <game_id>     # Delete a specific game
    python manage_games.py delete-all           # Delete ALL games
    python manage_games.py delete-all --yes     # Skip confirmation prompt

Each game can have up to three artifacts:
  - app/games/<game_id>.json          (game definition)
  - app/services/engines/<game_id>.py (game plugin)
  - static/cards/<game_id>/           (card images)
"""
from __future__ import annotations

import argparse
import json
import shutil
import sys
from pathlib import Path

# ── Paths ─────────────────────────────────────────────────────────────────────

ROOT = Path(__file__).resolve().parent
GAMES_DIR = ROOT / "app" / "games"
ENGINES_DIR = ROOT / "app" / "services" / "engines"
STATIC_CARDS_DIR = ROOT / "static" / "cards"

# Engine files that are NOT game plugins (should never be deleted)
PROTECTED_ENGINES = {
    "plugin_loader.py",
    "game_plugin_base.py",
    "generic.py",
    "universal.py",
    "__init__.py",
    "__pycache__",
}


# ── Helpers ───────────────────────────────────────────────────────────────────

def discover_games() -> list[dict[str, str]]:
    """Return a list of {'id': ..., 'name': ...} for every installed game."""
    games: list[dict[str, str]] = []
    if not GAMES_DIR.exists():
        return games
    for path in sorted(GAMES_DIR.glob("*.json")):
        game_id = path.stem
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
            name = data.get("name", game_id)
        except Exception:
            name = game_id
        games.append({"id": game_id, "name": name})
    return games


def delete_game(game_id: str, *, quiet: bool = False) -> bool:
    """
    Delete all artifacts for a single game. Returns True if anything was removed.
    """
    removed_anything = False

    # 1. Game definition JSON
    json_path = GAMES_DIR / f"{game_id}.json"
    if json_path.exists():
        json_path.unlink()
        if not quiet:
            print(f"  Removed {json_path.relative_to(ROOT)}")
        removed_anything = True

    # 2. Game plugin
    plugin_path = ENGINES_DIR / f"{game_id}.py"
    if plugin_path.exists():
        plugin_path.unlink()
        if not quiet:
            print(f"  Removed {plugin_path.relative_to(ROOT)}")
        removed_anything = True

    # 3. Card images directory
    cards_dir = STATIC_CARDS_DIR / game_id
    if cards_dir.exists() and cards_dir.is_dir():
        num_files = sum(1 for _ in cards_dir.rglob("*") if _.is_file())
        shutil.rmtree(cards_dir)
        if not quiet:
            print(f"  Removed {cards_dir.relative_to(ROOT)}/ ({num_files} files)")
        removed_anything = True

    if not removed_anything and not quiet:
        print(f"  No artifacts found for '{game_id}'")

    return removed_anything


# ── Commands ──────────────────────────────────────────────────────────────────

def cmd_list(args: argparse.Namespace) -> None:
    games = discover_games()
    if not games:
        print("No games installed.")
        return

    print(f"\nInstalled games ({len(games)}):\n")
    for g in games:
        game_id = g["id"]
        name = g["name"]

        # Check which artifacts exist
        has_plugin = (ENGINES_DIR / f"{game_id}.py").exists()
        has_images = (STATIC_CARDS_DIR / game_id).is_dir() if STATIC_CARDS_DIR.exists() else False

        parts = ["json"]
        if has_plugin:
            parts.append("plugin")
        if has_images:
            num = sum(1 for _ in (STATIC_CARDS_DIR / game_id).rglob("*") if _.is_file())
            parts.append(f"{num} images")

        artifacts = ", ".join(parts)
        print(f"  {game_id:<30} {name:<30} [{artifacts}]")

    print()


def cmd_delete(args: argparse.Namespace) -> None:
    game_id: str = args.game_id

    # Verify the game exists
    json_path = GAMES_DIR / f"{game_id}.json"
    plugin_path = ENGINES_DIR / f"{game_id}.py"
    cards_dir = STATIC_CARDS_DIR / game_id

    if not any(p.exists() for p in [json_path, plugin_path]) and not (cards_dir.exists() and cards_dir.is_dir()):
        print(f"Game '{game_id}' not found.")
        print(f"Run 'python manage_games.py list' to see installed games.")
        sys.exit(1)

    # Load name for display
    name = game_id
    if json_path.exists():
        try:
            data = json.loads(json_path.read_text(encoding="utf-8"))
            name = data.get("name", game_id)
        except Exception:
            pass

    if not args.yes:
        answer = input(f"Delete '{name}' ({game_id})? [y/N] ").strip().lower()
        if answer not in ("y", "yes"):
            print("Cancelled.")
            return

    print(f"\nDeleting '{name}'...")
    delete_game(game_id)
    print("Done.\n")


def cmd_delete_all(args: argparse.Namespace) -> None:
    games = discover_games()
    if not games:
        print("No games installed. Nothing to delete.")
        return

    print(f"\nThis will delete {len(games)} game(s):")
    for g in games:
        print(f"  - {g['name']} ({g['id']})")
    print()

    if not args.yes:
        answer = input("Are you sure? [y/N] ").strip().lower()
        if answer not in ("y", "yes"):
            print("Cancelled.")
            return

    # Also clean up orphan card image directories (no matching JSON)
    orphan_card_dirs: list[Path] = []
    if STATIC_CARDS_DIR.exists():
        known_ids = {g["id"] for g in games}
        for d in STATIC_CARDS_DIR.iterdir():
            if d.is_dir() and d.name not in known_ids:
                orphan_card_dirs.append(d)

    for g in games:
        print(f"\nDeleting '{g['name']}'...")
        delete_game(g["id"])

    # Clean up orphans
    for d in orphan_card_dirs:
        num_files = sum(1 for _ in d.rglob("*") if _.is_file())
        shutil.rmtree(d)
        print(f"\n  Removed orphan card dir: {d.relative_to(ROOT)}/ ({num_files} files)")

    print(f"\nDone. Deleted {len(games)} game(s).\n")


# ── CLI entry point ───────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(
        description="Boardify Game Manager — list, delete, or purge games",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    sub = parser.add_subparsers(dest="command", required=True)

    # list
    sub.add_parser("list", help="List all installed games")

    # delete <game_id>
    p_del = sub.add_parser("delete", help="Delete a specific game by ID")
    p_del.add_argument("game_id", help="Game identifier (e.g. 'uno_plus_1000')")
    p_del.add_argument("-y", "--yes", action="store_true", help="Skip confirmation prompt")

    # delete-all
    p_all = sub.add_parser("delete-all", help="Delete ALL installed games")
    p_all.add_argument("-y", "--yes", action="store_true", help="Skip confirmation prompt")

    args = parser.parse_args()

    dispatch = {
        "list": cmd_list,
        "delete": cmd_delete,
        "delete-all": cmd_delete_all,
    }
    dispatch[args.command](args)


if __name__ == "__main__":
    main()
