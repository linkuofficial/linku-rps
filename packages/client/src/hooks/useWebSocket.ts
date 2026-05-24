import { useEffect, useRef, useCallback, useState } from 'react';
import type { ClientMessage, ServerMessage } from '@rps/shared';

type MessageHandler = (msg: ServerMessage) => void;

export function useWebSocket(onMessage: MessageHandler) {
  const wsRef = useRef<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const wsUrl = import.meta.env.VITE_WS_URL as string | undefined;
    let host: string;
    let proto: string;

    if (wsUrl) {
      const url = new URL(wsUrl);
      host = url.host;
      proto = url.protocol === 'https:' ? 'wss' : 'ws';
    } else {
      host = 'localhost:3001';
      proto = 'ws';
    }

    const ws = new WebSocket(`${proto}://${host}`);
    wsRef.current = ws;

    ws.onopen = () => setConnected(true);
    ws.onclose = () => setConnected(false);
    ws.onmessage = ({ data }) => {
      try {
        const msg: ServerMessage = JSON.parse(data);
        onMessage(msg);
      } catch {}
    };

    return () => { ws.close(); };
  }, []);

  const send = useCallback((msg: ClientMessage) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
    }
  }, []);

  return { send, connected };
}