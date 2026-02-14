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
		const shared = `w-full rounded-lg border border-indigo-500 bg-slate-900 px-2 py-1 text-white outline-none ring-1 ring-indigo-500/50 transition-all ${inputClassName}`;

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
			className={`group relative inline-flex cursor-pointer items-baseline gap-1.5 rounded-lg px-2 py-1 leading-snug transition-all hover:bg-white/5 ${className}`}
			title="Click to edit"
		>
			<span className="min-w-0">
				{value || (
					<span className="italic text-slate-500">{placeholder}</span>
				)}
			</span>
			<Pencil className="inline-block h-3 w-3 shrink-0 text-slate-500 opacity-0 transition-opacity group-hover:opacity-100" />
		</Tag>
	);
}
