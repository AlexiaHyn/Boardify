import Link from 'next/link';
import { getSupabaseClient } from '@/lib/supabase';
import type { GameShowcaseRow } from '@/types/showcase';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

async function getShowcases(): Promise<GameShowcaseRow[]> {
  const supabase = getSupabaseClient();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('game_showcases')
    .select('id, game_code, game_id, host_person, game_snapshot, status, created_at, completed_at')
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as GameShowcaseRow[];
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: 'short',
    timeStyle: 'short',
  });
}

export default async function ShowcasePage() {
  const missingEnv = !process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (missingEnv) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center p-4">
        <div className="bg-black/40 rounded-2xl p-8 border border-white/10 max-w-md text-center">
          <h1 className="text-2xl font-bold text-white mb-4">Showcase</h1>
          <p className="text-white/70 mb-4">
            Configure Supabase in <code className="bg-white/10 px-2 py-1 rounded">.env.local</code>:
          </p>
          <pre className="text-left text-sm text-white/80 bg-gray-800/80 p-4 rounded-xl overflow-x-auto">
            {`NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key`}
          </pre>
          <p className="text-white/50 text-sm mt-4">Copy from <code>.env.local.example</code> and fill in your project values.</p>
          <Link href="/" className="inline-block mt-6 text-blue-400 hover:text-blue-300">← Back home</Link>
        </div>
      </div>
    );
  }

  let rows: GameShowcaseRow[];
  try {
    rows = await getShowcases();
  } catch (e) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center p-4">
        <div className="bg-black/40 rounded-2xl p-8 border border-red-500/30 max-w-md text-center">
          <h1 className="text-2xl font-bold text-white mb-4">Showcase</h1>
          <p className="text-red-300">Failed to load games: {(e as Error).message}</p>
          <Link href="/" className="inline-block mt-6 text-blue-400 hover:text-blue-300">← Back home</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold text-white">Boardify showcase</h1>
          <Link href="/" className="text-white/70 hover:text-white">← Home</Link>
        </div>
        <p className="text-white/60 mb-6">Previously played games</p>

        {rows.length === 0 ? (
          <div className="bg-black/40 rounded-2xl p-8 border border-white/10 text-center text-white/60">
            No games in the showcase yet.
          </div>
        ) : (
          <ul className="space-y-4">
            {rows.map((row) => (
              <li
                key={row.id}
                className="bg-black/40 rounded-2xl p-6 border border-white/10 hover:border-white/20 transition-colors"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-white font-semibold">Host: {row.host_person}</p>
                    <p className="text-white/70 mt-1">
                      Game: {row.game_snapshot?.gameName ?? row.game_snapshot?.gameType ?? '—'}
                    </p>
                    <p className="text-white/50 text-sm mt-1">
                      Room <code className="bg-white/10 px-1.5 py-0.5 rounded">{row.game_code}</code>
                      {row.created_at && ` · ${formatDate(row.created_at)}`}
                    </p>
                  </div>
                  <span
                    className={`text-sm px-3 py-1 rounded-full ${
                      row.status === 'completed' ? 'bg-green-500/20 text-green-300' : 'bg-blue-500/20 text-blue-300'
                    }`}
                  >
                    {row.status.replace('_', ' ')}
                  </span>
                </div>
                <details className="mt-4">
                  <summary className="text-white/60 text-sm cursor-pointer hover:text-white/80">Game snapshot</summary>
                  <pre className="mt-2 p-4 bg-gray-900/80 rounded-xl text-xs text-white/80 overflow-x-auto max-h-48 overflow-y-auto">
                    {JSON.stringify(row.game_snapshot, null, 2)}
                  </pre>
                </details>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
