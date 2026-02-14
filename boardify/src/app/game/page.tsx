"use client";

import { useState, useEffect, useCallback } from "react";
import {
  GameState,
  Player,
  Card,
  Zone,
  LogEntry,
} from "../../entities";
import {
  createGame,
  fetchGameState,
  drawCard,
  playCard,
  passTurn,
} from "../../services/gameApi";

// ─── Types ────────────────────────────────────────────────────────────────────
type Screen = "lobby" | "playing" | "ended";

// ─── Card Component ───────────────────────────────────────────────────────────
function CardTile({
  card,
  onClick,
  selected,
  disabled,
}: {
  card: Card;
  onClick?: () => void;
  selected?: boolean;
  disabled?: boolean;
}) {
  const colors: Record<string, string> = {
    defuse: "from-emerald-900 to-emerald-700 border-emerald-400",
    exploding: "from-red-950 to-orange-800 border-orange-400",
    attack: "from-red-900 to-rose-700 border-red-400",
    skip: "from-blue-900 to-blue-700 border-blue-400",
    nope: "from-slate-900 to-slate-700 border-slate-400",
    see_future: "from-purple-900 to-violet-700 border-purple-400",
    shuffle: "from-teal-900 to-teal-700 border-teal-400",
    favor: "from-amber-900 to-yellow-700 border-amber-400",
    cat: "from-pink-900 to-pink-700 border-pink-400",
  };
  const color = colors[card.subtype || card.type] || "from-gray-900 to-gray-700 border-gray-400";

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`
        relative group w-20 h-28 rounded-xl border-2 bg-gradient-to-b
        flex flex-col items-center justify-between p-2
        transition-all duration-200 cursor-pointer
        ${color}
        ${selected ? "scale-110 -translate-y-2 shadow-2xl shadow-white/20 border-white" : "hover:-translate-y-1 hover:scale-105"}
        ${disabled ? "opacity-40 cursor-not-allowed" : ""}
      `}
      style={{ fontFamily: "'Courier New', monospace" }}
    >
      <span className="text-2xl drop-shadow">{card.emoji || "🃏"}</span>
      <span className="text-[9px] text-center text-white/90 font-bold leading-tight">
        {card.name}
      </span>
      {selected && (
        <div className="absolute -top-1 -right-1 w-4 h-4 bg-white rounded-full flex items-center justify-center">
          <span className="text-[8px] text-black font-black">✓</span>
        </div>
      )}
    </button>
  );
}

// ─── Player Seat ──────────────────────────────────────────────────────────────
function PlayerSeat({
  player,
  isCurrentTurn,
}: {
  player: Player;
  isCurrentTurn: boolean;
}) {
  const alive = player.status !== "eliminated";
  return (
    <div
      className={`
        relative flex flex-col items-center gap-1 px-3 py-2 rounded-xl border
        transition-all duration-300
        ${isCurrentTurn
          ? "border-yellow-400 bg-yellow-400/10 shadow-lg shadow-yellow-400/20"
          : "border-white/10 bg-white/5"
        }
        ${!alive ? "opacity-40 grayscale" : ""}
      `}
    >
      {isCurrentTurn && (
        <div className="absolute -top-2 left-1/2 -translate-x-1/2 text-[10px] bg-yellow-400 text-black px-2 rounded-full font-black tracking-wider">
          TURN
        </div>
      )}
      <span className="text-2xl">{player.emoji || "🐱"}</span>
      <span className="text-xs font-bold text-white truncate max-w-[80px]">{player.name}</span>
      <div className="flex items-center gap-1">
        <span className="text-[10px] text-white/60">🃏 {player.hand.cards.length}</span>
        {!alive && <span className="text-[10px]">💀</span>}
      </div>
    </div>
  );
}

