'use client';

import { useEffect, useRef } from 'react';
import type { LogEntry } from '@/types/game';

interface GameLogProps {
  entries: LogEntry[];
  maxVisible?: number;
}

const TYPE_STYLES: Record<string, string> = {
  system: 'text-yellow-300',
  action: 'text-white',
  effect: 'text-orange-300',
};

export function GameLog({ entries, maxVisible = 50 }: GameLogProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const visible = entries.slice(-maxVisible).reverse();

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [entries.length]);

  return (
    <div className="bg-black/40 rounded-xl border border-white/10 h-48 overflow-y-auto p-3">
      <p className="text-white/40 text-xs font-semibold uppercase tracking-wider mb-2">Game Log</p>
      <div className="space-y-1">
        {visible.length === 0 ? (
          <p className="text-white/30 text-xs italic">No events yet…</p>
        ) : (
          visible.map((entry) => (
            <div key={entry.id} className="flex gap-2 items-start">
              <span className="text-white/30 text-xs shrink-0">
                {new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
              <span className={`text-xs leading-relaxed ${TYPE_STYLES[entry.type] ?? 'text-white'}`}>
                {entry.message}
              </span>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
