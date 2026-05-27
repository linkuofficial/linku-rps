import { useEffect, useRef, useCallback, useState } from 'react';
import type { ClientMessage, ServerMessage } from '@rps/shared';

type MessageHandler = (msg: ServerMessage) => void;
type ReconnectMessageFactory = () => ClientMessage | null;
type ConnectionState = 'connecting' | 'connected' | 'reconnecting' | 'disconnected';

function resolveSocketUrl(): string {
  const wsUrl = import.meta.env.VITE_WS_URL as string | undefined;
  if (!wsUrl) return 'ws://localhost:3001';

  const normalized = wsUrl.trim();
  if (normalized.startsWith('wss://') || normalized.startsWith('ws://')) {
    return normalized;
  }
  if (normalized.startsWith('https://')) {
    return normalized.replace('https://', 'wss://');
  }
  if (normalized.startsWith('http://')) {
    return normalized.replace('http://', 'ws://');
  }
  return `wss://${normalized}`;
}

export function useWebSocket(onMessage: MessageHandler, getReconnectMessage?: ReconnectMessageFactory) {
  const wsRef = useRef<WebSocket | null>(null);
  const onMessageRef = useRef(onMessage);
  const getReconnectMessageRef = useRef<ReconnectMessageFactory | undefined>(getReconnectMessage);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const hasConnectedRef = useRef(false);
  const manualCloseRef = useRef(false);
  const connectIdRef = useRef(0);

  const [connected, setConnected] = useState(false);
  const [connectionState, setConnectionState] = useState<ConnectionState>('connecting');
  const [reconnectAttempt, setReconnectAttempt] = useState(0);

  onMessageRef.current = onMessage;
  getReconnectMessageRef.current = getReconnectMessage;

  const socketUrl = resolveSocketUrl();

  const clearReconnectTimer = useCallback(() => {
    if (!reconnectTimerRef.current) return;
    clearTimeout(reconnectTimerRef.current);
    reconnectTimerRef.current = null;
  }, []);

  const connect = useCallback(() => {
    if (manualCloseRef.current) return;

    setConnectionState(hasConnectedRef.current ? 'reconnecting' : 'connecting');

    const myId = ++connectIdRef.current;
    const ws = new WebSocket(socketUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      setConnectionState('connected');
      setReconnectAttempt(0);
      reconnectAttemptsRef.current = 0;
      hasConnectedRef.current = true;

      const reconnectMessage = getReconnectMessageRef.current?.();
      if (reconnectMessage) {
        ws.send(JSON.stringify(reconnectMessage));
      }
    };

    ws.onerror = () => {
      ws.close();
    };

    ws.onclose = () => {
      setConnected(false);

      if (manualCloseRef.current) {
        setConnectionState('disconnected');
        return;
      }

      // Stale socket: a newer connect() has already taken over.
      if (myId !== connectIdRef.current) return;

      setConnectionState('reconnecting');
      const nextAttempt = reconnectAttemptsRef.current + 1;
      reconnectAttemptsRef.current = nextAttempt;
      setReconnectAttempt(nextAttempt);

      const delay = Math.min(1000 * 2 ** (nextAttempt - 1), 8000);
      clearReconnectTimer();
      reconnectTimerRef.current = setTimeout(() => connect(), delay);
    };

    ws.onmessage = ({ data }) => {
      try {
        const msg: ServerMessage = JSON.parse(data);
        onMessageRef.current(msg);
      } catch {
        // ignore malformed packet
      }
    };
  }, [clearReconnectTimer, socketUrl]);

  useEffect(() => {
    manualCloseRef.current = false;
    connect();

    return () => {
      manualCloseRef.current = true;
      clearReconnectTimer();
      wsRef.current?.close();
    };
  }, [clearReconnectTimer, connect]);

  const send = useCallback((msg: ClientMessage): boolean => {
    if (wsRef.current?.readyState !== WebSocket.OPEN) {
      return false;
    }
    wsRef.current.send(JSON.stringify(msg));
    return true;
  }, []);

  const reconnectNow = useCallback(() => {
    manualCloseRef.current = true;
    clearReconnectTimer();
    wsRef.current?.close();
    manualCloseRef.current = false;
    reconnectAttemptsRef.current = 0;
    setReconnectAttempt(0);
    connect();
  }, [clearReconnectTimer, connect]);

  return {
    send,
    connected,
    connectionState,
    reconnectAttempt,
    reconnectNow,
  };
}