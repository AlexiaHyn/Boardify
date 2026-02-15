"""
Three Card Poker plugin for the universal card game engine.

This plugin implements a simplified poker variant for exactly 3 players
where each player gets 3 cards and the best poker hand wins the round.
"""

from app.services.engines.game_plugin_base import GamePluginBase
from app.models.game import GameState, Player, Card, LogEntry
from typing import Dict, List, Optional, Tuple, Any
import random


class ThreeCardPokerPlugin(GamePluginBase):
    """Plugin for Three Card Poker - a poker variant for 3 players."""
    
    def __init__(self, game_config: Dict[str, Any]):
        super().__init__(game_config)
        self.folded_players = set()
        self.ante_placed = set()
        self.hands_revealed = set()
        self.current_phase = "ante"
    
    def on_game_start(self, game_state: GameState) -> Optional[LogEntry]:
        """Initialize the poker game."""
        # Deal 3 cards to each player
        for player in game_state.players:
            for _ in range(3):
                if game_state.draw_pile:
                    card = game_state.draw_pile.pop(0)
                    player.hand.append(card)
        
        self.current_phase = "ante"
        self.folded_players.clear()
        self.ante_placed.clear()
        self.hands_revealed.clear()
        
        return LogEntry(
            action="game_start",
            player_name="System",
            description="Three Card Poker started! Each player has 3 cards.",
            metadata={"phase": "ante"}
        )
    
    def on_turn_start(self, game_state: GameState, current_player: Player) -> Optional[LogEntry]:
        """Handle turn start based on current phase."""
        if self.current_phase == "ante" and current_player.name not in self.ante_placed:
            return LogEntry(
                action="turn_start",
                player_name=current_player.name,
                description=f"{current_player.name} must place their ante bet.",
                metadata={"phase": "ante", "action_required": "ante"}
            )
        elif self.current_phase == "play_fold" and current_player.name not in self.folded_players and current_player.name not in self.hands_revealed:
            return LogEntry(
                action="turn_start",
                player_name=current_player.name,
                description=f"{current_player.name} must decide to play or fold.",
                metadata={"phase": "play_fold", "action_required": "play_or_fold"}
            )
        return None
    
    def get_custom_actions(self, game_state: GameState, player: Player) -> List[Dict[str, Any]]:
        """Return available custom actions for the current phase."""
        actions = []
        
        if self.current_phase == "ante" and player.name not in self.ante_placed:
            actions.append({
                "type": "ante",
                "label": "Place Ante",
                "description": "Place your ante bet to continue",
                "enabled": True
            })
        elif self.current_phase == "play_fold" and player.name not in self.folded_players and player.name not in self.hands_revealed:
            actions.append({
                "type": "play_hand",
                "label": "Play Hand",
                "description": "Reveal your 3-card hand",
                "enabled": True
            })
            actions.append({
                "type": "fold",
                "label": "Fold",
                "description": "Fold and forfeit this round",
                "enabled": True
            })
        
        return actions
    
    def on_custom_action(self, game_state: GameState, player: Player, action_type: str, action_data: Dict[str, Any] = None) -> Tuple[bool, Optional[LogEntry]]:
        """Handle custom actions for Three Card Poker."""
        if action_type == "ante":
            return self._handle_ante(game_state, player)
        elif action_type == "play_hand":
            return self._handle_play_hand(game_state, player)
        elif action_type == "fold":
            return self._handle_fold(game_state, player)
        
        return False, LogEntry(
            action="invalid_action",
            player_name=player.name,
            description=f"Invalid action: {action_type}",
            metadata={"error": "unknown_action"}
        )
    
    def _handle_ante(self, game_state: GameState, player: Player) -> Tuple[bool, Optional[LogEntry]]:
        """Handle ante placement."""
        if player.name in self.ante_placed:
            return False, LogEntry(
                action="ante_error",
                player_name=player.name,
                description=f"{player.name} already placed their ante.",
                metadata={"error": "ante_already_placed"}
            )
        
        self.ante_placed.add(player.name)
        
        # Check if all players have placed ante
        if len(self.ante_placed) == len(game_state.players):
            self.current_phase = "play_fold"
            # Reset turn to first player for play/fold phase
            game_state.current_turn = 0
        
        return True, LogEntry(
            action="ante",
            player_name=player.name,
            description=f"{player.name} placed their ante bet.",
            metadata={"phase": self.current_phase, "antes_placed": len(self.ante_placed)}
        )
    
    def _handle_play_hand(self, game_state: GameState, player: Player) -> Tuple[bool, Optional[LogEntry]]:
        """Handle playing a hand (revealing cards)."""
        if player.name in self.hands_revealed or player.name in self.folded_players:
            return False, LogEntry(
                action="play_error",
                player_name=player.name,
                description=f"{player.name} already made their decision.",
                metadata={"error": "already_decided"}
            )
        
        self.hands_revealed.add(player.name)
        
        # Get hand ranking for display
        hand_rank = self._evaluate_hand(player.hand)
        
        log_entry = LogEntry(
            action="play_hand",
            player_name=player.name,
            description=f"{player.name} revealed their hand: {hand_rank['description']}",
            metadata={"hand_rank": hand_rank, "cards": [card.name for card in player.hand]}
        )
        
        # Check if all remaining players have decided
        total_decided = len(self.hands_revealed) + len(self.folded_players)
        if total_decided == len(game_state.players):
            self._determine_winner(game_state)
        
        return True, log_entry
    
    def _handle_fold(self, game_state: GameState, player: Player) -> Tuple[bool, Optional[LogEntry]]:
        """Handle folding."""
        if player.name in self.folded_players or player.name in self.hands_revealed:
            return False, LogEntry(
                action="fold_error",
                player_name=player.name,
                description=f"{player.name} already made their decision.",
                metadata={"error": "already_decided"}
            )
        
        self.folded_players.add(player.name)
        
        log_entry = LogEntry(
            action="fold",
            player_name=player.name,
            description=f"{player.name} folded their hand.",
            metadata={"folded_players": len(self.folded_players)}
        )
        
        # Check if all remaining players have decided
        total_decided = len(self.hands_revealed) + len(self.folded_players)
        if total_decided == len(game_state.players):
            self._determine_winner(game_state)
        
        return True, log_entry
    
    def _evaluate_hand(self, hand: List[Card]) -> Dict[str, Any]:
        """Evaluate a 3-card poker hand and return ranking info."""
        if len(hand) != 3:
            return {"rank": 0, "description": "Invalid hand", "high_card": 0}
        
        # Extract ranks and suits
        ranks = [card.metadata.get("rank", 0) for card in hand]
        suits = [card.metadata.get("suit", "") for card in hand]
        ranks.sort(reverse=True)
        
        # Check for straight flush
        is_flush = len(set(suits)) == 1
        is_straight = self._is_straight(ranks)
        
        if is_straight and is_flush:
            return {"rank": 6, "description": "Straight Flush", "high_card": max(ranks), "kickers": ranks}
        
        # Check for three of a kind
        if ranks[0] == ranks[1] == ranks[2]:
            return {"rank": 5, "description": "Three of a Kind", "high_card": ranks[0], "kickers": ranks}
        
        # Check for straight
        if is_straight:
            return {"rank": 4, "description": "Straight", "high_card": max(ranks), "kickers": ranks}
        
        # Check for flush
        if is_flush:
            return {"rank": 3, "description": "Flush", "high_card": max(ranks), "kickers": ranks}
        
        # Check for pair
        if ranks[0] == ranks[1] or ranks[1] == ranks[2]:
            pair_rank = ranks[1]  # Middle rank is always part of the pair
            kicker = ranks[0] if ranks[0] != pair_rank else ranks[2]
            return {"rank": 2, "description": "Pair", "high_card": pair_rank, "kickers": [pair_rank, pair_rank, kicker]}
        
        # High card
        return {"rank": 1, "description": "High Card", "high_card": max(ranks), "kickers": ranks}
    
    def _is_straight(self, ranks: List[int]) -> bool:
        """Check if ranks form a straight."""
        sorted_ranks = sorted(ranks)
        # Check for normal straight
        if sorted_ranks[2] - sorted_ranks[0] == 2 and len(set(sorted_ranks)) == 3:
            return True
        # Check for A-2-3 straight (low ace)
        if set(sorted_ranks) == {14, 2, 3}:
            return True
        return False
    
    def _determine_winner(self, game_state: GameState) -> None:
        """Determine the winner and end the game."""
        if not self.hands_revealed:
            # Everyone folded - shouldn't happen in 3-player game but handle gracefully
            game_state.winner = game_state.players[0].name
            game_state.is_finished = True
            return
        
        # Evaluate all revealed hands
        hand_rankings = []
        for player in game_state.players:
            if player.name in self.hands_revealed:
                ranking = self._evaluate_hand(player.hand)
                ranking["player"] = player
                hand_rankings.append(ranking)
        
        # Sort by rank (highest first), then by high card, then by kickers
        hand_rankings.sort(key=lambda x: (x["rank"], x["high_card"], x.get("kickers", [])), reverse=True)
        
        # Winner is the player with the highest ranking
        winner = hand_rankings[0]["player"]
        game_state.winner = winner.name
        game_state.is_finished = True
        
        # Add winner log entry
        game_state.log.append(LogEntry(
            action="game_end",
            player_name="System",
            description=f"🏆 {winner.name} wins with {hand_rankings[0]['description']}!",
            metadata={"winner": winner.name, "winning_hand": hand_rankings[0]}
        ))
    
    def validate_card_play(self, game_state: GameState, player: Player, card: Card) -> Tuple[bool, str]:
        """Cards are not played in traditional sense in poker - always invalid."""
        return False, "Cards cannot be played individually in Three Card Poker. Use Play Hand or Fold actions."
    
    def check_win_condition(self, game_state: GameState) -> Optional[str]:
        """Check if the game should end."""
        # Game ends when winner is determined in _determine_winner
        return game_state.winner if game_state.is_finished else None


def create_plugin(game_config: Dict[str, Any]) -> ThreeCardPokerPlugin:
    """Factory function to create a Three Card Poker plugin instance."""
    return ThreeCardPokerPlugin(game_config)