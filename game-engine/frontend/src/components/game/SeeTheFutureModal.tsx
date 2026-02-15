'use client';

interface SeeTheFutureModalProps {
  cards: string[];
  onClose: () => void;
}

export function SeeTheFutureModal({ cards, onClose }: SeeTheFutureModalProps) {
  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-gradient-to-br from-indigo-900 to-purple-900 rounded-2xl p-8 border border-purple-500/50 text-center max-w-sm w-full mx-4 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-5xl mb-4">🔮</div>
        <h2 className="text-white font-bold text-xl mb-2">See the Future</h2>
        <p className="text-white/60 text-sm mb-6">Top 3 cards of the draw pile (only you can see this):</p>

        <div className="space-y-3 mb-6">
          {cards.length === 0 ? (
            <p className="text-white/40 text-sm italic">Deck is empty!</p>
          ) : (
            cards.map((name, i) => (
              <div
                key={i}
                className={`flex items-center gap-3 rounded-xl p-3 ${
                  i === 0 ? 'bg-yellow-500/20 border border-yellow-500/40' : 'bg-white/5'
                }`}
              >
                <span className="text-white/40 font-mono text-sm w-4">{i + 1}</span>
                <span className="text-white font-semibold">{name}</span>
                {i === 0 && <span className="text-yellow-400 text-xs ml-auto">Next!</span>}
              </div>
            ))
          )}
        </div>

        <button
          onClick={onClose}
          className="bg-purple-600 hover:bg-purple-500 text-white font-bold px-8 py-3 rounded-xl transition-colors"
        >
          Got it
        </button>
      </div>
    </div>
  );
}
