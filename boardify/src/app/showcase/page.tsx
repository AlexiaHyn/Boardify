"use client";

import { useEffect, useState } from "react";
import AppNav from "~/components/AppNav";
import { getShowcase } from "~/lib/api";
import { getSnapshotDisplayName } from "~/types/gameSnapshot";
import type { ShowcaseItem } from "~/types/multiplayer";

export default function ShowcasePage() {
	const [items, setItems] = useState<ShowcaseItem[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		const load = async () => {
			setLoading(true);
			setError(null);
			try {
				const rows = await getShowcase();
				setItems(rows);
			} catch (err) {
				setError(
					err instanceof Error ? err.message : "Failed to load showcase.",
				);
			} finally {
				setLoading(false);
			}
		};
		void load();
	}, []);

	return (
		<main className="min-h-screen bg-gradient-to-b from-[#0f172a] to-[#1e293b] px-4 py-12 text-white">
			<div className="mx-auto w-full max-w-4xl">
				<h1 className="mb-2 font-bold text-4xl">Showcase</h1>
				<p className="mb-8 text-slate-400">
					All previously played games on Boardify.
				</p>
				<AppNav />
				{loading && <p className="text-slate-300">Loading showcase...</p>}
				{error && (
					<p className="mb-4 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-red-200">
						{error}
					</p>
				)}
				<div className="space-y-3">
					{items.map((item) => (
						<article
							className="rounded-xl border border-slate-700 bg-slate-800 p-4"
							key={item.id}
						>
							<div className="flex flex-wrap items-center justify-between gap-3">
								<div>
									<p className="font-semibold text-lg">
										{getSnapshotDisplayName(item.game_snapshot)}
									</p>
									<p className="text-slate-300 text-sm">
										Host: {item.host_person} | Code:{" "}
										<span className="font-mono tracking-widest">
											{item.game_code}
										</span>
									</p>
								</div>
								<div className="text-right text-slate-400 text-xs">
									<p>Status: {item.status}</p>
									<p>{new Date(item.created_at).toLocaleString()}</p>
								</div>
							</div>
						</article>
					))}
					{!loading && !error && items.length === 0 && (
						<p className="text-slate-400">No games in showcase yet.</p>
					)}
				</div>
			</div>
		</main>
	);
}
