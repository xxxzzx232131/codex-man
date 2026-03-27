import { useEffect, useRef } from "react";
import { Terminal, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { useLiveLogs } from "@/hooks/use-live-logs";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export function LogsTerminal() {
  const { logs, isConnected, error, clearLogs } = useLiveLogs();
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  const getLogColor = (level: string) => {
    switch (level) {
      case 'info': return 'text-blue-400';
      case 'success': return 'text-primary terminal-text-shadow';
      case 'error': return 'text-destructive terminal-text-shadow';
      case 'warning': return 'text-yellow-400';
      default: return 'text-muted-foreground';
    }
  };

  return (
    <Card className="border-border/50 shadow-lg bg-card/50 backdrop-blur-sm flex flex-col h-[800px] overflow-hidden">
      <CardHeader className="pb-3 border-b border-border/50 bg-background/50 shrink-0">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-sm font-mono tracking-tight uppercase text-muted-foreground">
            <Terminal className="h-4 w-4" />
            System Console
            <div className="flex items-center gap-2 ml-4">
              <span className="relative flex h-2 w-2">
                {isConnected ? (
                  <>
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
                  </>
                ) : (
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-destructive"></span>
                )}
              </span>
              <span className="text-xs normal-case">{isConnected ? 'Stream Active' : 'Disconnected'}</span>
            </div>
          </CardTitle>
          <Button variant="ghost" size="icon" onClick={clearLogs} className="h-7 w-7 text-muted-foreground hover:text-foreground">
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 bg-[#0A0A0B] font-mono text-[13px] leading-relaxed terminal-scrollbar"
      >
        {error && (
          <div className="text-destructive mb-4 pb-2 border-b border-destructive/20 opacity-80">
            [SYS] {error}
          </div>
        )}
        
        {logs.length === 0 ? (
          <div className="text-muted-foreground/50 h-full flex items-center justify-center italic">
            Waiting for log stream...
          </div>
        ) : (
          <div className="space-y-1.5 pb-4">
            {logs.map((log, i) => (
              <div key={`${log.id}-${i}`} className="flex gap-3 hover:bg-white/[0.02] px-1 rounded transition-colors break-words">
                <span className="text-muted-foreground/50 shrink-0 select-none">
                  {format(new Date(log.timestamp), 'HH:mm:ss.SSS')}
                </span>
                <span className={`font-semibold shrink-0 uppercase w-16 ${getLogColor(log.level)}`}>
                  [{log.level}]
                </span>
                <span className="text-foreground/90 whitespace-pre-wrap">
                  {log.message}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}
