import { useState, useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getGetLogsQueryKey } from "@workspace/api-client-react";
import type { LogEntry } from "@workspace/api-client-react";

export function useLiveLogs() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const esRef = useRef<EventSource | null>(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    // Attempt to hydrate with existing cache if available
    const cachedLogs = queryClient.getQueryData<{ logs: LogEntry[] }>(getGetLogsQueryKey());
    if (cachedLogs?.logs) {
      setLogs(cachedLogs.logs);
    }

    const connect = () => {
      esRef.current = new EventSource('/api/logs/stream');
      
      esRef.current.onopen = () => {
        setIsConnected(true);
        setError(null);
      };

      esRef.current.onmessage = (event) => {
        try {
          const newLog = JSON.parse(event.data) as LogEntry;
          setLogs(prev => {
            // Keep maximum of 1000 logs in memory to prevent performance issues
            const updated = [...prev, newLog];
            if (updated.length > 1000) return updated.slice(updated.length - 1000);
            return updated;
          });
        } catch (err) {
          console.error("Failed to parse log entry:", err);
        }
      };

      esRef.current.onerror = () => {
        setIsConnected(false);
        setError("Connection to log stream lost. Reconnecting...");
        esRef.current?.close();
        // Simple exponential backoff or static delay reconnect could go here
        setTimeout(connect, 5000);
      };
    };

    connect();

    return () => {
      esRef.current?.close();
      setIsConnected(false);
    };
  }, [queryClient]);

  const clearLogs = () => setLogs([]);

  return { logs, isConnected, error, clearLogs };
}
