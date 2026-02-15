"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { buildWsUrl } from "~/lib/api";
import type { GameSessionState } from "~/types/multiplayer";

interface SocketMessage {
	type: string;
	detail?: string;
	session?: GameSessionState;
	action?: unknown;
}

export function useGameSocket(gameCode: string, playerId: string) {
	const [connected, setConnected] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [session, setSession] = useState<GameSessionState | null>(null);
	const [events, setEvents] = useState<SocketMessage[]>([]);
	const socketRef = useRef<WebSocket | null>(null);

	const wsUrl = useMemo(
		() => buildWsUrl(gameCode, playerId),
		[gameCode, playerId],
	);

	useEffect(() => {
		if (!gameCode || !playerId) {
			return;
		}
		const ws = new WebSocket(wsUrl);
		socketRef.current = ws;

		ws.onopen = () => {
			setConnected(true);
			setError(null);
		};

		ws.onclose = () => {
			setConnected(false);
		};

		ws.onerror = () => {
			setError("WebSocket connection failed.");
		};

		ws.onmessage = (event) => {
			try {
				const payload = JSON.parse(event.data) as SocketMessage;
				setEvents((prev) => [payload, ...prev].slice(0, 30));
				if (payload.session) {
					setSession(payload.session);
				}
				if (payload.type === "error" && payload.detail) {
					setError(payload.detail);
				}
			} catch {
				setError("Received invalid WebSocket payload.");
			}
		};

		return () => {
			ws.close();
			socketRef.current = null;
		};
	}, [gameCode, playerId, wsUrl]);

	function send(type: string, payload?: unknown) {
		const socket = socketRef.current;
		if (!socket || socket.readyState !== WebSocket.OPEN) {
			setError("Socket is not connected.");
			return;
		}
		socket.send(JSON.stringify({ type, payload }));
	}

	return {
		connected,
		error,
		session,
		events,
		send,
	};
}
