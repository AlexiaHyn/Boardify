import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple
from app.models.game import GameState, Player, Card, LogEntry
from app.services.engines.game_plugin_base import GamePluginBase

def _ts(): return int(datetime.now().timestamp() * 1000)
def _log(msg, type_="action", pid=None, cid=None):
    return LogEntry(id=str(uuid.uuid4()), timestamp=_ts(), message=msg, type=type_, playerId=pid, cardId=cid)

class GoFishPlugin(GamePluginBase):
    def get_custom_actions(self):
        return {
            "ask_for_rank": self._action_ask_for_rank,
        }

    def _action_ask_for_rank(self, state, action):
        player = self.get_player(state, action.playerId)
        target_id = action.targetPlayerId or (action.metadata or {}).get("targetPlayerId")
        target = self.get_player(state, target_id)
        requested_rank = (action.metadata or {}).get("rank")
        
        if not player or not target:
            return False, "Player not found", []
        
        if player.id == target.id:
            return False, "Cannot ask yourself for cards", []
            
        if not requested_rank:
            return False, "Must specify a rank to ask for", []
            
        # Check if player has at least one card of the requested rank
        has_rank = any((card.metadata or {}).get("rank") == requested_rank for card in player.hand.cards)
        if not has_rank:
            return False, f"You must have at least one {requested_rank} to ask for it", []
        
        # Find matching cards in target's hand
        matching_cards = [card for card in target.hand.cards if (card.metadata or {}).get("rank") == requested_rank]
        
        triggered = []
        
        if matching_cards:
            # Transfer all matching cards from target to player
            for card in matching_cards:
                target.hand.cards.remove(card)
                player.hand.cards.append(card)
            
            state.log.append(_log(f"{player.name} asked {target.name} for {requested_rank}s and got {len(matching_cards)} cards!", "action", player.id))
            triggered.append(f"cards_received:{len(matching_cards)}")
            
            # Check for books after receiving cards
            self._check_and_form_books(state, player)
            
            # Player continues turn
            triggered.append("continue_turn")
            
        else:
            # Go Fish! Draw one card
            state.log.append(_log(f"{player.name} asked {target.name} for {requested_rank}s. Go Fish!", "action", player.id))
            
            from app.services.engines.universal import _draw_n
            drawn_cards = _draw_n(state, player, 1)
            
            # Check if drawn card is the one they asked for
            if drawn_cards and len(drawn_cards) > 0:
                drawn_card = drawn_cards[0]
                if (drawn_card.metadata or {}).get("rank") == requested_rank:
                    state.log.append(_log(f"{player.name} drew the {requested_rank} they asked for! Turn continues.", "effect", player.id, drawn_card.id))
                    triggered.append("drew_requested_card")
                    triggered.append("continue_turn")
                else:
                    triggered.append("turn_ends")
            else:
                triggered.append("turn_ends")
                
        # Check for books after any card changes
        self._check_and_form_books(state, player)
        
        # Check if player ran out of cards and stock is available
        if not player.hand.cards:
            stock = next((zone for zone in state.zones if zone.id == "stock"), None)
            if stock and stock.cards:
                from app.services.engines.universal import _draw_n
                cards_to_draw = min(5, len(stock.cards))
                _draw_n(state, player, cards_to_draw)
                state.log.append(_log(f"{player.name} ran out of cards and drew {cards_to_draw} new ones!", "effect", player.id))
        
        return True, "", triggered

    def _check_and_form_books(self, state, player):
        """Check if player has any complete books (sets of 4 same rank) and move them to books zone"""
        if not player.hand.cards:
            return
            
        # Group cards by rank
        rank_groups = {}
        for card in player.hand.cards[:]:  # Copy list to avoid modification during iteration
            rank = (card.metadata or {}).get("rank")
            if rank:
                if rank not in rank_groups:
                    rank_groups[rank] = []
                rank_groups[rank].append(card)
        
        # Check for complete books (4 cards of same rank)
        books_zone = next((zone for zone in state.zones if zone.id == "books"), None)
        if not books_zone:
            # Create books zone if it doesn't exist
            from app.models.game import Zone
            books_zone = Zone(id="books", name="Books", type="books", isPublic=True, cards=[])
            state.zones.append(books_zone)
        
        books_formed = 0
        for rank, cards in rank_groups.items():
            if len(cards) == 4:
                # Move all 4 cards to books zone
                for card in cards:
                    player.hand.cards.remove(card)
                    books_zone.cards.append(card)
                
                books_formed += 1
                state.log.append(_log(f"{player.name} completed a book of {rank}s!", "effect", player.id))
                
                # Update player's book count
                player.metadata = player.metadata or {}
                player.metadata["books"] = player.metadata.get("books", 0) + 1
        
        if books_formed > 0:
            self._check_win_condition(state)

    def _check_win_condition(self, state):
        """Check if game should end based on win conditions"""
        # Count total books formed
        books_zone = next((zone for zone in state.zones if zone.id == "books"), None)
        total_books = len(books_zone.cards) // 4 if books_zone else 0
        
        # Game ends when all 13 possible books are formed
        if total_books >= 13:
            # Find player with most books
            max_books = 0
            winner = None
            
            for player in state.players:
                player_books = (player.metadata or {}).get("books", 0)
                if player_books > max_books:
                    max_books = player_books
                    winner = player
            
            if winner:
                winner.status = "winner"
                state.winner = winner
                state.phase = "ended"
                state.log.append(_log(f"{winner.name} wins with {max_books} books!", "game_end", winner.id))

    def on_game_start(self, state):
        """Initialize game-specific metadata"""
        # Adjust hand size based on player count
        player_count = len([p for p in state.players if p.status == "active"])
        if player_count <= 3:
            hand_size = 7
        else:
            hand_size = 5
            
        # Store hand size in metadata for reference
        state.metadata["initialHandSize"] = hand_size
        
        # Initialize book counts for all players
        for player in state.players:
            player.metadata = player.metadata or {}
            player.metadata["books"] = 0

    def on_turn_start(self, state, player):
        """Handle start of player's turn"""
        # Check if player has no cards and can draw from stock
        if not player.hand.cards:
            stock = next((zone for zone in state.zones if zone.id == "stock"), None)
            if stock and stock.cards:
                from app.services.engines.universal import _draw_n
                cards_to_draw = min(5, len(stock.cards))
                _draw_n(state, player, cards_to_draw)
                state.log.append(_log(f"{player.name} had no cards and drew {cards_to_draw}!", "effect", player.id))
            else:
                # No cards and no stock - player is eliminated
                player.status = "eliminated"
                state.log.append(_log(f"{player.name} is out of the game!", "elimination", player.id))
                return
        
        # Check for any books at start of turn
        self._check_and_form_books(state, player)

    def validate_action(self, state, action):
        """Validate custom actions"""
        if action.type == "ask_for_rank":
            player = self.get_player(state, action.playerId)
            if not player:
                return False, "Player not found"
                
            # Must be player's turn
            if state.currentTurnPlayerId != player.id:
                return False, "Not your turn"
                
            # Must have cards to ask
            if not player.hand.cards:
                return False, "You have no cards"
                
        return True, ""

def create_plugin(game_config):
    return GoFishPlugin("go_fish", game_config)