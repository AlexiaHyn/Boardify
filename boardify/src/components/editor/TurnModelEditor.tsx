"use client";

import type { TurnModelBlueprint } from "~/types/game";
import { Minus, Plus, RotateCw, Zap, Shield, Clock } from "lucide-react";
import EditableList from "~/components/ui/EditableList";

interface TurnModelEditorProps {
	turnModel: TurnModelBlueprint;
	onChange: (tm: TurnModelBlueprint) => void;
}

function Stepper({
	value,
	onChange,
	min = 0,
}: {
	value: number;
	onChange: (v: number) => void;
	min?: number;
}) {
	return (
		<div className="stepper-controls">
			<button
				type="button"
				onClick={() => onChange(Math.max(min, value - 1))}
				className="stepper-btn"
				style={{ width: 28, height: 28 }}
			>
				<Minus className="h-3 w-3" />
			</button>
			<span
				className="stepper-value"
				style={{ minWidth: 40, height: 28, fontSize: 13 }}
			>
				{value}
			</span>
			<button
				type="button"
				onClick={() => onChange(value + 1)}
				className="stepper-btn"
				style={{ width: 28, height: 28 }}
			>
				<Plus className="h-3 w-3" />
			</button>
		</div>
	);
}

export default function TurnModelEditor({
	turnModel,
	onChange,
}: TurnModelEditorProps) {
	return (
		<section className="section-panel">
			<div className="section-panel-inner space-y-0">
				{/* ── Turn Order ─────────────────────────────────── */}
				<div className="sub-section">
					<h4 className="sub-section-title">
						<RotateCw />
						Turn Order
					</h4>
					<div className="form-row">
						<div className="form-field">
							<label className="form-label">Direction</label>
							<input
								type="text"
								value={turnModel.turn_order.direction}
								onChange={(e) =>
									onChange({
										...turnModel,
										turn_order: {
											...turnModel.turn_order,
											direction: e.target.value,
										},
									})
								}
								placeholder="clockwise"
								className="form-input"
							/>
						</div>
						<div className="form-field">
							<label className="form-label">
								Reverse Handling
							</label>
							<input
								type="text"
								value={turnModel.turn_order.reverse_handling}
								onChange={(e) =>
									onChange({
										...turnModel,
										turn_order: {
											...turnModel.turn_order,
											reverse_handling: e.target.value,
										},
									})
								}
								placeholder="How are reverse cards handled?"
								className="form-input"
							/>
						</div>
					</div>
					<div className="form-row mt-3">
						<div className="form-field">
							<label className="form-label">
								Extra Turn Rule
							</label>
							<input
								type="text"
								value={turnModel.turn_order.extra_turn_rule}
								onChange={(e) =>
									onChange({
										...turnModel,
										turn_order: {
											...turnModel.turn_order,
											extra_turn_rule: e.target.value,
										},
									})
								}
								placeholder="When can a player take an extra turn?"
								className="form-input"
							/>
						</div>
						<div className="form-field">
							<label className="form-label">Skip Rule</label>
							<input
								type="text"
								value={turnModel.turn_order.skip_rule}
								onChange={(e) =>
									onChange({
										...turnModel,
										turn_order: {
											...turnModel.turn_order,
											skip_rule: e.target.value,
										},
									})
								}
								placeholder="When is a player's turn skipped?"
								className="form-input"
							/>
						</div>
					</div>
				</div>

				{/* ── Action Policy ──────────────────────────────── */}
				<div className="sub-section">
					<h4 className="sub-section-title">
						<Zap />
						Action Policy
					</h4>
					<div className="form-row">
						<div className="form-field">
							<label className="form-label">
								Max Actions Per Turn
							</label>
							<Stepper
								value={
									turnModel.action_policy.max_actions_per_turn
								}
								onChange={(v) =>
									onChange({
										...turnModel,
										action_policy: {
											...turnModel.action_policy,
											max_actions_per_turn: v,
										},
									})
								}
								min={1}
							/>
						</div>
						<div className="form-field">
							<label className="form-label">Draw Timing</label>
							<input
								type="text"
								value={
									turnModel.action_policy
										.draw_requirement_timing
								}
								onChange={(e) =>
									onChange({
										...turnModel,
										action_policy: {
											...turnModel.action_policy,
											draw_requirement_timing:
												e.target.value,
										},
									})
								}
								placeholder="e.g. start of turn, end of turn"
								className="form-input"
							/>
						</div>
					</div>
					<div className="form-field mt-3">
						<label className="form-label">
							End-of-Turn Validation
						</label>
						<input
							type="text"
							value={
								turnModel.action_policy.end_of_turn_validation
							}
							onChange={(e) =>
								onChange({
									...turnModel,
									action_policy: {
										...turnModel.action_policy,
										end_of_turn_validation: e.target.value,
									},
								})
							}
							placeholder="What must be true at end of turn?"
							className="form-input"
						/>
					</div>
					<div className="mt-3">
						<label className="form-label mb-2 block">
							Forced Actions
						</label>
						<EditableList
							items={turnModel.action_policy.forced_actions}
							onChange={(v) =>
								onChange({
									...turnModel,
									action_policy: {
										...turnModel.action_policy,
										forced_actions: v,
									},
								})
							}
							placeholder="Action..."
							addLabel="Add action"
						/>
					</div>
				</div>

				{/* ── Interrupt Policy ───────────────────────────── */}
				<div className="sub-section">
					<h4 className="sub-section-title">
						<Shield />
						Interrupt Policy
					</h4>
					<div className="form-row">
						<div className="form-field">
							<label className="form-label">
								Interrupts Allowed
							</label>
							<label className="flex cursor-pointer items-center gap-2 pt-1">
								<input
									type="checkbox"
									checked={
										turnModel.interrupt_policy
											.interrupt_allowed
									}
									onChange={(e) =>
										onChange({
											...turnModel,
											interrupt_policy: {
												...turnModel.interrupt_policy,
												interrupt_allowed:
													e.target.checked,
											},
										})
									}
									className="h-4 w-4 rounded border-[var(--color-border)] bg-[var(--color-bg-deep)] accent-[var(--color-gold)]"
								/>
								<span className="font-body text-sm text-[var(--color-cream-dim)]">
									Players can interrupt other turns
								</span>
							</label>
						</div>
						<div className="form-field">
							<label className="form-label">Who Can React</label>
							<input
								type="text"
								value={turnModel.interrupt_policy.who_can_react}
								onChange={(e) =>
									onChange({
										...turnModel,
										interrupt_policy: {
											...turnModel.interrupt_policy,
											who_can_react: e.target.value,
										},
									})
								}
								placeholder="any / target / next player"
								className="form-input"
							/>
						</div>
					</div>
					<div className="form-field mt-3">
						<label className="form-label">
							Reaction Time Limit (seconds)
						</label>
						<Stepper
							value={
								turnModel.interrupt_policy.reaction_time_limit
							}
							onChange={(v) =>
								onChange({
									...turnModel,
									interrupt_policy: {
										...turnModel.interrupt_policy,
										reaction_time_limit: v,
									},
								})
							}
						/>
					</div>
				</div>

				{/* ── Timeout Policy ─────────────────────────────── */}
				<div className="sub-section">
					<h4 className="sub-section-title">
						<Clock />
						Timeout Policy
					</h4>
					<div className="form-row">
						<div className="form-field">
							<label className="form-label">
								Turn Timer (seconds, 0 = off)
							</label>
							<Stepper
								value={turnModel.timeout_policy.per_turn_timer}
								onChange={(v) =>
									onChange({
										...turnModel,
										timeout_policy: {
											...turnModel.timeout_policy,
											per_turn_timer: v,
										},
									})
								}
							/>
						</div>
						<div className="form-field">
							<label className="form-label">
								Reaction Timer (seconds)
							</label>
							<Stepper
								value={
									turnModel.timeout_policy.per_reaction_timer
								}
								onChange={(v) =>
									onChange({
										...turnModel,
										timeout_policy: {
											...turnModel.timeout_policy,
											per_reaction_timer: v,
										},
									})
								}
							/>
						</div>
					</div>
					<div className="form-field mt-3">
						<label className="form-label">
							Auto-Resolve Behavior
						</label>
						<input
							type="text"
							value={
								turnModel.timeout_policy.auto_resolve_behavior
							}
							onChange={(e) =>
								onChange({
									...turnModel,
									timeout_policy: {
										...turnModel.timeout_policy,
										auto_resolve_behavior: e.target.value,
									},
								})
							}
							placeholder="What happens when time runs out?"
							className="form-input"
						/>
					</div>
				</div>
			</div>
		</section>
	);
}
