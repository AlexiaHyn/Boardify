"""
Exploding Kittens Plugin
=========================
Game-specific customizations for Exploding Kittens.

Key mechanics handled by this plugin:
- Drawing exploding kittens (elimination or defuse)
- Bomb reinsertion after defusing
- Attack stacking (forces next player to draw multiple times)
- Skip (ends turn without drawing, cancels attack)
- Turn flow: Players can play multiple cards before drawing

CRITICAL: In Exploding Kittens, playing cards does NOT end your turn!
- ✅ Players can play as many cards as they want
- ✅ Turn only ends when: drawing a card, playing Skip, or playing Attack
- ❌ Playing Shuffle, Favor, etc. does NOT end turn

This is different from UNO where playing a card ends your turn.

Everything else (setup, basic card effects) is handled by universal.py.
"""
from __future__ import annotations

import random
from typing import Any, Dict, List, Optional, Tuple

from app.models.game import Card, GameState, Player
from app.services.engines.game_plugin_base import GamePluginBase
from app.services.engines.universal import (
    _log, _active, _draw_zone, _discard_zone, _get_player,
    EFFECT_HANDLERS,
)


class ExplodingKittensPlugin(GamePluginBase):
    """
    Exploding Kittens-specific game logic plugin.

    Universal.py handles standard setup and turn flow.
    This plugin adds:
    - Custom draw_card action (handles exploding/defusing)
    - Custom insert_exploding action (bomb reinsertion)
    - Custom attack/skip effects (attack stacking)
    """

    def __init__(self, game_id: str, game_config: Dict[str, Any]):
        super().__init__(game_id, game_config)

    # -------------------------------------------------------------------------
    # Custom Actions
    # -------------------------------------------------------------------------

    def get_custom_actions(self) -> Dict[str, callable]:
        """Return custom action handlers for Exploding Kittens."""
        return {
            "play_card": self._handle_play_card,
            "draw_card": self._handle_draw_card,
            "insert_exploding": self._handle_insert_exploding,
            "give_card": self._handle_give_card,
            "nope": self._handle_nope,
            "resolve_nope_window": self._handle_resolve_nope_window,
        }

    # -------------------------------------------------------------------------
    # Custom Effects
    # -------------------------------------------------------------------------

    def get_custom_effects(self) -> Dict[str, callable]:
        """
        Return custom effect handlers for Exploding Kittens.

        IMPORTANT: All effects return halt_turn_advance=True because
        in EK, only drawing, Skip, or Attack ends your turn.
        """
        return {
            "attack": self._effect_attack,
            "skip": self._effect_skip,
            "give": self._effect_give,
            "shuffle": self._effect_shuffle,
            "peek": self._effect_peek,
            "steal": self._effect_steal,
        }

    # -------------------------------------------------------------------------
    # Action Handlers
    # -------------------------------------------------------------------------

    def _handle_play_card(self, state: GameState, action) -> Tuple[bool, str, List[str]]:
        """
        Custom play_card for Exploding Kittens with Nope window support.

        Instead of immediately executing card effects, this creates a
        'nope_window' pending action. Other players can play Nope to cancel
        the card, or someone can click 'Continue' to resolve the effects.

        Cards that skip the nope window:
        - Nope cards (handled by the 'nope' action type)
        """
        player = _get_player(state, action.playerId)
        if not player:
            return False, "Player not found", []
        if state.currentTurnPlayerId != player.id:
            return False, "Not your turn", []
        if state.phase not in ("playing",):
            return False, "Cannot play a card right now", []

        card = next((c for c in player.hand.cards if c.id == action.cardId), None)
        if not card:
            return False, "Card not in hand", []

        # Handle combo pair: validate and remove the second card too
        combo_pair_id = (action.metadata or {}).get("comboPairId")
        combo_pair_card = None
        if combo_pair_id:
            combo_pair_card = next(
                (c for c in player.hand.cards if c.id == combo_pair_id and c.id != card.id),
                None,
            )
            if not combo_pair_card:
                return False, "Combo pair card not in hand", []
            if combo_pair_card.subtype != card.subtype:
                return False, "Combo pair cards must match", []

        # Move card(s) from hand to discard
        player.hand.cards.remove(card)
        discard = _discard_zone(state)
        if discard:
            discard.cards.insert(0, card)
        if combo_pair_card:
            player.hand.cards.remove(combo_pair_card)
            if discard:
                discard.cards.insert(0, combo_pair_card)

        # Log the play
        if combo_pair_card:
            state.log.append(_log(
                f"{player.name} played {card.name} combo! Waiting for Nopes...",
                "action", player.id, card.id,
            ))
        else:
            state.log.append(_log(
                f"{player.name} played {card.name}! Waiting for Nopes...",
                "action", player.id, card.id,
            ))

        # Create nope window - pause before applying effects
        state.phase = "awaiting_response"
        state.pendingAction = {
            "type": "nope_window",
            "playerId": player.id,
            "cardId": card.id,
            "card": card.model_dump(),
            "cardName": card.name,
            "effects": [eff.dict() for eff in card.effects],
            "originalAction": {
                "playerId": action.playerId,
                "cardId": action.cardId,
                "targetPlayerId": getattr(action, "targetPlayerId", None),
                "metadata": getattr(action, "metadata", None) or {},
            },
            "nopeCount": 0,
        }

        return True, "", [f"nope_window:{card.subtype}"]

    def _handle_resolve_nope_window(self, state: GameState, action) -> Tuple[bool, str, List[str]]:
        """
        Resolve a nope window after the countdown expires.

        Checks the final nopeCount to decide:
        - Even (0, 2, 4, ...): action goes through → execute effects
        - Odd (1, 3, 5, ...): action was Noped → cancel without effects
        """
        pending = state.pendingAction
        if not pending or pending.get("type") != "nope_window":
            return False, "No nope window to resolve", []

        card_data = pending["card"]
        effects = pending["effects"]
        original_action = pending["originalAction"]
        card_player_id = pending["playerId"]
        nope_count = pending.get("nopeCount", 0)
        card_name = pending.get("cardName", "action")

        # Clear the pending action in all cases
        state.pendingAction = None
        state.phase = "playing"

        # If odd number of Nopes → action is cancelled
        if nope_count % 2 == 1:
            state.log.append(_log(
                f"{card_name} was cancelled by Nope!",
                "system",
            ))
            # Turn stays with the original card player (they wasted their card
            # but still need to play more cards or draw)
            return True, "", ["noped", "nope_resolved"]

        # Even Nopes (including 0) → action goes through
        card = Card(**card_data)
        player = _get_player(state, card_player_id)
        if not player:
            return False, "Player not found", []

        if nope_count == 0:
            state.log.append(_log(
                f"No Nope! {card.name} takes effect.",
                "system",
            ))
        else:
            state.log.append(_log(
                f"After {nope_count} Nopes, {card.name} takes effect!",
                "system",
            ))

        # Execute each effect (same logic as universal._action_play_card)
        triggered: List[str] = [f"played:{card.subtype}"]

        for eff in effects:
            etype = eff["type"]

            # Check plugin custom effects first
            handler = self.get_custom_effects().get(etype)

            # Fall back to universal effect handlers
            if handler is None:
                handler = EFFECT_HANDLERS.get(etype)

            if handler is None:
                continue

            # Build a mock action with original action data
            class _ActionProxy:
                def __init__(self, data):
                    self.playerId = data.get("playerId")
                    self.cardId = data.get("cardId")
                    self.targetPlayerId = data.get("targetPlayerId")
                    self.metadata = data.get("metadata", {})

            proxy_action = _ActionProxy(original_action)

            try:
                result = handler(state, player, card, eff, proxy_action, triggered)
            except Exception as e:
                print(f"Error in effect handler for {etype}: {e}")
                import traceback
                traceback.print_exc()
                continue

            if result is None:
                continue
            # Handle needs_target (e.g. Favor without a pre-selected target)
            if result.get("needs_target"):
                state.phase = "awaiting_response"
                state.pendingAction = {
                    "type": result.get("pending_type", "select_target"),
                    "playerId": player.id,
                    "cardId": card.id,
                }
                return True, "", triggered

        if state.phase == "ended":
            return True, "", triggered

        return True, "", triggered

    def _handle_draw_card(self, state: GameState, action) -> Tuple[bool, str, List[str]]:
        """
        Custom draw action for Exploding Kittens.

        In EK, drawing ends your turn. If you draw an exploding kitten:
        - With defuse: discard defuse, reinsert bomb
        - Without defuse: eliminated
        """
        player = _get_player(state, action.playerId)
        if not player:
            return False, "Player not found", []
        if state.currentTurnPlayerId != player.id:
            return False, "Not your turn", []

        draw = _draw_zone(state)
        discard = _discard_zone(state)
        if not draw or not draw.cards:
            return False, "Draw pile is empty", []

        triggered: List[str] = []
        drawn = draw.cards.pop(0)

        if drawn.subtype == "exploding":
            # Check for defuse card
            defuse = next((c for c in player.hand.cards if c.subtype == "defuse"), None)
            if defuse:
                # Defused! Player must choose where to reinsert the bomb
                player.hand.cards.remove(defuse)
                discard.cards.insert(0, defuse)
                state.log.append(_log(
                    f"💥 {player.name} drew an Exploding Kitten… and Defused it! 😅",
                    "effect", player.id
                ))
                triggered.append("defused")

                # Enter awaiting_response for bomb reinsertion
                state.phase = "awaiting_response"
                state.pendingAction = {
                    "type": "insert_exploding",
                    "playerId": player.id,
                    "card": drawn.model_dump(),
                    "deckSize": len(draw.cards),
                }
                return True, "", triggered
            else:
                # No defuse - eliminated!
                player.status = "eliminated"
                discard.cards.insert(0, drawn)
                state.log.append(_log(f"💥 {player.name} EXPLODED! 😱", "effect", player.id))
                triggered.append("exploded")

                # Check for winner
                active = _active(state)
                if len(active) == 1:
                    winner = active[0]
                    winner.status = "winner"
                    state.winner = winner
                    state.phase = "ended"
                    state.log.append(_log(f"🎉 {winner.name} wins!", "system"))
                    return True, "", triggered

                # Advance turn (skip eliminated player)
                self._advance_turn_with_attacks(state)
        else:
            # Normal card - add to hand and end turn
            player.hand.cards.append(drawn)
            state.log.append(_log(f"{player.name} drew a card.", "action", player.id))
            self._advance_turn_with_attacks(state)

        return True, "", triggered

    def _handle_insert_exploding(self, state: GameState, action) -> Tuple[bool, str, List[str]]:
        """
        Handle bomb reinsertion after defusing.
        Player chooses position in deck to insert the bomb.
        """
        if state.phase != "awaiting_response":
            return False, "No pending insert action", []
        pending = state.pendingAction
        if not pending or pending.get("type") != "insert_exploding":
            return False, "No pending insert action", []
        if action.playerId != pending["playerId"]:
            return False, "Not your action", []

        draw = _draw_zone(state)
        bomb_card = Card(**pending["card"])
        pos = action.metadata.get("position", random.randint(0, len(draw.cards)))
        pos = max(0, min(pos, len(draw.cards)))
        draw.cards.insert(pos, bomb_card)

        state.pendingAction = None
        state.phase = "playing"
        state.log.append(_log(
            f"🔧 {pending['playerId']} reinserted the Exploding Kitten into the deck.", "system"
        ))

        # End turn after reinserting
        self._advance_turn_with_attacks(state)
        return True, "", ["bomb_inserted"]

    def _handle_give_card(self, state: GameState, action) -> Tuple[bool, str, List[str]]:
        """
        Handle Favor card resolution.
        Target player gives a card to the requester.

        IMPORTANT: In EK, this does NOT end the requester's turn!
        They can continue playing cards or draw.

        Convention (matching universal.py):
        - pending["playerId"]: requester (who played Favor)
        - pending["targetPlayerId"]: giver (who should give card)
        """
        pending = state.pendingAction
        if not pending or pending.get("type") != "favor":
            return False, "No favor pending", []

        # Verify the action is from the target player (the giver)
        if action.playerId != pending["targetPlayerId"]:
            return False, "Not your action", []

        giver = _get_player(state, pending["targetPlayerId"])
        receiver = _get_player(state, pending["playerId"])
        if not giver or not receiver:
            return False, "Player not found", []

        card_id = action.metadata.get("cardId") or action.cardId
        card = next((c for c in giver.hand.cards if c.id == card_id), None)
        if not card:
            # Auto-pick random card if no specific card chosen
            if not giver.hand.cards:
                return False, "No cards to give", []
            card = random.choice(giver.hand.cards)

        # Transfer the card
        giver.hand.cards.remove(card)
        receiver.hand.cards.append(card)

        # Clear pending action and return to playing phase
        state.pendingAction = None
        state.phase = "playing"

        state.log.append(_log(
            f"🎁 {giver.name} gave a card to {receiver.name}.",
            "effect", giver.id,
        ))

        # CRITICAL: Do NOT advance turn!
        # The receiver (who played Favor) continues their turn
        # They haven't drawn yet!

        return True, "", ["give_resolved"]

    def _handle_nope(self, state: GameState, action) -> Tuple[bool, str, List[str]]:
        """
        Handle Nope card to cancel actions.

        Nope can cancel any action except Exploding Kitten or Defuse.
        Nopes can be chained — you can Nope a Nope!

        The nope window stays alive throughout the entire chain. Each Nope
        increments `nopeCount` on the pending action. The countdown resets
        on the frontend so other players can counter-Nope. Final resolution
        happens when the countdown expires (resolve_nope_window):
        - Odd nopeCount → action is cancelled
        - Even nopeCount → effects are applied

        IMPORTANT: Playing Nope does NOT end your turn if it's your turn.
        Nope is a reaction card that can be played during other players' turns.
        """
        player = _get_player(state, action.playerId)
        if not player:
            return False, "Player not found", []

        # Find the specific Nope card (use cardId from action if provided)
        card_id = getattr(action, "cardId", None)
        if card_id:
            nope_card = next((c for c in player.hand.cards if c.id == card_id and c.subtype == "nope"), None)
        else:
            nope_card = next((c for c in player.hand.cards if c.subtype == "nope"), None)
        if not nope_card:
            return False, "No Nope card in hand", []

        # Check if there's something to Nope
        pending = state.pendingAction
        if not pending:
            return False, "Nothing to Nope", []

        # Cannot Nope Exploding Kitten resolution or bomb reinsertion
        un_nopeable = ["insert_exploding"]
        if pending.get("type") in un_nopeable:
            return False, "Cannot Nope this action", []

        # Remove Nope card from hand and discard it
        player.hand.cards.remove(nope_card)
        discard = _discard_zone(state)
        if discard:
            discard.cards.insert(0, nope_card)

        # Increment the Nope chain count — keep the nope window alive
        nope_count = pending.get("nopeCount", 0)
        nope_count += 1
        pending["nopeCount"] = nope_count
        pending["lastNoper"] = player.id

        card_name = pending.get("cardName", pending.get("type", "action"))

        state.log.append(_log(
            f"🚫 {player.name} played Nope!",
            "action", player.id, nope_card.id
        ))

        if nope_count % 2 == 1:
            # Odd nopes: action is currently cancelled
            # But keep the window open so someone can counter-Nope!
            state.log.append(_log(
                f"{card_name} is Noped! Play another Nope to counter...",
                "system"
            ))
            return True, "", ["noped"]
        else:
            # Even nopes: Nope was counter-Noped, action back on
            state.log.append(_log(
                f"The Nope was Noped! {card_name} is back on.",
                "system"
            ))
            return True, "", ["nope_noped"]

    # -------------------------------------------------------------------------
    # Effect Handlers
    # -------------------------------------------------------------------------

    def _effect_skip(self, state, player, card, effect, action, triggered):
        """
        Skip: End turn without drawing.
        If under attack, cancels one attack turn.
        """
        # Ensure card.id is not None
        card_id = card.id if card and hasattr(card, 'id') else None
        state.log.append(_log(f"{player.name} played Skip ⏭️", "action", player.id, card_id))

        # Cancel one attack if under attack
        attacks = state.metadata.get("attacks_pending", 0) or 0
        if attacks > 0:
            state.metadata["attacks_pending"] = attacks - 1

        triggered.append("skipped")

        # Ensure turnNumber is initialized
        if state.turnNumber is None:
            state.turnNumber = 0

        # Advance turn manually (Skip ends your turn)
        self._advance_turn_with_attacks(state)

        # Tell universal.py we handled turn advancement
        return {"halt_turn_advance": True}

    def _effect_attack(self, state, player, card, effect, action, triggered):
        """
        Attack: End turn without drawing, next player draws TWICE.
        Attacks stack - if already under attack, adds to the count.
        """
        # Ensure turnNumber is initialized
        if state.turnNumber is None:
            state.turnNumber = 0

        # First advance to next player
        active = _active(state)
        if not active:
            return {"halt_turn_advance": True}

        ids = [p.id for p in active]
        try:
            idx = ids.index(state.currentTurnPlayerId)
        except ValueError:
            idx = -1

        nxt = active[(idx + 1) % len(active)]
        for p in state.players:
            p.isCurrentTurn = p.id == nxt.id
        state.currentTurnPlayerId = nxt.id
        state.turnNumber += 1

        # Then add 2 draws to the new current player
        current_attacks = state.metadata.get("attacks_pending", 0) or 0
        state.metadata["attacks_pending"] = current_attacks + 2

        card_id = card.id if card and hasattr(card, 'id') else None
        state.log.append(_log(
            f"⚔️ {player.name} played Attack! {nxt.name} must draw {state.metadata['attacks_pending']} times.",
            "action", player.id, card_id
        ))
        triggered.append("attacked")

        # Tell universal.py we handled turn advancement
        return {"halt_turn_advance": True}

    def _effect_give(self, state, player, card, effect, action, triggered):
        """
        Favor: Force another player to give you a card.

        Sets up pending action matching universal.py convention:
        - playerId: requester (who played Favor)
        - targetPlayerId: giver (who should respond)
        """
        # Get target player from action
        tid = action.targetPlayerId or (action.metadata or {}).get("targetPlayerId")
        target = _get_player(state, tid) if tid else None

        if not target:
            # Need to select target first
            return {"needs_target": True, "pending_type": "give"}

        if not target.hand.cards:
            state.log.append(_log(
                f"{player.name} played Favor but {target.name} has no cards.", "action"
            ))
            return {"halt_turn_advance": True}

        state.log.append(_log(
            f"🙏 {player.name} asks {target.name} for a card.",
            "action", player.id, card.id,
        ))

        # Set up pending action (using universal.py convention)
        # Frontend checks targetPlayerId to determine who should respond
        state.phase = "awaiting_response"
        state.pendingAction = {
            "type": "favor",
            "playerId": player.id,      # Requester (who played Favor)
            "targetPlayerId": target.id, # Responder (who should give card)
        }
        triggered.append("give_pending")

        # Don't advance turn - requester continues their turn after receiving card
        return {"halt_turn_advance": True}

    def _effect_shuffle(self, state, player, card, effect, action, triggered):
        """
        Shuffle: Shuffle the draw pile.

        IMPORTANT: Does NOT end turn in EK!
        """
        draw = _draw_zone(state)
        if draw:
            random.shuffle(draw.cards)

        state.log.append(_log(
            f"🔀 {player.name} shuffled the deck.",
            "action", player.id, card.id
        ))
        triggered.append("shuffled")

        # Don't advance turn - player can continue playing
        return {"halt_turn_advance": True}

    def _effect_peek(self, state, player, card, effect, action, triggered):
        """
        See the Future: Peek at top 3 cards.

        IMPORTANT: Does NOT end turn in EK!
        """
        n = effect.get("value", 3)
        draw = _draw_zone(state)

        if draw and draw.cards:
            # Get the top N cards
            top_cards = draw.cards[:n]

            # Store full card information in player metadata for frontend display
            player.metadata["peekedCards"] = [c.model_dump() for c in top_cards]

            # Also store card names for logging
            top_n_names = [c.name for c in top_cards]

            state.log.append(_log(
                f"🔮 {player.name} peeked at the top {n} cards.",
                "action", player.id, card.id
            ))
            triggered.append(f"top{n}:{','.join(top_n_names)}")
        else:
            state.log.append(_log(
                f"🔮 {player.name} tried to peek but the deck is empty.",
                "action", player.id, card.id
            ))

        # Don't advance turn - player can continue playing
        return {"halt_turn_advance": True}

    def _effect_steal(self, state, player, card, effect, action, triggered):
        """
        Cat Combo: Steal a random card from another player.

        IMPORTANT: Does NOT end turn in EK!
        """
        tid = action.targetPlayerId or (action.metadata or {}).get("targetPlayerId")
        target = _get_player(state, tid) if tid else None

        if not target or not target.hand.cards:
            state.log.append(_log(
                f"{player.name} played a combo but target has no cards.", "action"
            ))
            return {"halt_turn_advance": True}

        # Steal random card
        stolen = random.choice(target.hand.cards)
        target.hand.cards.remove(stolen)
        player.hand.cards.append(stolen)

        state.log.append(_log(
            f"🐱 {player.name} stole a card from {target.name}!",
            "action", player.id, card.id
        ))
        triggered.append(f"stolen:{target.id}")

        # Don't advance turn - player can continue playing
        return {"halt_turn_advance": True}

    # -------------------------------------------------------------------------
    # Turn Management
    # -------------------------------------------------------------------------

    def _advance_turn_with_attacks(self, state: GameState):
        """
        Advance turn, respecting attack stacks.
        If player has pending attacks, decrement but keep their turn.
        Otherwise, advance to next player.
        """
        # Ensure turnNumber is initialized
        if state.turnNumber is None:
            state.turnNumber = 0

        attacks = state.metadata.get("attacks_pending", 0) or 0

        if attacks > 0:
            # Decrement first
            attacks -= 1
            state.metadata["attacks_pending"] = attacks

            if attacks > 0:
                # Player still has more draws to make
                return  # Don't change current player
            # If attacks is now 0, fall through to advance turn

        # Normal turn advancement
        active = _active(state)
        if not active:
            return

        ids = [p.id for p in active]
        try:
            idx = ids.index(state.currentTurnPlayerId)
        except ValueError:
            idx = -1

        nxt = active[(idx + 1) % len(active)]
        for p in state.players:
            p.isCurrentTurn = p.id == nxt.id
        state.currentTurnPlayerId = nxt.id
        state.turnNumber += 1

    # -------------------------------------------------------------------------
    # Lifecycle Hooks
    # -------------------------------------------------------------------------

    def on_game_start(self, state: GameState) -> None:
        """Initialize attack tracking metadata."""
        state.metadata["attacks_pending"] = 0

    def on_card_played(self, state: GameState, player: Player, card: Card) -> Optional[Dict[str, Any]]:
        """
        Called when a card is played.

        IMPORTANT: In Exploding Kittens, playing cards does NOT end your turn.
        Players can play as many cards as they want before drawing.
        Only drawing, Skip, or Attack ends your turn.

        Return metadata to prevent universal.py from advancing turn automatically.
        """
        # Prevent automatic turn advancement for ALL cards
        # Turn only advances when:
        # 1. Player draws a card (handled in _handle_draw_card)
        # 2. Player plays Skip (handled in _effect_skip)
        # 3. Player plays Attack (handled in _effect_attack)
        return {"halt_turn_advance": True}


# Factory function to create plugin instance
def create_plugin(game_config: Dict[str, Any]) -> ExplodingKittensPlugin:
    """Create and return an Exploding Kittens plugin instance."""
    return ExplodingKittensPlugin("exploding_kittens", game_config)
