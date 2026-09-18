import type { ClientMessage, ServerMessage } from '@pescuit/shared';

export type ConnectionStatus = 'connecting' | 'open' | 'closed';

export interface WsClient {
  send(msg: ClientMessage): void;
  close(): void;
}

function wsUrl(): string {
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  return `${proto}://${location.host}/ws`;
}

/** Thin reconnecting WebSocket wrapper. Reconnection *semantics* (rejoin-by-token)
 *  are the caller's job -- this just guarantees the socket itself comes back. */
export function createClient(
  onMessage: (msg: ServerMessage) => void,
  onStatus: (status: ConnectionStatus) => void,
): WsClient {
  let ws: WebSocket | null = null;
  let closed = false;
  let retryDelay = 500;
  const queue: ClientMessage[] = [];

  function connect() {
    if (closed) return;
    onStatus('connecting');
    ws = new WebSocket(wsUrl());
    ws.onopen = () => {
      retryDelay = 500;
      onStatus('open');
      for (const m of queue.splice(0)) ws!.send(JSON.stringify(m));
    };
    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data) as ServerMessage;
        onMessage(msg);
      } catch {
        // ignore malformed frames
      }
    };
    ws.onclose = () => {
      if (closed) return;
      onStatus('closed');
      setTimeout(connect, retryDelay);
      retryDelay = Math.min(retryDelay * 1.7, 8000);
    };
    ws.onerror = () => {
      ws?.close();
    };
  }

  connect();

  return {
    send(msg: ClientMessage) {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(msg));
      } else {
        queue.push(msg);
      }
    },
    close() {
      closed = true;
      ws?.close();
    },
  };
}
