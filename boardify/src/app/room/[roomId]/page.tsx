"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import type { GameState, Player, Card, LogEntry } from "../../../entities";
import { loadSession, saveSession, joinRoom, startGame } from "../../../services/gameApi";
import { useGame } from "../../../hooks/useGame";

// ── Sub-components ────────────────────────────────────────────────────────────

function CardTile({ card, onClick, selected, disabled }: {
  card: Card; onClick?: () => void; selected?: boolean; disabled?: boolean;
}) {
  const colors: Record<string, string> = {
    defuse:     "from-emerald-950 to-emerald-800 border-emerald-500/60",
    exploding:  "from-red-950 to-orange-900 border-orange-500/60",
    attack:     "from-red-950 to-rose-800 border-red-500/60",
    skip:       "from-blue-950 to-blue-800 border-blue-500/60",
    nope:       "from-slate-900 to-slate-700 border-slate-400/60",
    see_future: "from-purple-950 to-violet-800 border-purple-500/60",
    shuffle:    "from-teal-950 to-teal-800 border-teal-500/60",
    favor:      "from-amber-950 to-yellow-800 border-amber-500/60",
    taco:       "from-pink-950 to-pink-800 border-pink-500/60",
    rainbow:    "from-indigo-950 to-indigo-800 border-indigo-500/60",
    beard:      "from-rose-950 to-rose-800 border-rose-500/60",
    hidden:     "from-gray-900 to-gray-800 border-gray-600/40",
  };
  const color = colors[card.subtype || card.type] || "from-gray-900 to-gray-800 border-gray-500/50";

  return (
    <button onClick={onClick} disabled={disabled}
      className={`relative w-[72px] h-[100px] rounded-xl border-2 bg-gradient-to-b
        flex flex-col items-center justify-between px-1.5 py-2
        transition-all duration-200 select-none shrink-0
        ${color}
        ${selected ? "scale-110 -translate-y-3 shadow-2xl border-white/80 z-10" : "hover:-translate-y-1 hover:scale-105"}
        ${disabled ? "opacity-35 cursor-not-allowed" : "cursor-pointer"}
      `}
      style={{ fontFamily: "'Courier New', monospace" }}
    >
      <span className="text-xl drop-shadow">{card.emoji || "🃏"}</span>
      <span className="text-[8px] text-center text-white/90 font-bold leading-tight px-0.5">
        {card.name}
      </span>
      {selected && (
        <span className="absolute -top-1.5 -right-1.5 bg-white text-black text-[8px] font-black
          w-4 h-4 rounded-full flex items-center justify-center shadow">✓</span>
      )}
    </button>
  );
}

