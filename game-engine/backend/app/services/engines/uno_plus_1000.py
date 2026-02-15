import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple
from app.models.game import GameState, Player, Card, LogEntry
from app.services.engines.game_plugin_base import GamePluginBase

def _ts(): return int(datetime.now().timestamp() * 1000)
def _log(msg, type_="action", pid=None, cid=None):
    return LogEntry(id=str(uuid.uuid4()), timestamp=_ts(), message=msg, type=type_, playerId=pid, cardId=cid)

class UnoButWith1000Plugin(GamePluginBase):
    def get_custom_actions(self):
        return {
            "choose_color": self._action_choose_color,
            "call_uno": self._action_call_uno,
            "catch_uno": self._action_catch_uno,
            "challenge_wild_draw4": self._action_challenge,
            "challenge_wild_draw_1000": self._action_challenge,
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
            if challenger: self._draw_extreme(state, challenger, draw_count)
            triggered.append(f"accepted:{draw_count}"); _advance_turn(state)
        else:
            if state.metadata.get("lastWildDrawWasIllegal", False):
                if challenged: _draw_n(state, challenged, 4)
                triggered.append("challenge_success")
            else:
                penalty = 6 if draw_count >= 1000 else (draw_count + 2)
                if challenger: self._draw_extreme(state, challenger, penalty)
                triggered.append(f"challenge_failed:{penalty}"); _advance_turn(state)
        return True, "", triggered

    def _draw_extreme(self, state, player, count):
        """Handle extreme draws like +1000, reshuffling deck as needed"""
        from app.services.engines.universal import _draw_n, _draw_zone, _discard_zone
        drawn = 0
        max_attempts = 10
        attempts = 0
        
        while drawn < count and attempts < max_attempts:
            draw_pile = _draw_zone(state)
            if not draw_pile or not draw_pile.cards:
                discard = _discard_zone(state)
                if discard and len(discard.cards) > 1:
                    top = discard.cards[0]
                    remaining = discard.cards[1:]
                    discard.cards = [top]
                    if draw_pile:
                        draw_pile.cards = remaining + (draw_pile.cards or [])
                    else:
                        continue
                else:
                    break
            
            to_draw = min(count - drawn, len(draw_pile.cards) if draw_pile else 0)
            if to_draw > 0:
                _draw_n(state, player, to_draw)
                drawn += to_draw
            attempts += 1
        
        if drawn > 0:
            state.log.append(_log(f"{player.name} draws {drawn} cards!", "effect", player.id))

    def on_card_played(self, state, player, card):
        if len(player.hand.cards) == 1:
            state.metadata.setdefault("unoCalledBy", [])
        
        if card.subtype in ("wild_draw_four", "wild_draw_1000"):
            active_color = state.metadata.get("activeColor")
            if active_color:
                has_match = any(c.metadata and c.metadata.get("color") == active_color 
                               for c in player.hand.cards if c.id != card.id)
                state.metadata["lastWildDrawWasIllegal"] = has_match
        return None

    def validate_card_play(self, state, player, card):
        if self.config.get("matchColor") and state.metadata.get("pendingDraw", 0) > 0:
            if not any(e.type in ("draw", "wild_draw") for e in card.effects):
                if not (card.metadata and card.metadata.get("color") == "wild"):
                    return False, "Must play a draw card to stack or draw"
        return True, ""

def create_plugin(game_config):
    return UnoButWith1000Plugin("uno_plus_1000", game_config)