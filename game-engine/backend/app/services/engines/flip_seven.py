"""
Flip Seven Game Plugin

A card game where players try to collect seven unique numbers or score points without busting.
Players take turns deciding to "hit" (draw another card) or "stay" (bank their score).
Busting occurs when drawing a duplicate number card.
"""

from typing import List, Optional, Dict, Any
from app.services.engines.game_plugin_base import GamePluginBase
from app.models.game import GameState, Player, Card, LogEntry


class FlipSevenPlugin(GamePluginBase):
    """Game plugin for Flip Seven"""
    
    def __init__(self, config: dict):
        self.config = config
        
    def on_game_start(self, game_state: GameState) -> List[LogEntry]:
        """Initialize game state for Flip Seven"""
        logs = []
        
        # Initialize player metadata
        for player in game_state.players:
            player.metadata.update({
                'totalScore': 0,
                'roundScore': 0,
                'playerStatus': 'active',
                'uniqueNumbers': [],
                'modifiers': [],
                'hasMultiplier': False,
                'awaitingTarget': False,
                'availableTargets': []
            })
        
        # Initialize game metadata
        game_state.metadata.update({
            'round': 1,
            'dealer': game_state.players[0].id,
            'dealerIndex': 0,
            'roundEnded': False,
            'flipSevenPlayer': None
        })
        
        logs.append(LogEntry(
            type='game_start',
            message=f"Flip Seven started! {game_state.players[0].name} is the dealer.",
            metadata={'dealer': game_state.players[0].name}
        ))
        
        return logs
    
    def on_card_drawn(self, game_state: GameState, player: Player, card: Card) -> List[LogEntry]:
        """Handle card drawing logic including bust detection and special cards"""
        logs = []
        
        # Handle different card types
        if card.subtype == 'number':
            number = card.metadata.get('number', 0)
            player_numbers = player.metadata.get('uniqueNumbers', [])
            
            # Check for bust (duplicate number)
            if number in player_numbers:
                # Check if player has Second Chance cards
                second_chance_cards = [c for c in player.hand if c.subtype == 'second_chance']
                if second_chance_cards:
                    # Use Second Chance to avoid bust
                    second_chance = second_chance_cards[0]
                    player.hand.remove(second_chance)
                    game_state.discard_pile.append(card)  # Discard the duplicate
                    
                    logs.append(LogEntry(
                        type='special_effect',
                        player_id=player.id,
                        message=f"{player.name} used Second Chance to avoid busting!",
                        metadata={'card': 'second_chance', 'avoided_bust': True}
                    ))
                else:
                    # Player busts
                    self._bust_player(game_state, player)
                    logs.append(LogEntry(
                        type='bust',
                        player_id=player.id,
                        message=f"{player.name} busted with duplicate number {number}!",
                        metadata={'number': number, 'busted': True}
                    ))
            else:
                # Add unique number
                player_numbers.append(number)
                player.metadata['uniqueNumbers'] = player_numbers
                
                # Check for Flip Seven (exactly 7 unique numbers)
                if len(player_numbers) == 7:
                    game_state.metadata['flipSevenPlayer'] = player.id
                    game_state.metadata['roundEnded'] = True
                    
                    logs.append(LogEntry(
                        type='flip_seven',
                        player_id=player.id,
                        message=f"{player.name} achieved Flip Seven! +15 bonus points!",
                        metadata={'flip_seven': True, 'bonus': 15}
                    ))
                    
                    # End round immediately
                    return logs + self._end_round(game_state)
        
        elif card.subtype == 'modifier':
            # Add modifier to player's collection
            modifiers = player.metadata.get('modifiers', [])
            modifiers.append(card.metadata.get('bonus', 0))
            player.metadata['modifiers'] = modifiers
            
        elif card.subtype == 'multiplier':
            player.metadata['hasMultiplier'] = True
            
        elif card.subtype in ['freeze', 'flip_three']:
            # Action cards require target selection
            active_players = [p for p in game_state.players if p.metadata.get('playerStatus') == 'active']
            available_targets = []
            
            if len(active_players) == 1:
                # Must target self if only active player
                available_targets = [player.id]
            else:
                # Can target any active player
                available_targets = [p.id for p in active_players]
            
            player.metadata['awaitingTarget'] = True
            player.metadata['availableTargets'] = available_targets
            player.metadata['pendingActionCard'] = card.id
            
            logs.append(LogEntry(
                type='action_card',
                player_id=player.id,
                message=f"{player.name} drew {card.name} - choose a target!",
                metadata={'card': card.id, 'requires_target': True}
            ))
        
        return logs
    
    def on_turn_end(self, game_state: GameState, player: Player) -> List[LogEntry]:
        """Check if round should end after turn"""
        logs = []
        
        # Check if all players have busted or stayed
        active_players = [p for p in game_state.players if p.metadata.get('playerStatus') == 'active']
        if not active_players and not game_state.metadata.get('roundEnded', False):
            game_state.metadata['roundEnded'] = True
            logs.extend(self._end_round(game_state))
        
        return logs
    
    def get_custom_actions(self) -> List[Dict[str, Any]]:
        """Return custom actions specific to Flip Seven"""
        return [
            {
                'id': 'resolve_action_card',
                'handler': self._resolve_action_card,
                'requires_target': True
            }
        ]
    
    def _resolve_action_card(self, game_state: GameState, player: Player, target_id: str, **kwargs) -> List[LogEntry]:
        """Resolve action card effects on target player"""
        logs = []
        
        pending_card = player.metadata.get('pendingActionCard')
        if not pending_card:
            return logs
        
        target_player = next((p for p in game_state.players if p.id == target_id), None)
        if not target_player:
            return logs
        
        # Clear awaiting target state
        player.metadata['awaitingTarget'] = False
        player.metadata['availableTargets'] = []
        player.metadata['pendingActionCard'] = None
        
        if pending_card == 'freeze':
            # Force target to stay
            if target_player.metadata.get('playerStatus') == 'active':
                target_player.metadata['playerStatus'] = 'stayed'
                self._calculate_player_score(target_player)
                
                logs.append(LogEntry(
                    type='forced_stay',
                    player_id=target_id,
                    message=f"{target_player.name} was frozen and must stay!",
                    metadata={'forced': True, 'score': target_player.metadata.get('roundScore', 0)}
                ))
        
        elif pending_card == 'flip_three':
            # Target draws 3 cards sequentially
            logs.append(LogEntry(
                type='flip_three_start',
                player_id=target_id,
                message=f"{target_player.name} will flip 3 cards!",
                metadata={'cards_to_flip': 3}
            ))
            
            # This would be handled by the universal engine's draw mechanism
            # The plugin just logs the start of the effect
        
        return logs
    
    def _bust_player(self, game_state: GameState, player: Player):
        """Handle player busting"""
        player.metadata['playerStatus'] = 'busted'
        player.metadata['roundScore'] = 0
        # Keep cards face down but in front of player (don't return to deck)
        
    def _calculate_player_score(self, player: Player):
        """Calculate player's score for the round"""
        if player.metadata.get('playerStatus') == 'busted':
            player.metadata['roundScore'] = 0
            return
        
        # Sum number cards
        numbers = player.metadata.get('uniqueNumbers', [])
        number_sum = sum(numbers)
        
        # Apply multiplier if present (only to number sum)
        if player.metadata.get('hasMultiplier', False):
            number_sum *= 2
        
        # Add modifiers
        modifiers = player.metadata.get('modifiers', [])
        modifier_sum = sum(modifiers)
        
        # Add Flip Seven bonus if applicable
        flip_seven_bonus = 0
        if len(numbers) == 7:
            flip_seven_bonus = 15
        
        total_score = number_sum + modifier_sum + flip_seven_bonus
        player.metadata['roundScore'] = total_score
        
    def _end_round(self, game_state: GameState) -> List[LogEntry]:
        """End the current round and calculate scores"""
        logs = []
        
        # Calculate scores for all non-busted players
        for player in game_state.players:
            if player.metadata.get('playerStatus') != 'busted':
                self._calculate_player_score(player)
            
            # Add round score to total
            round_score = player.metadata.get('roundScore', 0)
            total_score = player.metadata.get('totalScore', 0)
            player.metadata['totalScore'] = total_score + round_score
            
            if round_score > 0:
                logs.append(LogEntry(
                    type='round_score',
                    player_id=player.id,
                    message=f"{player.name} scored {round_score} points this round (Total: {player.metadata['totalScore']})",
                    metadata={'round_score': round_score, 'total_score': player.metadata['totalScore']}
                ))
        
        # Check for winner
        winner = None
        max_score = 0
        tied_players = []
        
        for player in game_state.players:
            total = player.metadata.get('totalScore', 0)
            if total >= 200:
                if total > max_score:
                    max_score = total
                    winner = player
                    tied_players = [player]
                elif total == max_score:
                    tied_players.append(player)
        
        if winner and len(tied_players) == 1:
            # Single winner
            game_state.metadata['winner'] = winner.id
            game_state.metadata['game_over'] = True
            
            logs.append(LogEntry(
                type='game_end',
                player_id=winner.id,
                message=f"🎉 {winner.name} wins with {max_score} points!",
                metadata={'winner': True, 'final_score': max_score}
            ))
        else:
            # Continue to next round
            self._start_new_round(game_state)
            logs.append(LogEntry(
                type='new_round',
                message=f"Round {game_state.metadata['round']} begins!",
                metadata={'round': game_state.metadata['round']}
            ))
        
        return logs
    
    def _start_new_round(self, game_state: GameState):
        """Start a new round"""
        # Increment round
        game_state.metadata['round'] = game_state.metadata.get('round', 1) + 1
        
        # Rotate dealer clockwise
        dealer_index = (game_state.metadata.get('dealerIndex', 0) + 1) % len(game_state.players)
        game_state.metadata['dealerIndex'] = dealer_index
        game_state.metadata['dealer'] = game_state.players[dealer_index].id
        
        # Reset player states for new round
        for player in game_state.players:
            player.metadata.update({
                'playerStatus': 'active',
                'roundScore': 0,
                'uniqueNumbers': [],
                'modifiers': [],
                'hasMultiplier': False,
                'awaitingTarget': False,
                'availableTargets': []
            })
        
        # Reset round flags
        game_state.metadata['roundEnded'] = False
        game_state.metadata['flipSevenPlayer'] = None


def create_plugin(game_config: dict) -> FlipSevenPlugin:
    """Factory function to create a FlipSevenPlugin instance"""
    return FlipSevenPlugin(game_config)