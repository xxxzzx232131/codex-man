import { useState } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { Shield, KeyRound, Cpu } from "lucide-react";
import { useVerifyPassword } from "@workspace/api-client-react";
import { useAuthStore } from "@/store/auth";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function Login() {
  const [password, setPassword] = useState("");
  const [, setLocation] = useLocation();
  const login = useAuthStore(state => state.login);
  const [errorMsg, setErrorMsg] = useState("");

  const verifyMutation = useVerifyPassword({
    mutation: {
      onSuccess: (data) => {
        if (data.success) {
          login();
          setLocation("/");
        } else {
          setErrorMsg(data.message || "Invalid credentials");
        }
      },
      onError: () => {
        setErrorMsg("Authentication failed. Check server connection.");
      }
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) return;
    setErrorMsg("");
    verifyMutation.mutate({ data: { password } });
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center relative overflow-hidden bg-background">
      {/* Abstract Background Elements */}
      <div className="absolute inset-0 z-0">
        <img 
          src={`${import.meta.env.BASE_URL}images/login-bg.png`} 
          alt="Abstract Tech Background" 
          className="w-full h-full object-cover opacity-20 mix-blend-screen"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/80 to-transparent" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-primary/10 blur-[150px] rounded-full pointer-events-none" />
      </div>

      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
        className="z-10 w-full max-w-md px-4"
      >
        <Card className="border-border/50 shadow-2xl shadow-primary/5 bg-card/60 backdrop-blur-xl">
          <CardHeader className="space-y-4 text-center pb-6">
            <motion.div 
              initial={{ rotate: -10 }}
              animate={{ rotate: 0 }}
              transition={{ delay: 0.2, type: "spring" }}
              className="mx-auto bg-primary/10 w-16 h-16 rounded-2xl flex items-center justify-center border border-primary/20 shadow-[0_0_30px_-5px_hsla(142,71%,45%,0.4)]"
            >
              <Cpu className="h-8 w-8 text-primary" />
            </motion.div>
            <div className="space-y-2">
              <CardTitle className="text-3xl font-display tracking-tight">Codex<span className="text-primary">Man</span> System</CardTitle>
              <CardDescription className="text-base">Enter administrative credentials to access the registration engine.</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2 relative">
                <KeyRound className="absolute left-3 top-3 h-5 w-5 text-muted-foreground" />
                <Input
                  type="password"
                  placeholder="Password"
                  className="pl-10 h-12 bg-background/50 border-border/50 text-lg transition-colors focus-visible:ring-primary/50"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoFocus
                />
              </div>
              
              {errorMsg && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="text-destructive text-sm text-center font-medium bg-destructive/10 py-2 rounded-md border border-destructive/20"
                >
                  {errorMsg}
                </motion.div>
              )}

              <Button 
                type="submit" 
                className="w-full h-12 text-base font-semibold shadow-[0_0_20px_-5px_hsla(142,71%,45%,0.4)] hover:shadow-[0_0_25px_-5px_hsla(142,71%,45%,0.6)] transition-all bg-primary hover:bg-primary/90 text-primary-foreground"
                disabled={verifyMutation.isPending}
              >
                {verifyMutation.isPending ? (
                  <span className="flex items-center gap-2">
                    <Shield className="h-5 w-5 animate-pulse" />
                    Verifying...
                  </span>
                ) : (
                  "Authenticate"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