function PlayerAvatar({ player, isTurn }: { player: Player; isTurn: boolean }) {
  return (
    <div className={`flex flex-col items-center gap-1 px-2 py-2 rounded-xl border transition-all
      ${isTurn ? "border-yellow-400/80 bg-yellow-400/10 shadow-lg shadow-yellow-400/20" : "border-white/8 bg-white/4"}
      ${player.status === "eliminated" ? "opacity-30 grayscale" : ""}
      relative`}>
      {isTurn && (
        <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 text-[9px] bg-yellow-400 text-black
          px-1.5 rounded-full font-black whitespace-nowrap">TURN</span>
      )}
      <div className="relative">
        <span className="text-2xl">{player.emoji || "🐱"}</span>
        <span className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border border-black
          ${player.isConnected ? "bg-green-400" : "bg-gray-500"}`} />
      </div>
      <span className="text-[10px] font-bold text-white max-w-[64px] truncate">{player.name}</span>
      <span className="text-[9px] text-white/40">🃏 {player.hand.cards.length}</span>
      {player.status === "eliminated" && <span className="text-[10px]">💀</span>}
      {player.isLocalPlayer && (
        <span className="text-[8px] text-orange-400/80 font-bold">YOU</span>
      )}
    </div>
  );
}

function ZonePile({ zone }: { zone: { name: string; cards: Card[]; isPublic: boolean } }) {
  const top = zone.cards[0];
  return (
    <div className="flex flex-col items-center gap-1.5">
      <span className="text-[9px] text-white/40 uppercase tracking-[0.15em]">{zone.name}</span>
      <div className="w-[60px] h-[84px] rounded-xl border border-white/15 bg-white/4
        flex flex-col items-center justify-center gap-1">
        {zone.cards.length === 0 ? (
          <span className="text-white/15 text-xl">∅</span>
        ) : zone.isPublic && top ? (
          <>
            <span className="text-xl">{top.emoji || "🃏"}</span>
            <span className="text-[7px] text-white/50 text-center px-1 leading-tight">{top.name}</span>
          </>
        ) : (
          <>
            <span className="text-xl">🂠</span>
            <span className="text-[9px] text-white/50 font-bold">{zone.cards.length}</span>
          </>
        )}
      </div>
    </div>
  );
}

function LogFeed({ entries }: { entries: LogEntry[] }) {
  const icons = { action: "▶", system: "◆", effect: "★", warning: "⚠" };
  return (
    <div className="flex flex-col gap-1 overflow-y-auto max-h-48">
      {[...entries].reverse().map((e) => (
        <div key={e.id} className="text-[10px] text-white/60 flex gap-1.5 items-start shrink-0">
          <span className="text-white/25 mt-0.5 shrink-0">{icons[e.type] || "▶"}</span>
          <span className="leading-tight">{e.message}</span>
        </div>
      ))}
    </div>
  );
}

// ── Peek Modal (See the Future) ───────────────────────────────────────────────
function PeekModal({ cards, onClose }: { cards: string[]; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={onClose}>
      <div className="bg-gray-900 border border-purple-500/40 rounded-2xl p-6 max-w-xs w-full mx-4
        shadow-2xl shadow-purple-500/20" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-white font-black text-center mb-1" style={{ fontFamily: "Georgia, serif" }}>
          🔮 See the Future
        </h3>
        <p className="text-white/40 text-xs text-center mb-4">Top 3 cards of the draw pile</p>
        <div className="flex flex-col gap-2">
          {cards.map((name, i) => (
            <div key={i} className="flex items-center gap-3 bg-white/5 rounded-lg px-3 py-2">
              <span className="text-white/40 text-xs font-bold w-4">#{i + 1}</span>
              <span className="text-white text-sm">{name || "—"}</span>
            </div>
          ))}
        </div>
        <button onClick={onClose} className="mt-4 w-full py-2 rounded-xl bg-purple-600 text-white
          font-black text-sm uppercase tracking-widest hover:bg-purple-500 transition-colors">
          Got it
        </button>
      </div>
    </div>
  );
}

// ── Target picker modal ───────────────────────────────────────────────────────
function TargetModal({ players, onSelect, onCancel }: {
  players: Player[]; onSelect: (id: string) => void; onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-gray-900 border border-amber-500/40 rounded-2xl p-6 max-w-xs w-full mx-4">
        <h3 className="text-white font-black text-center mb-1" style={{ fontFamily: "Georgia, serif" }}>
          🎯 Choose a Target
        </h3>
        <p className="text-white/40 text-xs text-center mb-4">Who do you want to use Favor on?</p>
        <div className="flex flex-col gap-2">
          {players.map((p) => (
            <button key={p.id} onClick={() => onSelect(p.id)}
              className="flex items-center gap-3 bg-white/5 hover:bg-amber-400/10 border border-white/10
                hover:border-amber-400/40 rounded-xl px-4 py-3 transition-all text-left">
              <span className="text-2xl">{p.emoji}</span>
              <span className="text-white font-bold text-sm">{p.name}</span>
              <span className="ml-auto text-white/40 text-xs">🃏 {p.hand.cards.length}</span>
            </button>
          ))}
        </div>
        <button onClick={onCancel} className="mt-3 w-full py-2 rounded-xl border border-white/15
          text-white/40 font-bold text-xs uppercase tracking-widest hover:border-white/30 transition-colors">
          Cancel
        </button>
      </div>
    </div>
  );
}

// ── Lobby Screen ──────────────────────────────────────────────────────────────
function LobbyScreen({ gameState, playerId, roomCode, onStart }: {
  gameState: GameState; playerId: string; roomCode: string; onStart: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const isHost = gameState.metadata?.hostId === playerId;
  const canStart = gameState.players.length >= 2;
  const shareUrl = typeof window !== "undefined"
    ? `${window.location.origin}/room/${roomCode}`
    : `/room/${roomCode}`;

  const copyLink = async () => {
    await navigator.clipboard.writeText(shareUrl).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4"
      style={{ background: "radial-gradient(ellipse at 50% 40%, #120820 0%, #040008 100%)" }}>
      <div className="w-full max-w-sm flex flex-col gap-6">

        {/* Header */}
        <div className="text-center">
          <div className="text-6xl mb-2">💣</div>
          <h1 className="text-3xl font-black text-white" style={{ fontFamily: "Georgia, serif" }}>
            Waiting Room
          </h1>
          <p className="text-white/40 text-xs mt-1">Room · <span className="text-orange-400 font-black tracking-widest">{roomCode}</span></p>
        </div>

        {/* Share link */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
          <p className="text-[10px] text-white/40 uppercase tracking-widest mb-2">
            📎 Share this link with friends
          </p>
          <div className="flex gap-2">
            <div className="flex-1 bg-black/30 rounded-xl px-3 py-2 text-[11px] text-white/50 truncate"
              style={{ fontFamily: "'Courier New', monospace" }}>
              {shareUrl}
            </div>
            <button onClick={copyLink}
              className="shrink-0 px-3 py-2 rounded-xl font-black text-xs transition-all
                hover:scale-105 active:scale-95"
              style={{
                background: copied ? "rgba(80,200,80,0.2)" : "rgba(255,100,0,0.2)",
                border: `1px solid ${copied ? "rgba(80,200,80,0.4)" : "rgba(255,100,0,0.4)"}`,
                color: copied ? "#80ff80" : "#ff8040",
              }}>
              {copied ? "✓" : "Copy"}
            </button>
          </div>
        </div>

        {/* Players */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
          <p className="text-[10px] text-white/40 uppercase tracking-widest mb-3">
            Players ({gameState.players.length}/{gameState.rules.maxPlayers})
          </p>
          <div className="flex flex-col gap-2">
            {gameState.players.map((p) => (
              <div key={p.id} className="flex items-center gap-3 rounded-xl bg-white/4 px-3 py-2">
                <span className="text-xl">{p.emoji}</span>
                <span className="text-white font-bold text-sm flex-1">{p.name}</span>
                {p.id === gameState.metadata?.hostId && (
                  <span className="text-[9px] bg-orange-500/20 text-orange-400 px-2 py-0.5 rounded-full font-black">HOST</span>
                )}
                {p.id === playerId && p.id !== gameState.metadata?.hostId && (
                  <span className="text-[9px] text-white/30">you</span>
                )}
                <span className={`w-2 h-2 rounded-full ${p.isConnected ? "bg-green-400" : "bg-gray-600"}`} />
              </div>
            ))}
            {[...Array(Math.max(0, gameState.rules.minPlayers - gameState.players.length))].map((_, i) => (
              <div key={i} className="flex items-center gap-3 rounded-xl border border-dashed border-white/10 px-3 py-2 opacity-40">
                <span className="text-xl">👤</span>
                <span className="text-white/30 text-sm">Waiting for player…</span>
              </div>
            ))}
          </div>
        </div>

        {/* Start button */}
        {isHost ? (
          <button onClick={onStart} disabled={!canStart}
            className="w-full py-3.5 rounded-2xl font-black text-sm uppercase tracking-widest
              transition-all hover:scale-105 active:scale-95 disabled:opacity-30 disabled:scale-100"
            style={{
              fontFamily: "'Courier New', monospace",
              background: "linear-gradient(135deg, #ff6b00, #cc0044)",
              boxShadow: "0 0 40px rgba(255,80,0,0.3)",
              color: "white",
            }}>
            {canStart ? "💣 Start Game!" : `Need ${gameState.rules.minPlayers - gameState.players.length} more player(s)`}
          </button>
        ) : (
          <div className="text-center text-white/30 text-sm py-2">
            Waiting for the host to start the game…
          </div>
        )}
      </div>
    </div>
  );
}

// ── End Screen ────────────────────────────────────────────────────────────────
function EndScreen({ winner, onPlayAgain }: { winner?: Player; onPlayAgain: () => void }) {
  return (
    <div className="min-h-screen flex items-center justify-center"
      style={{ background: "radial-gradient(ellipse at 50% 50%, #1a0a00 0%, #040002 100%)" }}>
      <div className="text-center flex flex-col items-center gap-5">
        <div className="text-8xl" style={{ filter: "drop-shadow(0 0 40px rgba(255,200,0,0.5))" }}>
          {winner?.emoji || "🏆"}
        </div>
        <div>
          <h1 className="text-5xl font-black text-white" style={{ fontFamily: "Georgia, serif" }}>
            {winner ? `${winner.name}` : "Game Over"}
          </h1>
          <p className="text-orange-400 font-black text-xl mt-1">Wins! 🎉</p>
        </div>
        <p className="text-white/30 text-sm">Last one standing — didn't explode.</p>
        <button onClick={onPlayAgain}
          className="mt-2 px-8 py-3 rounded-xl font-black uppercase tracking-widest hover:scale-105 active:scale-95 transition-all"
          style={{
            fontFamily: "'Courier New', monospace",
            background: "linear-gradient(135deg, #ff6b00, #ff0055)",
            boxShadow: "0 0 30px rgba(255,80,0,0.4)", color: "white",
          }}>
          Play Again
        </button>
      </div>
    </div>
  );
}

// ── Main Game Board ───────────────────────────────────────────────────────────
function GameBoard({ gameState, playerId, roomCode }: {
  gameState: GameState; playerId: string; roomCode: string;
}) {
  const { drawCard, playCard, peekCards, clearPeek, error, clearError } = useGame({ roomCode, playerId });
  const [selectedCard, setSelectedCard] = useState<string | null>(null);
  const [awaitingTarget, setAwaitingTarget] = useState(false);

  const localPlayer = gameState.players.find((p) => p.id === playerId);
  const isMyTurn    = gameState.currentTurnPlayerId === playerId;
  const drawZone    = gameState.zones.find((z) => z.id === "draw_pile");
  const discardZone = gameState.zones.find((z) => z.id === "discard_pile");
  const activePlayers = gameState.players.filter(
    (p) => p.status !== "eliminated" && p.id !== playerId
  );
  const currentTurnPlayer = gameState.players.find((p) => p.id === gameState.currentTurnPlayerId);

  const handleCardClick = (cardId: string) => {
    if (!isMyTurn) return;
    const card = localPlayer?.hand.cards.find((c) => c.id === cardId);
    if (!card || card.subtype === "defuse" || card.subtype === "exploding") return;

    if (selectedCard === cardId) {
      // Second click = play it
      if (card.subtype === "favor") {
        setAwaitingTarget(true);
      } else {
        playCard(cardId);
        setSelectedCard(null);
      }
    } else {
      setSelectedCard(cardId);
    }
  };

  const handleTargetSelect = (targetId: string) => {
    if (selectedCard) {
      playCard(selectedCard, targetId);
      setSelectedCard(null);
      setAwaitingTarget(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col"
      style={{ background: "radial-gradient(ellipse at 50% 20%, #0d0820 0%, #040208 100%)",
               fontFamily: "'Courier New', monospace" }}>

      {/* Modals */}
      {peekCards && <PeekModal cards={peekCards} onClose={clearPeek} />}
      {awaitingTarget && (
        <TargetModal
          players={activePlayers}
          onSelect={handleTargetSelect}
          onCancel={() => { setAwaitingTarget(false); setSelectedCard(null); }}
        />
      )}

      {/* Error toast */}
      {error && (
        <div onClick={clearError}
          className="fixed top-3 right-3 z-40 bg-red-600/90 text-white text-xs px-3 py-2
            rounded-lg cursor-pointer max-w-xs shadow-lg">
          ⚠ {error}
        </div>
      )}

      {/* Top bar */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-white/8 shrink-0">
        <div>
          <span className="text-white font-black text-sm" style={{ fontFamily: "Georgia, serif" }}>
            💣 Exploding Kittens
          </span>
          <div className="text-[9px] text-white/30 mt-0.5">
            Room <span className="text-orange-400">{roomCode}</span> · Turn {gameState.turnNumber}
          </div>
        </div>
        <div className="flex gap-1.5">
          {gameState.players.map((p) => (
            <div key={p.id} title={p.name}
              className={`text-lg transition-all ${p.status === "eliminated" ? "opacity-20 grayscale" : ""}
                ${p.id === gameState.currentTurnPlayerId ? "ring-2 ring-yellow-400 rounded-full" : ""}`}>
              {p.emoji}
            </div>
          ))}
        </div>
      </div>

      {/* Main layout: sidebar + table */}
      <div className="flex flex-1 overflow-hidden">

        {/* Left sidebar: players + log */}
        <div className="w-44 shrink-0 flex flex-col gap-2 p-3 border-r border-white/8 overflow-y-auto">
          <p className="text-[9px] text-white/25 uppercase tracking-widest">Players</p>
          <div className="flex flex-col gap-1.5">
            {gameState.players.map((p) => (
              <PlayerAvatar key={p.id} player={{ ...p, isLocalPlayer: p.id === playerId }}
                isTurn={p.id === gameState.currentTurnPlayerId} />
            ))}
          </div>
          <div className="mt-auto pt-3 border-t border-white/8">
            <p className="text-[9px] text-white/25 uppercase tracking-widest mb-2">Log</p>
            <LogFeed entries={gameState.log.slice(-10)} />
          </div>
        </div>

        {/* Center table */}
        <div className="flex-1 flex flex-col items-center justify-center gap-5 p-6">
          {/* Table surface */}
          <div className="relative rounded-3xl border border-white/8 flex items-center justify-center gap-8 px-10 py-8"
            style={{
              background: "radial-gradient(ellipse at 50% 50%, #1a1045 0%, #08061a 100%)",
              minWidth: 260, minHeight: 160,
              boxShadow: "inset 0 0 80px rgba(0,0,0,0.6), 0 0 60px rgba(100,40,255,0.08)",
            }}>
            <span className="absolute top-3 left-1/2 -translate-x-1/2 text-[9px] text-white/15 uppercase tracking-[0.2em]">Table</span>
            {drawZone && <ZonePile zone={drawZone} />}
            <span className="text-white/15 text-2xl">⇄</span>
            {discardZone && <ZonePile zone={discardZone} />}
          </div>

          {/* Turn indicator */}
          <div className="text-center">
            {isMyTurn ? (
              <p className="text-yellow-400 font-black text-sm animate-pulse">⚡ Your Turn</p>
            ) : (
              <p className="text-white/30 text-sm">
                Waiting for <span className="text-white/60 font-bold">{currentTurnPlayer?.name}</span>…
              </p>
            )}
          </div>

          {/* Action buttons */}
          {isMyTurn && (
            <div className="flex gap-2.5">
              <button onClick={drawCard}
                className="px-5 py-2.5 rounded-xl font-black text-xs text-white uppercase tracking-widest
                  transition-all hover:scale-105 active:scale-95"
                style={{ background: "linear-gradient(135deg, #ff6b00, #cc2200)",
                         boxShadow: "0 0 20px rgba(255,80,0,0.3)" }}>
                Draw Card
              </button>
              {selectedCard && !awaitingTarget && (
                <button onClick={() => { playCard(selectedCard!); setSelectedCard(null); }}
                  className="px-5 py-2.5 rounded-xl font-black text-xs text-white uppercase tracking-widest
                    transition-all hover:scale-105 active:scale-95"
                  style={{ background: "linear-gradient(135deg, #5500ff, #3300aa)",
                           boxShadow: "0 0 20px rgba(100,0,255,0.3)" }}>
                  Play ✓
                </button>
              )}
              {selectedCard && (
                <button onClick={() => setSelectedCard(null)}
                  className="px-4 py-2.5 rounded-xl font-black text-xs text-white/40 uppercase
                    tracking-widest border border-white/15 hover:border-white/30 transition-colors">
                  Cancel
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Hand */}
      {localPlayer && (
        <div className="shrink-0 border-t border-white/8 bg-black/40 backdrop-blur-sm px-4 py-4">
          <p className="text-[9px] text-white/25 uppercase tracking-widest mb-2.5 text-center">
            Your Hand · {localPlayer.hand.cards.length} cards
            {selectedCard && <span className="text-white/50 ml-2">— tap again to play, or hit Play</span>}
          </p>
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
              <p className="text-white/15 text-sm py-6">No cards in hand</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Room Page (top-level) ─────────────────────────────────────────────────────
export default function RoomPage() {
  const params   = useParams();
  const router   = useRouter();
  const roomCode = (params?.roomId as string || "").toUpperCase();

  const [playerId, setPlayerId] = useState<string | null>(null);
  const [joining, setJoining]   = useState(false);
  const [joinName, setJoinName] = useState("");
  const [joinErr,  setJoinErr]  = useState<string | null>(null);

  const { gameState, isLoading, error } = useGame({
    roomCode,
    playerId: playerId || "__observer__",
  });

  // Restore or prompt to join
  useEffect(() => {
    const { loadSession } = require("../../../services/gameApi");
    const session = loadSession();
    if (session?.roomCode === roomCode && session?.playerId) {
      setPlayerId(session.playerId);
    }
  }, [roomCode]);

  const handleJoinFromLink = async () => {
    if (!joinName.trim()) return;
    setJoining(true); setJoinErr(null);
    try {
      const { joinRoom, saveSession } = require("../../../services/gameApi");
      const res = await joinRoom(roomCode, joinName.trim());
      saveSession({ playerId: res.playerId, playerName: joinName.trim(), roomCode });
      setPlayerId(res.playerId);
    } catch (e) {
      setJoinErr(e instanceof Error ? e.message : "Failed to join");
    } finally {
      setJoining(false);
    }
  };

  const handleStart = async () => {
    if (!playerId) return;
    try {
      const { startGame } = require("../../../services/gameApi");
      await startGame(roomCode, playerId);
    } catch (e) {
      console.error(e);
    }
  };

  // ── Not yet identified — show join prompt ──────────────────────────────────
  if (!playerId) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4"
        style={{ background: "radial-gradient(ellipse at 50% 60%, #1a0800 0%, #060010 100%)" }}>
        <div className="w-full max-w-xs flex flex-col gap-5">
          <div className="text-center">
            <div className="text-6xl mb-2">💣</div>
            <h1 className="text-3xl font-black text-white" style={{ fontFamily: "Georgia, serif" }}>
              Join Room
            </h1>
            <p className="text-orange-400 font-black tracking-widest mt-1">{roomCode}</p>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-2xl p-5 flex flex-col gap-3">
            <label className="text-[10px] text-white/40 uppercase tracking-widest">Your Name</label>
            <input
              value={joinName}
              onChange={(e) => setJoinName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleJoinFromLink()}
              placeholder="Enter your name…"
              maxLength={16}
              className="bg-white/8 border border-white/15 rounded-xl px-4 py-3 text-white text-sm
                outline-none focus:border-orange-400/60 transition-colors placeholder-white/20"
              style={{ fontFamily: "'Courier New', monospace" }}
            />
            {joinErr && <p className="text-red-400 text-xs">⚠ {joinErr}</p>}
            <button
              onClick={handleJoinFromLink}
              disabled={joining || !joinName.trim()}
              className="w-full py-3 rounded-xl font-black text-sm text-white uppercase tracking-widest
                transition-all hover:scale-105 active:scale-95 disabled:opacity-30"
              style={{
                fontFamily: "'Courier New', monospace",
                background: "linear-gradient(135deg, #8800ff, #4400cc)",
                boxShadow: "0 0 30px rgba(150,0,255,0.3)",
              }}>
              {joining ? "Joining…" : "🚀 Join Game"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Loading ────────────────────────────────────────────────────────────────
  if (isLoading || !gameState) {
    return (
      <div className="min-h-screen flex items-center justify-center"
        style={{ background: "#060010" }}>
        <div className="text-center">
          <div className="text-5xl mb-4 animate-spin">💣</div>
          <p className="text-white/40 text-sm uppercase tracking-widest">Connecting…</p>
          {error && <p className="text-red-400 text-xs mt-2">{error}</p>}
        </div>
      </div>
    );
  }

  // ── Route to correct screen ────────────────────────────────────────────────
  if (gameState.phase === "ended") {
    return <EndScreen winner={gameState.winner} onPlayAgain={() => router.push("/")} />;
  }

  if (gameState.phase === "lobby") {
    return (
      <LobbyScreen
        gameState={gameState}
        playerId={playerId}
        roomCode={roomCode}
        onStart={handleStart}
      />
    );
  }

  return <GameBoard gameState={gameState} playerId={playerId} roomCode={roomCode} />;
}
