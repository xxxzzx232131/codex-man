import { useState, useEffect, useRef, useCallback } from "react";
import type { LogEntry } from "@workspace/api-client-react";

export function useLiveLogs() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const esRef = useRef<EventSource | null>(null);

  const fetchLogs = useCallback(async () => {
    try {
      const res = await fetch("/api/logs");
      if (res.ok) {
        const data = await res.json() as { logs: LogEntry[] };
        setLogs(data.logs ?? []);
      }
    } catch {
    }
  }, []);

  useEffect(() => {
    fetchLogs();

    const connect = () => {
      esRef.current = new EventSource("/api/logs/stream");

      esRef.current.onopen = () => {
        setIsConnected(true);
        setError(null);
      };

      esRef.current.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data) as { type: string };
          if (msg.type === "update") {
            fetchLogs();
          }
        } catch {
        }
      };

      esRef.current.onerror = () => {
        setIsConnected(false);
        setError("Connection lost. Reconnecting...");
        esRef.current?.close();
        setTimeout(connect, 5000);
      };
    };

    connect();

    const poll = setInterval(fetchLogs, 3000);

    return () => {
      esRef.current?.close();
      setIsConnected(false);
      clearInterval(poll);
    };
  }, [fetchLogs]);

  const clearLogs = () => setLogs([]);

  return { logs, isConnected, error, clearLogs };
}
