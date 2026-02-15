#!/usr/bin/env python3
"""
Verify WebSocket endpoint: create a game via HTTP, then connect via WS
and print the first message. Run from repo root with backend running:

  cd backend && python scripts/verify_ws.py

Requires: pip install websockets (or already installed via supabase deps)
"""
from __future__ import annotations

import json
import sys
import urllib.request

# Default base URL when backend runs locally
BASE = "http://localhost:8000"
WS_BASE = "ws://localhost:8000"


def main() -> None:
    # 1) Create a game
    snapshot = {"meta": {"game_name": "WS verify"}, "fsm": {}}
    body = json.dumps(
        {"host_person": "ws-verify-script", "game_snapshot": snapshot}
    ).encode("utf-8")
    req = urllib.request.Request(
        f"{BASE}/api/v1/games/create",
        data=body,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        print(f"Create game failed: {e.code} {e.reason}", file=sys.stderr)
        sys.exit(1)
    except OSError as e:
        print(f"Cannot reach backend at {BASE}: {e}", file=sys.stderr)
        sys.exit(1)

    game_code = data.get("game_code")
    player_id = data.get("player_id")
    if not game_code or not player_id:
        print("Unexpected create response:", data, file=sys.stderr)
        sys.exit(1)

    print(f"Created game_code={game_code} player_id={player_id}")

    # 2) Connect via WebSocket
    try:
        import asyncio
        import websockets
    except ImportError:
        print("Install websockets: pip install websockets", file=sys.stderr)
        sys.exit(1)

    url = f"{WS_BASE}/api/v1/ws/{game_code}?player_id={player_id}"

    async def run() -> None:
        async with websockets.connect(url) as ws:
            msg = await ws.recv()
            parsed = json.loads(msg)
            print("First WS message:", json.dumps(parsed, indent=2)[:500])
            if parsed.get("type") == "session_state" and "session" in parsed:
                print("WebSocket OK: received session_state.")
            else:
                print("WebSocket connected; unexpected payload shape.")

    try:
        asyncio.run(run())
    except Exception as e:
        print(f"WebSocket failed: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