// ─── Zone Pile ────────────────────────────────────────────────────────────────
function ZonePile({ zone }: { zone: Zone }) {
  const top = zone.cards[0];
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="text-[10px] text-white/50 uppercase tracking-widest">{zone.name}</div>
      <div className="relative w-16 h-24 rounded-xl border-2 border-white/20 bg-white/5 flex items-center justify-center">
        {zone.cards.length === 0 ? (
          <span className="text-white/20 text-2xl">∅</span>
        ) : zone.isPublic && top ? (
          <div className="flex flex-col items-center">
            <span className="text-2xl">{top.emoji || "🃏"}</span>
            <span className="text-[8px] text-white/60 text-center mt-1 px-1">{top.name}</span>
          </div>
        ) : (
          <div className="flex flex-col items-center">
            <span className="text-2xl">🂠</span>
            <span className="text-[9px] text-white/60 mt-1">{zone.cards.length}</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Log Feed ─────────────────────────────────────────────────────────────────
function LogFeed({ entries }: { entries: LogEntry[] }) {
  const icons: Record<string, string> = {
    action: "▶",
    system: "◆",
    effect: "★",
    warning: "⚠",
  };
  return (
    <div className="flex flex-col gap-1 overflow-hidden">
      {[...entries].reverse().map((e) => (
        <div key={e.id} className="text-[11px] text-white/70 flex gap-1.5 items-start">
          <span className="text-white/30 mt-0.5 shrink-0">{icons[e.type] || "▶"}</span>
          <span>{e.message}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Lobby Screen ─────────────────────────────────────────────────────────────
function LobbyScreen({ onStart }: { onStart: (names: string[]) => void }) {
  const [names, setNames] = useState(["You", "Ash", "Sam"]);

  const add = () => {
    if (names.length < 5) setNames([...names, `Player ${names.length + 1}`]);
  };
  const remove = (i: number) => {
    if (names.length > 2) setNames(names.filter((_, idx) => idx !== i));
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center relative overflow-hidden"
      style={{ background: "radial-gradient(ellipse at 50% 60%, #1a0a00 0%, #0a0005 100%)" }}
    >
      {/* Floating sparks */}
      {[...Array(12)].map((_, i) => (
        <div
          key={i}
          className="absolute rounded-full opacity-20 animate-pulse"
          style={{
            width: Math.random() * 6 + 2,
            height: Math.random() * 6 + 2,
            background: "#ff6b00",
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
            animationDelay: `${Math.random() * 3}s`,
            animationDuration: `${Math.random() * 2 + 2}s`,
          }}
        />
      ))}

      <div className="relative z-10 flex flex-col items-center gap-8 px-4">
        {/* Title */}
        <div className="text-center">
          <div className="text-7xl mb-2">💣</div>
          <h1
            className="text-5xl font-black tracking-tight text-white"
            style={{ fontFamily: "Georgia, serif", textShadow: "0 0 40px rgba(255,100,0,0.5)" }}
          >
            Exploding
          </h1>
          <h1
            className="text-5xl font-black tracking-tight"
            style={{
              fontFamily: "Georgia, serif",
              background: "linear-gradient(90deg, #ff6b00, #ff3300, #ff6b00)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            Kittens
          </h1>
          <p className="text-white/40 text-sm mt-2 tracking-widest uppercase">Card Game</p>
        </div>

        {/* Player setup */}
        <div
          className="bg-white/5 backdrop-blur border border-white/10 rounded-2xl p-6 w-full max-w-sm"
          style={{ boxShadow: "0 0 60px rgba(255,80,0,0.1)" }}
        >
          <p className="text-white/60 text-xs uppercase tracking-widest mb-4">Players ({names.length}/5)</p>

          <div className="flex flex-col gap-2 mb-4">
            {names.map((name, i) => (
              <div key={i} className="flex gap-2 items-center">
                <input
                  value={name}
                  onChange={(e) => {
                    const n = [...names];
                    n[i] = e.target.value;
                    setNames(n);
                  }}
                  className="flex-1 bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-orange-400 transition-colors"
                  placeholder={`Player ${i + 1}`}
                />
                {i > 1 && (
                  <button
                    onClick={() => remove(i)}
                    className="text-white/30 hover:text-red-400 transition-colors text-lg w-8"
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
          </div>

          {names.length < 5 && (
            <button
              onClick={add}
              className="w-full py-2 rounded-lg border border-dashed border-white/20 text-white/40 hover:text-white/70 hover:border-white/40 text-sm transition-all mb-4"
            >
              + Add Player
            </button>
          )}

          <button
            onClick={() => onStart(names)}
            disabled={names.some((n) => !n.trim())}
            className="w-full py-3 rounded-xl font-black text-black text-sm uppercase tracking-widest transition-all duration-200 hover:scale-105 active:scale-95 disabled:opacity-30"
            style={{
              background: "linear-gradient(135deg, #ff6b00, #ff3300)",
              boxShadow: "0 0 30px rgba(255,80,0,0.4)",
            }}
          >
            💣 Start Game
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Game Screen ─────────────────────────────────────────────────────────
function GameScreen({
  gameState,
  localPlayerId,
  onAction,
}: {
  gameState: GameState;
  localPlayerId: string;
  onAction: (type: string, cardId?: string, targetId?: string) => void;
}) {
  const [selectedCard, setSelectedCard] = useState<string | null>(null);
  const [selectingTarget, setSelectingTarget] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);

  const localPlayer = gameState.players.find((p) => p.id === localPlayerId);
  const isMyTurn = gameState.currentTurnPlayerId === localPlayerId;
  const others = gameState.players.filter((p) => p.id !== localPlayerId);
  const drawZone = gameState.zones.find((z) => z.id === "draw_pile");
  const discardZone = gameState.zones.find((z) => z.id === "discard_pile");

  const triggerFlash = (msg: string) => {
    setFlash(msg);
    setTimeout(() => setFlash(null), 2000);
  };

  const handleCardClick = (cardId: string) => {
    const card = localPlayer?.hand.cards.find((c) => c.id === cardId);
    if (!card || !isMyTurn) return;
    if (card.subtype === "favor") {
      setSelectedCard(cardId);
      setSelectingTarget(true);
    } else {
      if (selectedCard === cardId) {
        onAction("play_card", cardId);
        setSelectedCard(null);
        triggerFlash(`Played ${card.name}!`);
      } else {
        setSelectedCard(cardId);
      }
    }
  };

  const handlePlayerTarget = (targetId: string) => {
    if (selectingTarget && selectedCard) {
      onAction("play_card", selectedCard, targetId);
      setSelectedCard(null);
      setSelectingTarget(false);
    }
  };

  const handleDraw = () => {
    onAction("draw_card");
  };

  return (
    <div
      className="min-h-screen flex flex-col relative overflow-hidden"
      style={{
        background: "radial-gradient(ellipse at 50% 30%, #0f0a1a 0%, #050208 100%)",
        fontFamily: "'Courier New', monospace",
      }}
    >
      {/* Flash overlay */}
      {flash && (
        <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
          <div
            className="text-2xl font-black text-white px-6 py-3 rounded-2xl"
            style={{
              background: "rgba(255,100,0,0.9)",
              boxShadow: "0 0 60px rgba(255,100,0,0.6)",
              animation: "fadeInOut 2s ease-in-out",
            }}
          >
            {flash}
          </div>
        </div>
      )}

      {/* Target selection banner */}
      {selectingTarget && (
        <div className="fixed top-4 inset-x-4 z-40 bg-yellow-400 text-black text-center py-2 rounded-xl font-black text-sm animate-bounce">
          🎯 Select a target player!
        </div>
      )}

      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
        <div>
          <div
            className="text-lg font-black text-white tracking-tight"
            style={{ fontFamily: "Georgia, serif" }}
          >
            💣 Exploding Kittens
          </div>
          <div className="text-[10px] text-white/40 uppercase tracking-widest">
            Turn {gameState.turnNumber} · {isMyTurn ? "YOUR TURN" : `${gameState.players.find(p => p.id === gameState.currentTurnPlayerId)?.name}'s turn`}
          </div>
        </div>
        <div className="flex gap-2">
          {gameState.players.map((p) => (
            <div
              key={p.id}
              title={p.name}
              className={`w-8 h-8 rounded-full flex items-center justify-center text-lg transition-all
                ${p.status === "eliminated" ? "opacity-30 grayscale" : ""}
                ${p.id === gameState.currentTurnPlayerId ? "ring-2 ring-yellow-400" : ""}
              `}
            >
              {p.emoji}
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-1 gap-0 overflow-hidden">
        {/* Left sidebar: players + log */}
        <div className="w-48 shrink-0 flex flex-col gap-3 p-3 border-r border-white/10 overflow-y-auto">
          <div className="text-[10px] text-white/30 uppercase tracking-widest">Players</div>
          {gameState.players.map((p) => (
            <div
              key={p.id}
              onClick={() => selectingTarget && p.id !== localPlayerId && p.status !== "eliminated" && handlePlayerTarget(p.id)}
              className={selectingTarget && p.id !== localPlayerId && p.status !== "eliminated" ? "cursor-pointer" : ""}
            >
              <PlayerSeat
                player={p}
                isCurrentTurn={p.id === gameState.currentTurnPlayerId}
              />
            </div>
          ))}

          <div className="mt-auto">
            <div className="text-[10px] text-white/30 uppercase tracking-widest mb-2">Game Log</div>
            <LogFeed entries={gameState.log.slice(-8)} />
          </div>
        </div>

        {/* Center: table */}
        <div className="flex-1 flex flex-col items-center justify-center gap-6 p-6">
          {/* Table surface */}
          <div
            className="relative rounded-3xl border border-white/10 flex items-center justify-center gap-8 p-8"
            style={{
              background: "radial-gradient(ellipse at 50% 50%, #1a1040 0%, #0a0820 100%)",
              minWidth: 280,
              minHeight: 180,
              boxShadow: "inset 0 0 60px rgba(0,0,0,0.5), 0 0 40px rgba(80,40,200,0.1)",
            }}
          >
            <div className="text-[10px] text-white/20 absolute top-3 left-1/2 -translate-x-1/2 uppercase tracking-widest">
              Table
            </div>
            {drawZone && <ZonePile zone={drawZone} />}
            <div className="text-white/20 text-3xl">⇄</div>
            {discardZone && <ZonePile zone={discardZone} />}
          </div>

          {/* Action buttons */}
          {isMyTurn && (
            <div className="flex gap-3">
              <button
                onClick={handleDraw}
                className="px-5 py-2.5 rounded-xl font-black text-sm text-white uppercase tracking-widest transition-all hover:scale-105 active:scale-95"
                style={{
                  background: "linear-gradient(135deg, #ff6b00, #cc3300)",
                  boxShadow: "0 0 20px rgba(255,80,0,0.3)",
                }}
              >
                Draw Card
              </button>
              {selectedCard && !selectingTarget && (
                <button
                  onClick={() => {
                    onAction("play_card", selectedCard);
                    setSelectedCard(null);
                  }}
                  className="px-5 py-2.5 rounded-xl font-black text-sm text-white uppercase tracking-widest transition-all hover:scale-105"
                  style={{ background: "linear-gradient(135deg, #4040cc, #2020aa)" }}
                >
                  Play Card ✓
                </button>
              )}
              {selectingTarget && (
                <button
                  onClick={() => { setSelectingTarget(false); setSelectedCard(null); }}
                  className="px-5 py-2.5 rounded-xl font-black text-sm text-white/60 uppercase tracking-widest border border-white/20"
                >
                  Cancel
                </button>
              )}
            </div>
          )}

          {!isMyTurn && (
            <div className="text-white/30 text-sm tracking-widest uppercase">
              Waiting for {gameState.players.find((p) => p.id === gameState.currentTurnPlayerId)?.name}...
            </div>
          )}
        </div>
      </div>

      {/* Hand */}
      {localPlayer && (
        <div className="border-t border-white/10 bg-black/30 backdrop-blur px-4 py-4">
          <div className="text-[10px] text-white/30 uppercase tracking-widest mb-3 text-center">
            Your Hand — {localPlayer.hand.cards.length} cards
          </div>
          <div className="flex gap-2 justify-center flex-wrap">
            {localPlayer.hand.cards.map((card) => (
              <CardTile
                key={card.id}
                card={card}
                onClick={() => handleCardClick(card.id)}
                selected={selectedCard === card.id}
                disabled={!isMyTurn || card.subtype === "defuse" || card.subtype === "exploding"}
              />
            ))}
            {localPlayer.hand.cards.length === 0 && (
              <div className="text-white/20 text-sm py-4">No cards in hand</div>
            )}
          </div>
        </div>
      )}

      <style>{`
        @keyframes fadeInOut {
          0% { opacity: 0; transform: scale(0.8) translateY(10px); }
          20% { opacity: 1; transform: scale(1) translateY(0); }
          80% { opacity: 1; transform: scale(1) translateY(0); }
          100% { opacity: 0; transform: scale(0.8) translateY(-10px); }
        }
      `}</style>
    </div>
  );
}

// ─── End Screen ───────────────────────────────────────────────────────────────
function EndScreen({ winner, onRestart }: { winner: Player | undefined; onRestart: () => void }) {
  return (
    <div
      className="min-h-screen flex items-center justify-center"
      style={{ background: "radial-gradient(ellipse at 50% 50%, #1a0a00 0%, #050000 100%)" }}
    >
      <div className="text-center flex flex-col items-center gap-6">
        <div className="text-8xl">{winner?.emoji || "🏆"}</div>
        <h1
          className="text-5xl font-black text-white"
          style={{ fontFamily: "Georgia, serif", textShadow: "0 0 40px rgba(255,200,0,0.5)" }}
        >
          {winner ? `${winner.name} Wins!` : "Game Over"}
        </h1>
        <p className="text-white/40 text-sm">Last one standing, didn't explode.</p>
        <button
          onClick={onRestart}
          className="mt-4 px-8 py-3 rounded-xl font-black text-black uppercase tracking-widest hover:scale-105 active:scale-95 transition-all"
          style={{ background: "linear-gradient(135deg, #ff6b00, #ff3300)", boxShadow: "0 0 30px rgba(255,80,0,0.4)" }}
        >
          Play Again
        </button>
      </div>
    </div>
  );
}

// ─── App Root ─────────────────────────────────────────────────────────────────
export default function ExplodingKittensPage() {
  const [screen, setScreen] = useState<Screen>("lobby");
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [localPlayerId, setLocalPlayerId] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  // Poll for state updates every 2s when playing
  useEffect(() => {
    if (screen !== "playing" || !gameState) return;
    const id = setInterval(async () => {
      try {
        const updated = await fetchGameState(gameState.gameId);
        setGameState(updated);
        if (updated.phase === "ended") setScreen("ended");
      } catch {}
    }, 2000);
    return () => clearInterval(id);
  }, [screen, gameState]);

  const handleStart = async (playerNames: string[]) => {
    try {
      setError(null);
      const state = await createGame("exploding_kittens", playerNames);
      setGameState(state);
      setLocalPlayerId(state.players[0].id); // first player is local
      setScreen("playing");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create game");
    }
  };

  const handleAction = useCallback(
    async (type: string, cardId?: string, targetId?: string) => {
      if (!gameState) return;
      try {
        let result;
        if (type === "draw_card") result = await drawCard(gameState.gameId, localPlayerId);
        else if (type === "play_card" && cardId)
          result = await playCard(gameState.gameId, localPlayerId, cardId, targetId);
        else result = await passTurn(gameState.gameId, localPlayerId);

        if (result.success) {
          setGameState(result.newState);
          if (result.newState.phase === "ended") setScreen("ended");
        } else {
          setError(result.error || "Action failed");
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Action failed");
      }
    },
    [gameState, localPlayerId]
  );

  if (screen === "lobby") {
    return (
      <>
        {error && (
          <div className="fixed top-4 right-4 z-50 bg-red-600 text-white px-4 py-2 rounded-lg text-sm">
            {error}
          </div>
        )}
        <LobbyScreen onStart={handleStart} />
      </>
    );
  }

  if (screen === "ended") {
    return <EndScreen winner={gameState?.winner} onRestart={() => setScreen("lobby")} />;
  }

  if (!gameState) return null;

  return (
    <>
      {error && (
        <div
          onClick={() => setError(null)}
          className="fixed top-4 right-4 z-50 bg-red-600 text-white px-4 py-2 rounded-lg text-sm cursor-pointer"
        >
          ⚠ {error} (click to dismiss)
        </div>
      )}
      <GameScreen
        gameState={gameState}
        localPlayerId={localPlayerId}
        onAction={handleAction}
      />
    </>
  );
}
