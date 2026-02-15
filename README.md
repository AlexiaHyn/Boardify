# Boardify
Around the Table, Around the World

## Multiplayer + Showcase env

Backend (`backend/.env`):

- `PERPLEXITY_API_KEY`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

Frontend (`boardify/.env.local`):

- `NEXT_PUBLIC_MODAL_ENDPOINT` (e.g. `http://localhost:8000`)

## Supabase schema

Run the SQL in `backend/supabase/schema.sql` in your Supabase SQL editor.

## Verify WebSocket

1. **In the app**  
   Host a game (Host → paste snapshot → Create Game). On the game room page you should see **"Connected"** and a Realtime Feed. Open the same room in another tab (or join with another player); sending "Start Game" or "End Game" should show events in the feed.

2. **Browser DevTools**  
   Open DevTools → **Network** → filter by **WS**. Reload the game room. You should see one request to `ws://localhost:8000/api/v1/ws/{code}?player_id=...` with status **101 Switching Protocols**. Click it to see **Messages** (frames) sent and received.

3. **CLI script**  
   With the backend running (`uvicorn` on port 8000), from repo root:
   ```bash
   cd backend && pip install websockets && python scripts/verify_ws.py
   ```
   You should see `Created game_code=...` and `WebSocket OK: received session_state.`
