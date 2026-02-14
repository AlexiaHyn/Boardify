// ==========================================================================
// I. GAME BLUEPRINT LAYER — Static Definition
// ==========================================================================

// ── 1. Game Blueprint ─────────────────────────────────────────────────────

export interface PlayerConfig {
	min_players: number;
	max_players: number;
}

export interface InformationModel {
	randomness_model: string; // e.g. "deterministic seed", "true random"
	public_knowledge_rules: string[];
}

export interface GameBlueprint {
	game_id: string;
	name: string;
	description: string;
	player_config: PlayerConfig;
	information_model: InformationModel;
}

// ── 2. Setup Blueprint ────────────────────────────────────────────────────

export interface CardPoolEntry {
	card_id: string;
	count: number;
}

export interface DeckComposition {
	deck_name: string;
	card_pool: CardPoolEntry[];
	shuffle_policy: string; // e.g. "shuffle", "ordered", "player choice"
}

export interface PlayerInitialization {
	initial_hand_size: number;
	hand_composition: string; // e.g. "random from deck", "specific cards"
	starting_attributes: Record<string, number>;
}

export interface StartingTurn {
	starting_player_rule: string;
	initial_turn_direction: string; // "clockwise" | "counterclockwise" | "random"
	pre_game_actions: string[];
}

export interface ZoneInit {
	zone_id: string;
	zone_type: string; // "deck" | "discard" | "hand" | "play" | "custom"
	owner: string; // "global" | "player"
	initial_cards: string; // description of initial card placement
}

export interface SetupBlueprint {
	deck_compositions: DeckComposition[];
	player_initialization: PlayerInitialization;
	starting_turn: StartingTurn;
	zone_initialization: ZoneInit[];
}

// ── 3. Turn Model Blueprint ───────────────────────────────────────────────

export interface TurnOrderLogic {
	direction: string;
	reverse_handling: string;
	extra_turn_rule: string;
	skip_rule: string;
}

export interface ActionPolicy {
	max_actions_per_turn: number;
	forced_actions: string[];
	draw_requirement_timing: string;
	end_of_turn_validation: string;
}

export interface InterruptPolicy {
	interrupt_allowed: boolean;
	who_can_react: string; // "any" | "target" | "next player"
	reaction_time_limit: number; // seconds, 0 = unlimited
}

export interface TimeoutPolicy {
	per_turn_timer: number; // seconds, 0 = unlimited
	per_reaction_timer: number;
	auto_resolve_behavior: string;
}

export interface TurnModelBlueprint {
	turn_order: TurnOrderLogic;
	action_policy: ActionPolicy;
	interrupt_policy: InterruptPolicy;
	timeout_policy: TimeoutPolicy;
}

// ── 4. Card Blueprint ─────────────────────────────────────────────────────

export interface CardVisibility {
	default_visibility: string; // "public" | "private" | "hidden"
	reveal_conditions: string[];
}

export interface PlayTiming {
	own_turn_only: boolean;
	any_turn: boolean;
	reaction_only: boolean;
	end_of_turn_triggered: boolean;
}

export interface PlayConditions {
	state_conditions: string[];
	target_requirements: string[];
	zone_requirements: string[];
	stack_requirements: string[];
}

export interface CardEffects {
	primary_effects: string[];
	secondary_effects: string[];
	triggered_effects: string[];
	passive_effects: string[];
	ongoing_effects: string[];
}

export interface StackBehavior {
	can_stack: boolean;
	cancels_previous: boolean;
	can_be_revoked: boolean;
	requires_target_confirmation: boolean;
}

export interface CardBlueprint {
	card_id: string;
	display_name: string;
	category: string;
	rule_description: string;
	art_prompt: string;
	count: number;
	visibility: CardVisibility;
	play_timing: PlayTiming;
	play_conditions: PlayConditions;
	effects: CardEffects;
	stack_behavior: StackBehavior;
	lifecycle: string; // "instant" | "persistent" | "delayed" | "conditional_expiry"
}

// ── 5. Rule Blueprint ─────────────────────────────────────────────────────

export interface RuleBlueprint {
	rule_id: string;
	name: string;
	rule_type: string; // "match_validation" | "forced_draw" | "hand_limit" | "deck_exhaustion" | "elimination" | "turn_transition" | "simultaneous_effect"
	trigger_condition: string;
	validation_logic: string;
	resulting_effect: string;
	priority_level: number;
	conflict_resolution: string;
	override_capability: boolean;
}

// ── 6. Win / Loss Blueprint ───────────────────────────────────────────────

export interface VictoryCondition {
	type: string; // "empty_hand" | "last_standing" | "score_based" | "objective_based" | "survival_based"
	description: string;
}

export interface LossCondition {
	type: string; // "explosion" | "timeout" | "illegal_move"
	description: string;
}

export interface TieHandling {
	strategy: string; // "seat_order_priority" | "sudden_death" | "shared_victory"
	description: string;
}

export interface WinLossBlueprint {
	victory_conditions: VictoryCondition[];
	loss_conditions: LossCondition[];
	tie_handling: TieHandling;
}

// ==========================================================================
// Full Game Data — the complete exported JSON
// ==========================================================================

export interface GameData {
	game: GameBlueprint;
	setup: SetupBlueprint;
	turn_model: TurnModelBlueprint;
	cards: CardBlueprint[];
	rules: RuleBlueprint[];
	win_loss: WinLossBlueprint;
	home_rules?: string;
}
