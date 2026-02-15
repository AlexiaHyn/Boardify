"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createRoom, joinRoom, saveSession } from "../services/gameApi";

type Tab = "create" | "join";

export default function HomePage() {
  const router   = useRouter();
  const [tab, setTab]           = useState<Tab>("create");
  const [name, setName]         = useState("");
  const [code, setCode]         = useState("");
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);

  const handleCreate = async () => {
    if (!name.trim()) return;
    setLoading(true); setError(null);
    try {
      const res = await createRoom(name.trim());
      saveSession({ playerId: res.playerId, playerName: name.trim(), roomCode: res.roomCode });
      router.push(`/room/${res.roomCode}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create room");
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async () => {
    if (!name.trim() || !code.trim()) return;
    setLoading(true); setError(null);
    try {
      const res = await joinRoom(code.trim(), name.trim());
      saveSession({ playerId: res.playerId, playerName: name.trim(), roomCode: res.roomCode });
      router.push(`/room/${res.roomCode}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to join room");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center relative overflow-hidden"
      style={{ background: "radial-gradient(ellipse at 50% 60%, #1a0800 0%, #060010 100%)" }}
    >
      {/* Animated background sparks */}
      {[...Array(20)].map((_, i) => (
        <div key={i} className="absolute rounded-full animate-pulse pointer-events-none"
          style={{
            width: Math.random() * 5 + 2, height: Math.random() * 5 + 2,
            background: i % 3 === 0 ? "#ff6b00" : i % 3 === 1 ? "#ff0055" : "#cc00ff",
            left: `${Math.random() * 100}%`, top: `${Math.random() * 100}%`,
            opacity: Math.random() * 0.3 + 0.05,
            animationDelay: `${Math.random() * 4}s`,
            animationDuration: `${Math.random() * 3 + 2}s`,
          }}
        />
      ))}

      <div className="relative z-10 flex flex-col items-center gap-8 w-full max-w-sm px-4">
        {/* Title */}
        <div className="text-center select-none">
          <div className="text-8xl mb-3" style={{ filter: "drop-shadow(0 0 30px rgba(255,80,0,0.6))" }}>💣</div>
          <h1 className="text-5xl font-black text-white leading-none"
            style={{ fontFamily: "Georgia, serif", textShadow: "0 0 60px rgba(255,100,0,0.4)" }}>
            Exploding
          </h1>
          <h1 className="text-5xl font-black leading-none mb-2"
            style={{
              fontFamily: "Georgia, serif",
              background: "linear-gradient(90deg, #ff6b00, #ff0055, #cc00ff)",
              WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
            }}>
            Kittens
          </h1>
          <p className="text-white/30 text-xs tracking-[0.3em] uppercase">Multiplayer · 2–5 Players</p>
        </div>

        {/* Card */}
        <div className="w-full rounded-2xl border border-white/10 overflow-hidden"
          style={{ background: "rgba(255,255,255,0.04)", backdropFilter: "blur(20px)", boxShadow: "0 0 80px rgba(200,50,255,0.1)" }}>

          {/* Tabs */}
          <div className="flex border-b border-white/10">
            {(["create", "join"] as Tab[]).map((t) => (
              <button key={t} onClick={() => { setTab(t); setError(null); }}
                className={`flex-1 py-3 text-sm font-black uppercase tracking-widest transition-all
                  ${tab === t ? "text-white border-b-2 border-orange-400" : "text-white/30 hover:text-white/60"}`}
                style={{ fontFamily: "'Courier New', monospace" }}>
                {t === "create" ? "🏠 Host Game" : "🔗 Join Game"}
              </button>
            ))}
          </div>

          <div className="p-6 flex flex-col gap-4">
            {/* Name input — always shown */}
            <div>
              <label className="text-[10px] text-white/40 uppercase tracking-widest block mb-1.5">Your Name</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && (tab === "create" ? handleCreate() : handleJoin())}
                placeholder="Enter your name…"
                maxLength={16}
                className="w-full bg-white/8 border border-white/15 rounded-xl px-4 py-3 text-white text-sm outline-none
                  focus:border-orange-400/60 transition-colors placeholder-white/20"
                style={{ fontFamily: "'Courier New', monospace" }}
              />
            </div>

            {/* Room code input — join only */}
            {tab === "join" && (
              <div>
                <label className="text-[10px] text-white/40 uppercase tracking-widest block mb-1.5">Room Code</label>
                <input
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  onKeyDown={(e) => e.key === "Enter" && handleJoin()}
                  placeholder="e.g. ABC123"
                  maxLength={6}
                  className="w-full bg-white/8 border border-white/15 rounded-xl px-4 py-3 text-white text-sm outline-none
                    focus:border-purple-400/60 transition-colors placeholder-white/20 tracking-[0.3em] uppercase"
                  style={{ fontFamily: "'Courier New', monospace" }}
                />
              </div>
            )}

            {error && (
              <div className="text-red-400 text-xs bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">
                ⚠ {error}
              </div>
            )}

            <button
              onClick={tab === "create" ? handleCreate : handleJoin}
              disabled={loading || !name.trim() || (tab === "join" && code.length < 4)}
              className="w-full py-3 rounded-xl font-black text-sm uppercase tracking-widest transition-all
                hover:scale-105 active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed disabled:scale-100"
              style={{
                fontFamily: "'Courier New', monospace",
                background: tab === "create"
                  ? "linear-gradient(135deg, #ff6b00, #cc2200)"
                  : "linear-gradient(135deg, #8800ff, #4400cc)",
                boxShadow: tab === "create"
                  ? "0 0 30px rgba(255,80,0,0.3)"
                  : "0 0 30px rgba(150,0,255,0.3)",
                color: "white",
              }}
            >
              {loading ? "⏳ Connecting…" : tab === "create" ? "💣 Create Room" : "🚀 Join Room"}
            </button>
          </div>
        </div>

        <p className="text-white/20 text-[11px] text-center">
          Host a game and share the link — friends join instantly, no account needed.
        </p>
      </div>
    </div>
  );
}
