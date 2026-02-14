"use client";

import { useState, useRef, useEffect, type KeyboardEvent } from "react";
import { Pencil } from "lucide-react";

interface EditableTextProps {
	value: string;
	onChange: (value: string) => void;
	multiline?: boolean;
	placeholder?: string;
	className?: string;
	inputClassName?: string;
	as?: "h1" | "h2" | "h3" | "h4" | "p" | "span";
}

export default function EditableText({
	value,
	onChange,
	multiline = false,
	placeholder = "Click to edit...",
	className = "",
	inputClassName = "",
	as: Tag = "span",
}: EditableTextProps) {
	const [editing, setEditing] = useState(false);
	const [draft, setDraft] = useState(value);
	const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

	useEffect(() => {
		setDraft(value);
	}, [value]);

	useEffect(() => {
		if (editing && inputRef.current) {
			inputRef.current.focus();
			inputRef.current.select();
		}
	}, [editing]);

	function save() {
		setEditing(false);
		const trimmed = draft.trim();
		if (trimmed && trimmed !== value) {
			onChange(trimmed);
		} else {
			setDraft(value);
		}
	}

	function onKeyDown(e: KeyboardEvent) {
		if (e.key === "Enter" && !multiline) {
			e.preventDefault();
			save();
		}
		if (e.key === "Escape") {
			setDraft(value);
			setEditing(false);
		}
	}

	if (editing) {
		const shared = `w-full rounded-lg border border-[var(--color-gold)] bg-[var(--color-bg-deep)] px-3 py-1.5 font-body text-[var(--color-cream)] outline-none ring-1 ring-[var(--color-gold)]/30 transition-all ${inputClassName}`;

		return multiline ? (
			<textarea
				ref={inputRef as React.RefObject<HTMLTextAreaElement>}
				value={draft}
				onChange={(e) => setDraft(e.target.value)}
				onBlur={save}
				onKeyDown={onKeyDown}
				rows={3}
				className={`${shared} resize-y`}
				placeholder={placeholder}
			/>
		) : (
			<input
				ref={inputRef as React.RefObject<HTMLInputElement>}
				type="text"
				value={draft}
				onChange={(e) => setDraft(e.target.value)}
				onBlur={save}
				onKeyDown={onKeyDown}
				className={shared}
				placeholder={placeholder}
			/>
		);
	}

	return (
		<Tag
			onClick={() => setEditing(true)}
			className={`group relative inline-flex cursor-pointer items-baseline gap-2 rounded-lg border border-transparent px-3 py-1.5 leading-snug transition-all hover:border-[var(--color-border)] hover:bg-[var(--color-gold-muted)] ${className}`}
			title="Click to edit"
		>
			<span className="min-w-0">
				{value || (
					<span className="italic text-[var(--color-stone-dim)]">
						{placeholder}
					</span>
				)}
			</span>
			<Pencil className="inline-block h-3 w-3 shrink-0 text-[var(--color-gold-dim)] opacity-40 transition-opacity group-hover:opacity-100" />
		</Tag>
	);
}
