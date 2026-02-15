import Link from "next/link";

export default function AppNav() {
	return (
		<nav className="mb-8 flex flex-wrap items-center justify-center gap-3 text-sm">
			<Link
				className="rounded-lg border border-slate-600 px-3 py-1.5 text-slate-200 transition-colors hover:bg-slate-700"
				href="/"
			>
				Generate
			</Link>
			<Link
				className="rounded-lg border border-slate-600 px-3 py-1.5 text-slate-200 transition-colors hover:bg-slate-700"
				href="/host"
			>
				Host
			</Link>
			<Link
				className="rounded-lg border border-slate-600 px-3 py-1.5 text-slate-200 transition-colors hover:bg-slate-700"
				href="/join"
			>
				Join
			</Link>
			<Link
				className="rounded-lg border border-slate-600 px-3 py-1.5 text-slate-200 transition-colors hover:bg-slate-700"
				href="/showcase"
			>
				Showcase
			</Link>
		</nav>
	);
}
