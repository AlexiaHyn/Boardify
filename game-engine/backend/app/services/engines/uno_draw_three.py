"""
Plugin for UNO Draw 3 - UNO variant where you draw 3 cards when you can't play.

This game uses standard UNO rules with one key modification:
- When a player cannot play any card, they must draw 3 cards instead of 1
- After drawing, they can immediately play one of the drawn cards if playable
"""

from app.services.engines.game_plugin_base import GamePluginBase
from app.models.game import GameState, Player, Card, LogEntry
from app.services.engines.universal import _draw_n


class UnoDrawThreePlugin(GamePluginBase):
    """Plugin for UNO Draw 3 variant."""
    
    def __init__(self, game_config):
        super().__init__(game_config)
        self.game_config = game_config
    
    def on_game_start(self, state: GameState) -> None:
        """Initialize game-specific state when game starts."""
        # Track if a player just drew 3 cards (for immediate play check)
        if not hasattr(state, 'plugin_data'):
            state.plugin_data = {}
        state.plugin_data['just_drew_three'] = {}
        
        # Add game start log
        state.log.append(LogEntry(
            player_name="System",
            action="game_start",
            message="UNO Draw 3 game started! Draw 3 cards when you can't play.",
            timestamp=state.created_at
        ))
    
    def on_turn_start(self, state: GameState, current_player: Player) -> None:
        """Reset draw-three flag at start of each turn."""
        if hasattr(state, 'plugin_data') and 'just_drew_three' in state.plugin_data:
            state.plugin_data['just_drew_three'][current_player.id] = False
    
    def on_draw_cards(self, state: GameState, player: Player, cards_drawn: list[Card], reason: str) -> None:
        """Track when a player draws 3 cards due to no playable cards."""
        if reason == "no_playable_cards" and len(cards_drawn) == 3:
            # Mark that this player just drew 3 cards
            if not hasattr(state, 'plugin_data'):
                state.plugin_data = {}
            if 'just_drew_three' not in state.plugin_data:
                state.plugin_data['just_drew_three'] = {}
            state.plugin_data['just_drew_three'][player.id] = True
            
            # Add log entry
            state.log.append(LogEntry(
                player_name=player.name,
                action="draw_three",
                message=f"{player.name} had no playable cards and drew 3 cards",
                timestamp=state.created_at
            ))
    
    def validate_turn_end(self, state: GameState, current_player: Player) -> tuple[bool, str]:
        """
        Validate that turn can end - in UNO Draw 3, if player just drew 3 cards
        and has a playable card among them, they should play it.
        """
        # Check if player just drew 3 cards
        just_drew = (hasattr(state, 'plugin_data') and 
                    'just_drew_three' in state.plugin_data and
                    state.plugin_data['just_drew_three'].get(current_player.id, False))
        
        if just_drew:
            # Check if any of the cards in hand are now playable
            from app.services.engines.universal import _is_card_playable
            
            discard_pile = state.zones.get('discard_pile', [])
            if not discard_pile:
                return True, ""
                
            top_card = discard_pile[-1]
            current_color = getattr(state, 'current_color', top_card.metadata.get('color', 'wild'))
            
            # Check if player has any playable cards
            for card in current_player.hand:
                if _is_card_playable(card, top_card, current_color, self.game_config):
                    return False, "You must play a card if you have one that matches after drawing 3 cards."
        
        return True, ""


def create_plugin(game_config):
    """Factory function to create the plugin instance."""
    return UnoDrawThreePlugin(game_config)