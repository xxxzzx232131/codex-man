import { ReactNode } from "react";
import { LogOut, TerminalSquare, ShieldAlert, Cpu } from "lucide-react";
import { useAuthStore } from "@/store/auth";
import { Button } from "@/components/ui/button";
import { useGetRegistrationStatus } from "@workspace/api-client-react";
import { motion } from "framer-motion";

export function Layout({ children }: { children: ReactNode }) {
  const logout = useAuthStore(state => state.logout);
  
  // Poll status to keep top nav indicator accurate
  const { data: status } = useGetRegistrationStatus({
    query: { refetchInterval: 3000 }
  });

  const isRunning = status?.running;

  return (
    <div className="min-h-screen flex flex-col bg-background selection:bg-primary/20">
      {/* Top Navigation */}
      <header className="sticky top-0 z-50 w-full border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between max-w-7xl">
          
          <div className="flex items-center gap-3">
            <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20">
              <Cpu className="h-5 w-5" />
              {isRunning && (
                <span className="absolute -top-1 -right-1 flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-primary"></span>
                </span>
              )}
            </div>
            <div>
              <h1 className="font-display font-bold text-xl tracking-tight leading-none text-foreground flex items-center gap-2">
                Codex<span className="text-primary">Man</span>
              </h1>
              <p className="text-xs text-muted-foreground font-mono leading-none mt-1">OpenAI Batch Reg</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Status Indicator */}
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-secondary/50 border border-border">
              <div className={`h-2 w-2 rounded-full ${isRunning ? 'bg-primary shadow-[0_0_8px_hsla(142,71%,45%,0.8)]' : 'bg-muted-foreground'}`} />
              <span className="text-sm font-medium font-mono text-muted-foreground">
                {isRunning ? 'SYSTEM ACTIVE' : 'SYSTEM IDLE'}
              </span>
            </div>

            <Button 
              variant="ghost" 
              size="sm" 
              onClick={logout}
              className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
            >
              <LogOut className="h-4 w-4 mr-2" />
              Disconnect
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 w-full relative">
        {/* Abstract background glow */}
        <div className="absolute top-0 inset-x-0 h-[500px] bg-primary/5 blur-[120px] pointer-events-none -z-10 rounded-full max-w-4xl mx-auto" />
        
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className="container mx-auto px-4 py-8 max-w-7xl"
        >
          {children}
        </motion.div>
      </main>
    </div>
  );
}
