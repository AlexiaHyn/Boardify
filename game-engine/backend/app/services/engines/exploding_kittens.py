import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple
from app.models.game import GameState, Player, Card, LogEntry
from app.services.engines.game_plugin_base import GamePluginBase

def _ts(): return int(datetime.now().timestamp() * 1000)
def _log(msg, type_="action", pid=None, cid=None):
    return LogEntry(id=str(uuid.uuid4()), timestamp=_ts(), message=msg, type=type_, playerId=pid, cardId=cid)

class ExplodingKittensPlugin(GamePluginBase):
    def get_custom_actions(self):
        return {
            "place_exploding_kitten": self._action_place_exploding_kitten,
            "play_combo": self._action_play_combo,
            "steal_card": self._action_steal_card,
            "give_card": self._action_give_card,
            "nope": self._action_nope,
            "peek_future": self._action_peek_future
        }

    def _action_place_exploding_kitten(self, state, action):
        pending = state.pendingAction
        if not pending or pending.get("type") != "place_exploding_kitten":
            return False, "No kitten placement pending", []
        
        player = self.get_player(state, pending["playerId"])
        if not player:
            return False, "Player not found", []
        
        position = (action.metadata or {}).get("position", 0)
        from app.services.engines.universal import _draw_zone
        draw_pile = _draw_zone(state)
        
        if position < 0 or position > len(draw_pile.cards):
            position = 0
        
        kitten_id = pending.get("kittenId")
        kitten = Card(
            id=kitten_id or str(uuid.uuid4()),
            name="Exploding Kitten",
            type="special",
            subtype="exploding",
            description="If drawn, you explode unless you play a Defuse card.",
            metadata={"isExplodingKitten": True}
        )
        
        draw_pile.cards.insert(position, kitten)
        
        state.log.append(_log(f"{player.name} placed an Exploding Kitten back in the deck", "action", player.id))
        state.pendingAction = None
        
        return True, "", ["kitten_placed"]

    def _action_play_combo(self, state, action):
        player = self.get_player(state, action.playerId)
        if not player:
            return False, "Player not found", []
        
        card_ids = action.metadata.get("cardIds", [])
        if len(card_ids) < 2:
            return False, "Need at least 2 cards for combo", []
        
        cards = [c for c in player.hand.cards if c.id in card_ids]
        if len(cards) != len(card_ids):
            return False, "Some cards not found in hand", []
        
        if not all(c.name == cards[0].name for c in cards):
            return False, "All cards must have matching names", []
        
        from app.services.engines.universal import _discard_zone
        discard = _discard_zone(state)
        
        for card in cards:
            player.hand.cards.remove(card)
            discard.cards.insert(0, card)
        
        combo_type = "pair" if len(cards) == 2 else "three_of_a_kind"
        state.metadata["lastCombo"] = {
            "playerId": player.id,
            "type": combo_type,
            "cardName": cards[0].name
        }
        
        if combo_type == "pair":
            target_id = action.metadata.get("targetPlayerId")
            if not target_id:
                state.pendingAction = {
                    "type": "choose_steal_target",
                    "playerId": player.id,
                    "comboType": "pair"
                }
            else:
                return self._steal_random_card(state, player, target_id)
        else:
            return self._steal_from_all_players(state, player)
        
        return True, "", ["combo_played"]

    def _action_steal_card(self, state, action):
        pending = state.pendingAction
        if not pending or pending.get("type") != "choose_steal_target":
            return False, "No steal action pending", []
        
        player = self.get_player(state, pending["playerId"])
        target_id = action.metadata.get("targetPlayerId")
        target = self.get_player(state, target_id)
        
        if not player or not target:
            return False, "Player not found", []
        
        if target.id == player.id:
            return False, "Cannot steal from yourself", []
        
        return self._steal_random_card(state, player, target_id)

    def _steal_random_card(self, state, stealer, target_id):
        target = self.get_player(state, target_id)
        if not target or not target.hand.cards:
            state.pendingAction = None
            return True, "Target has no cards", []
        
        import random
        stolen_card = random.choice(target.hand.cards)
        target.hand.cards.remove(stolen_card)
        stealer.hand.cards.append(stolen_card)
        
        state.log.append(_log(f"{stealer.name} stole a card from {target.name}", "action", stealer.id))
        state.pendingAction = None
        
        return True, "", ["card_stolen"]

    def _steal_from_all_players(self, state, stealer):
        active_players = [p for p in self.get_active_players(state) if p.id != stealer.id]
        stolen_count = 0
        
        import random
        for target in active_players:
            if target.hand.cards:
                stolen_card = random.choice(target.hand.cards)
                target.hand.cards.remove(stolen_card)
                stealer.hand.cards.append(stolen_card)
                stolen_count += 1
        
        state.log.append(_log(f"{stealer.name} stole cards from all players ({stolen_count} cards)", "action", stealer.id))
        state.pendingAction = None
        
        return True, "", ["cards_stolen_all"]

    def _action_give_card(self, state, action):
        pending = state.pendingAction
        if not pending or pending.get("type") != "give_card":
            return False, "No card giving pending", []
        
        giver = self.get_player(state, pending["giverId"])
        receiver = self.get_player(state, pending["receiverId"])
        card_id = action.metadata.get("cardId")
        
        if not giver or not receiver:
            return False, "Player not found", []
        
        card = next((c for c in giver.hand.cards if c.id == card_id), None)
        if not card:
            return False, "Card not found in hand", []
        
        giver.hand.cards.remove(card)
        receiver.hand.cards.append(card)
        
        state.log.append(_log(f"{giver.name} gave a card to {receiver.name}", "action", giver.id))
        state.pendingAction = None
        
        return True, "", ["card_given"]

    def _action_nope(self, state, action):
        if not state.metadata.get("canNope", False):
            return False, "Nothing to nope", []
        
        player = self.get_player(state, action.playerId)
        if not player:
            return False, "Player not found", []
        
        nope_card = next((c for c in player.hand.cards if c.subtype == "nope"), None)
        if not nope_card:
            return False, "No Nope card in hand", []
        
        player.hand.cards.remove(nope_card)
        from app.services.engines.universal import _discard_zone
        discard = _discard_zone(state)
        discard.cards.insert(0, nope_card)
        
        state.log.append(_log(f"{player.name} played Nope!", "action", player.id))
        
        state.metadata["canNope"] = False
        state.metadata["lastActionNoped"] = True
        
        nope_count = state.metadata.get("nopeCount", 0) + 1
        state.metadata["nopeCount"] = nope_count
        
        if nope_count % 2 == 1:
            state.metadata["canNope"] = True
        
        return True, "", ["nope_played"]

    def _action_peek_future(self, state, action):
        player = self.get_player(state, action.playerId)
        if not player:
            return False, "Player not found", []
        
        from app.services.engines.universal import _draw_zone
        draw_pile = _draw_zone(state)
        
        peek_count = min(3, len(draw_pile.cards))
        peeked_cards = draw_pile.cards[:peek_count]
        
        card_names = [c.name for c in peeked_cards]
        state.log.append(_log(f"{player.name} saw the future", "action", player.id))
        
        return True, "", ["future_seen"]

    def on_card_played(self, state, player, card):
        if card.subtype == "attack":
            state.metadata["extraTurns"] = state.metadata.get("extraTurns", 0) + 1
        elif card.subtype == "skip":
            extra_turns = state.metadata.get("extraTurns", 0)
            if extra_turns > 0:
                state.metadata["extraTurns"] = extra_turns - 1
            else:
                state.metadata["skipDrawing"] = True
        elif card.subtype == "favor":
            target_id = (card.metadata or {}).get("targetPlayerId")
            if target_id:
                state.pendingAction = {
                    "type": "give_card",
                    "giverId": target_id,
                    "receiverId": player.id
                }
        elif card.subtype == "shuffle":
            from app.services.engines.universal import _draw_zone
            import random
            draw_pile = _draw_zone(state)
            random.shuffle(draw_pile.cards)
            state.log.append(_log(f"{player.name} shuffled the deck", "action", player.id))
        elif card.subtype == "peek":
            return self._action_peek_future(state, type('obj', (object,), {
                'playerId': player.id,
                'metadata': {}
            })())
        
        if card.subtype != "nope":
            state.metadata["canNope"] = True
            state.metadata["nopeCount"] = 0
        
        return None

    def on_turn_start(self, state, player):
        state.metadata["skipDrawing"] = False
        state.metadata["canNope"] = False
        state.metadata["lastActionNoped"] = False

    def on_turn_end(self, state, player):
        if not state.metadata.get("skipDrawing", False):
            from app.services.engines.universal import _draw_zone, _draw_n
            draw_pile = _draw_zone(state)
            
            if draw_pile.cards:
                drawn_card = draw_pile.cards.pop(0)
                
                if drawn_card.metadata and drawn_card.metadata.get("isExplodingKitten"):
                    defuse_card = next((c for c in player.hand.cards if c.subtype == "defuse"), None)
                    if defuse_card:
                        player.hand.cards.remove(defuse_card)
                        from app.services.engines.universal import _discard_zone
                        discard = _discard_zone(state)
                        discard.cards.insert(0, defuse_card)
                        
                        state.pendingAction = {
                            "type": "place_exploding_kitten",
                            "playerId": player.id,
                            "kittenId": drawn_card.id
                        }
                        state.log.append(_log(f"{player.name} defused an Exploding Kitten!", "action", player.id))
                    else:
                        player.status = "eliminated"
                        player.hand.cards.clear()
                        state.log.append(_log(f"{player.name} exploded! 💥", "elimination", player.id))
                        
                        active_players = self.get_active_players(state)
                        if len(active_players) == 1:
                            winner = active_players[0]
                            winner.status = "winner"
                            state.winner = winner
                            state.phase = "ended"
                else:
                    player.hand.cards.append(drawn_card)
        
        extra_turns = state.metadata.get("extraTurns", 0)
        if extra_turns > 0:
            state.metadata["extraTurns"] = extra_turns - 1
        else:
            from app.services.engines.universal import _advance_turn
            _advance_turn(state)

    def validate_card_play(self, state, player, card):
        if card.subtype == "defuse":
            return False, "Defuse cards are played automatically"
        
        if card.subtype == "favor" and not (card.metadata and card.metadata.get("targetPlayerId")):
            active_players = [p for p in self.get_active_players(state) if p.id != player.id]
            if not active_players:
                return False, "No valid targets for Favor"
        
        return True, ""

def create_plugin(game_config):
    return ExplodingKittensPlugin("exploding_kittens", game_config)