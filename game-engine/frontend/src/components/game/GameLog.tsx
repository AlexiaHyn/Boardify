'use client';

import { useEffect, useRef } from 'react';
import type { LogEntry } from '@/types/game';

interface GameLogProps {
  entries: LogEntry[];
  maxVisible?: number;
}

const TYPE_STYLES: Record<string, string> = {
  system: 'text-[var(--color-gold)]',
  action: 'text-[var(--color-cream)]',
  effect: 'text-[var(--color-amber-bright)]',
};

export function GameLog({ entries, maxVisible = 50 }: GameLogProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const visible = entries.slice(-maxVisible).reverse();

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [entries.length]);

  return (
    <div className="section-panel h-48 overflow-y-auto">
      <div className="section-panel-inner">
        <p className="font-display text-[10px] font-semibold tracking-[0.1em] uppercase text-[var(--color-stone-dim)] mb-2">
          Game Log
        </p>
        <div className="space-y-1">
          {visible.length === 0 ? (
            <p className="font-body text-xs italic text-[var(--color-stone-dim)]">No events yet&hellip;</p>
          ) : (
            visible.map((entry) => (
              <div key={entry.id} className="flex gap-2 items-start">
                <span className="font-body text-xs text-[var(--color-stone-dim)] shrink-0">
                  {new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </span>
                <span className={`font-body text-xs leading-relaxed ${TYPE_STYLES[entry.type] ?? 'text-[var(--color-cream)]'}`}>
                  {entry.message}
                </span>
              </div>
            ))
          )}
          <div ref={bottomRef} />
        </div>
      </div>
    </div>
  );
}
