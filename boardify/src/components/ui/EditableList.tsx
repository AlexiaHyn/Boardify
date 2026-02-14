"use client";

import { Plus, Trash2, ChevronUp, ChevronDown } from "lucide-react";
import EditableText from "./EditableText";

interface EditableListProps {
	items: string[];
	onChange: (items: string[]) => void;
	ordered?: boolean;
	placeholder?: string;
	addLabel?: string;
}

export default function EditableList({
	items,
	onChange,
	ordered = false,
	placeholder = "New item...",
	addLabel = "Add item",
}: EditableListProps) {
	function updateItem(index: number, value: string) {
		const next = [...items];
		next[index] = value;
		onChange(next);
	}

	function removeItem(index: number) {
		onChange(items.filter((_, i) => i !== index));
	}

	function moveItem(index: number, direction: -1 | 1) {
		const target = index + direction;
		if (target < 0 || target >= items.length) return;
		const next = [...items];
		const temp = next[index]!;
		next[index] = next[target]!;
		next[target] = temp;
		onChange(next);
	}

	function addItem() {
		onChange([...items, ""]);
	}

	return (
		<div className="space-y-1">
			<div className="space-y-1">
				{items.map((item, i) => (
					<div
						key={`${i}`}
						className="group/item flex items-center gap-2 rounded-lg transition-colors hover:bg-white/[0.02]"
					>
						{/* Number label */}
						{ordered && (
							<span className="w-7 shrink-0 text-right text-sm font-medium tabular-nums text-slate-500">
								{i + 1}.
							</span>
						)}

						{/* Editable content */}
						<div className="min-w-0 flex-1">
							<EditableText
								value={item}
								onChange={(v) => updateItem(i, v)}
								placeholder={placeholder}
								className="text-sm text-slate-300"
							/>
						</div>

						{/* Actions */}
						<div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover/item:opacity-100">
							<button
								type="button"
								onClick={() => moveItem(i, -1)}
								disabled={i === 0}
								className="rounded p-1 text-slate-500 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-30"
								title="Move up"
							>
								<ChevronUp className="h-3.5 w-3.5" />
							</button>
							<button
								type="button"
								onClick={() => moveItem(i, 1)}
								disabled={i === items.length - 1}
								className="rounded p-1 text-slate-500 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-30"
								title="Move down"
							>
								<ChevronDown className="h-3.5 w-3.5" />
							</button>
							<button
								type="button"
								onClick={() => removeItem(i)}
								className="rounded p-1 text-slate-500 transition-colors hover:bg-red-500/20 hover:text-red-400"
								title="Remove"
							>
								<Trash2 className="h-3.5 w-3.5" />
							</button>
						</div>
					</div>
				))}
			</div>

			<button
				type="button"
				onClick={addItem}
				className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-indigo-400 transition-colors hover:bg-indigo-500/10 hover:text-indigo-300 ${ordered ? "ml-9" : ""}`}
			>
				<Plus className="h-4 w-4" />
				{addLabel}
			</button>
		</div>
	);
}
