import { useCallback, useEffect, useRef, useState } from 'react';
import type { ClientMessage, ServerMessage } from '@rps/shared';
import { useWebSocket } from './useWebSocket';
import { LocalSession } from '../local/localSession';

type MessageHandler = (msg: ServerMessage) => void;
type ReconnectMessageFactory = () => ClientMessage | null;

/** Where the current game is being played. */
export type SessionMode = 'remote' | 'local';

/**
 * Picks the transport for a game and then sticks with it.
 *
 * The choice is made once, when a room is created: a live socket always wins, because only
 * the server can hand out a room code for a second player to join. If there is no socket —
 * the backend is a free tier that can simply go away — a solo-capable tool falls back to
 * playing in the browser instead of leaving the user with a button that does nothing.
 *
 * Nothing switches transports mid-game, so a game that started locally stays coherent even
 * if the backend comes back halfway through.
 */
export function useSession(onMessage: MessageHandler, getReconnectMessage?: ReconnectMessageFactory) {
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  const [mode, setMode] = useState<SessionMode>('remote');
  const modeRef = useRef<SessionMode>('remote');

  const localRef = useRef<LocalSession | null>(null);
  if (!localRef.current) {
    localRef.current = new LocalSession((msg) => onMessageRef.current(msg));
  }

  const setSessionMode = useCallback((next: SessionMode) => {
    modeRef.current = next;
    setMode(next);
  }, []);

  // A local game has no server-side room, so there is nothing to reconnect to. Suppressing
  // this also stops a stale snapshot from an earlier online game being replayed at the
  // server (and surfacing an auth error) in the middle of an offline one.
  const reconnectFactory = useCallback(() => {
    if (modeRef.current === 'local') return null;
    return getReconnectMessage?.() ?? null;
  }, [getReconnectMessage]);

  // Stable identity: useWebSocket reconnects when its handler identity changes.
  const handleServerMessage = useCallback((msg: ServerMessage) => onMessageRef.current(msg), []);
  const socket = useWebSocket(handleServerMessage, reconnectFactory);
  const { send: socketSend, connected } = socket;

  const send = useCallback(
    (msg: ClientMessage): boolean => {
      const local = localRef.current!;

      if (msg.type === 'create_room') {
        if (connected && socketSend(msg)) {
          local.close();
          setSessionMode('remote');
          return true;
        }
        if (local.send(msg)) {
          setSessionMode('local');
          return true;
        }
        return false;
      }

      if (modeRef.current === 'local') return local.send(msg);
      return socketSend(msg);
    },
    [connected, socketSend, setSessionMode],
  );

  // A local game owns real timers (the reaction countdown). Drop them with the hook so a
  // round in flight cannot fire into an unmounted tree.
  useEffect(() => {
    const local = localRef.current;
    return () => local?.close();
  }, []);

  /** Tear down any local game — used when the player returns to the tool list. */
  const endLocalSession = useCallback(() => {
    localRef.current?.close();
    setSessionMode('remote');
  }, [setSessionMode]);

  return {
    ...socket,
    send,
    mode,
    /** True while the current game is running in the browser rather than on the server. */
    isLocal: mode === 'local',
    endLocalSession,
  };
}
