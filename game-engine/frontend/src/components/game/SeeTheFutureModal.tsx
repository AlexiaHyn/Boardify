'use client';

interface SeeTheFutureModalProps {
  cards: string[];
  onClose: () => void;
}

export function SeeTheFutureModal({ cards, onClose }: SeeTheFutureModalProps) {
  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="section-panel max-w-sm w-full mx-4 text-center"
        style={{ borderColor: 'var(--color-rose)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="section-panel-inner">
          <div className="text-5xl mb-4">&#128302;</div>
          <h2 className="font-display text-xl font-semibold tracking-wide text-[var(--color-cream)] mb-2">See the Future</h2>
          <p className="font-body text-sm text-[var(--color-stone)] mb-6">Top 3 cards of the draw pile (only you can see this):</p>

          <div className="space-y-3 mb-6">
            {cards.length === 0 ? (
              <p className="font-body text-sm italic text-[var(--color-stone-dim)]">Deck is empty!</p>
            ) : (
              cards.map((name, i) => (
                <div
                  key={i}
                  className={`flex items-center gap-3 rounded-xl p-3 ${
                    i === 0
                      ? 'bg-[var(--color-gold-muted)] border border-[var(--color-gold-dim)]'
                      : 'bg-[var(--color-bg-deep)] border border-[var(--color-border-subtle)]'
                  }`}
                >
                  <span className="font-mono text-sm w-4 text-[var(--color-stone-dim)]">{i + 1}</span>
                  <span className="font-body font-semibold text-[var(--color-cream)]">{name}</span>
                  {i === 0 && <span className="font-display text-[10px] tracking-wider text-[var(--color-gold)] ml-auto">NEXT</span>}
                </div>
              ))
            )}
          </div>

          <button
            onClick={onClose}
            className="btn-press bg-[var(--color-crimson)] hover:bg-[var(--color-crimson-bright)] text-[var(--color-cream)] font-display font-medium tracking-wider text-sm px-8 py-3 rounded-xl transition-colors"
          >
            GOT IT
          </button>
        </div>
      </div>
    </div>
  );
}
