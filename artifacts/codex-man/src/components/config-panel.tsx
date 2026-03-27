import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Play, Square, Activity, Settings2, Shield, Zap, Info, IterationCcw } from "lucide-react";
import { useStartRegistration, useStopRegistration, useGetRegistrationStatus } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";

const configSchema = z.object({
  proxy: z.string().optional(),
  concurrency: z.coerce.number().min(1, "Minimum 1").max(50, "Maximum 50"),
  rounds: z.coerce.number().min(0, "0 for unlimited"),
  minDelay: z.coerce.number().min(0),
  maxDelay: z.coerce.number().min(0),
  singleMode: z.boolean().default(false),
  disableSub2Api: z.boolean().default(false),
}).refine((data) => data.maxDelay >= data.minDelay, {
  message: "Max delay must be greater than or equal to min delay",
  path: ["maxDelay"],
});

type ConfigFormValues = z.infer<typeof configSchema>;

export function ConfigPanel() {
  const { toast } = useToast();
  
  // Status Polling
  const { data: status, refetch: refetchStatus } = useGetRegistrationStatus({
    query: { refetchInterval: 2000 }
  });

  const startMutation = useStartRegistration({
    mutation: {
      onSuccess: () => {
        toast({ title: "Registration Started", description: "Task engine initialized successfully." });
        refetchStatus();
      },
      onError: (err: any) => {
        toast({ 
          title: "Failed to start", 
          description: err.message || "Unknown error occurred", 
          variant: "destructive" 
        });
      }
    }
  });

  const stopMutation = useStopRegistration({
    mutation: {
      onSuccess: () => {
        toast({ title: "Registration Stopped", description: "Stop signal sent to task engine." });
        refetchStatus();
      }
    }
  });

  const form = useForm<ConfigFormValues>({
    resolver: zodResolver(configSchema),
    defaultValues: {
      proxy: "",
      concurrency: 5,
      rounds: 0,
      minDelay: 1000,
      maxDelay: 5000,
      singleMode: false,
      disableSub2Api: false,
    },
  });

  const isRunning = status?.running || false;

  const onSubmit = (data: ConfigFormValues) => {
    if (isRunning) return;
    startMutation.mutate({ data });
  };

  const handleStop = () => {
    if (!isRunning) return;
    stopMutation.mutate();
  };

  // Calculate progress safely
  const calculateProgress = () => {
    if (!status) return 0;
    if (status.total === 0) return 0;
    return Math.min(100, Math.round(((status.completed + status.failed) / status.total) * 100));
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      
      {/* Settings Column */}
      <Card className="lg:col-span-8 border-border/50 shadow-lg bg-card/50 backdrop-blur-sm">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-xl">
                <Settings2 className="h-5 w-5 text-primary" />
                Task Configuration
              </CardTitle>
              <CardDescription>Configure parameters before launching the registration engine</CardDescription>
            </div>
            <div className="flex gap-3">
              {!isRunning ? (
                <Button 
                  onClick={form.handleSubmit(onSubmit)}
                  disabled={startMutation.isPending}
                  className="bg-primary text-primary-foreground hover:bg-primary/90 shadow-[0_0_15px_-3px_hsla(142,71%,45%,0.3)] hover:shadow-[0_0_20px_-3px_hsla(142,71%,45%,0.5)] transition-all"
                >
                  {startMutation.isPending ? "Starting..." : (
                    <>
                      <Play className="h-4 w-4 mr-2 fill-current" />
                      Start Engine
                    </>
                  )}
                </Button>
              ) : (
                <Button 
                  variant="destructive"
                  onClick={handleStop}
                  disabled={stopMutation.isPending}
                  className="shadow-[0_0_15px_-3px_hsla(0,84%,60%,0.3)] hover:shadow-[0_0_20px_-3px_hsla(0,84%,60%,0.5)] transition-all"
                >
                  {stopMutation.isPending ? "Stopping..." : (
                    <>
                      <Square className="h-4 w-4 mr-2 fill-current" />
                      Stop Execution
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form className="space-y-6" onSubmit={form.handleSubmit(onSubmit)}>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Proxy */}
                <FormField
                  control={form.control}
                  name="proxy"
                  render={({ field }) => (
                    <FormItem className="md:col-span-2">
                      <FormLabel className="flex items-center gap-2">
                        <Shield className="h-4 w-4 text-muted-foreground" />
                        Proxy Address
                      </FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="http://user:pass@host:port or socks5://..." 
                          className="font-mono bg-background/50" 
                          disabled={isRunning}
                          {...field} 
                        />
                      </FormControl>
                      <FormDescription>Optional. Leave blank to use direct connection.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Concurrency */}
                <FormField
                  control={form.control}
                  name="concurrency"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-2">
                        <Zap className="h-4 w-4 text-muted-foreground" />
                        Concurrency
                      </FormLabel>
                      <FormControl>
                        <Input type="number" min={1} max={50} className="bg-background/50 font-mono" disabled={isRunning} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Rounds */}
                <FormField
                  control={form.control}
                  name="rounds"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-2">
                        <IterationCcw className="h-4 w-4 text-muted-foreground" />
                        Batch Rounds (0 = Infinite)
                      </FormLabel>
                      <FormControl>
                        <Input type="number" min={0} className="bg-background/50 font-mono" disabled={isRunning} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Delays */}
                <div className="grid grid-cols-2 gap-4 md:col-span-2 p-4 rounded-xl border border-border/50 bg-background/30">
                  <FormField
                    control={form.control}
                    name="minDelay"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Min Delay (ms)</FormLabel>
                        <FormControl>
                          <Input type="number" min={0} className="bg-background/50 font-mono" disabled={isRunning} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="maxDelay"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Max Delay (ms)</FormLabel>
                        <FormControl>
                          <Input type="number" min={0} className="bg-background/50 font-mono" disabled={isRunning} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="col-span-2 text-xs text-muted-foreground flex items-center gap-1.5 mt-1">
                    <Info className="h-3.5 w-3.5" />
                    Random delay added between each execution round to prevent rate limiting.
                  </div>
                </div>

                {/* Switches */}
                <div className="flex flex-col gap-4 md:col-span-2 pt-2">
                  <FormField
                    control={form.control}
                    name="singleMode"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-xl border border-border/50 bg-background/30 p-4">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">Single Mode</FormLabel>
                          <FormDescription>
                            Register exactly one account and halt.
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            disabled={isRunning}
                            className="data-[state=checked]:bg-primary"
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="disableSub2Api"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-xl border border-border/50 bg-background/30 p-4">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">Disable Sub2Api</FormLabel>
                          <FormDescription>
                            Turn off webhook pushing logic upon successful registration.
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            disabled={isRunning}
                            className="data-[state=checked]:bg-primary"
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>

              </div>
            </form>
          </Form>
        </CardContent>
      </Card>

      {/* Status Column */}
      <Card className="lg:col-span-4 border-border/50 shadow-lg bg-card/50 backdrop-blur-sm relative overflow-hidden">
        {/* Glow effect based on status */}
        <div className={`absolute -top-24 -right-24 w-48 h-48 rounded-full blur-[80px] pointer-events-none transition-colors duration-1000 ${isRunning ? 'bg-primary/20' : 'bg-muted/10'}`} />
        
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
            <Activity className="h-5 w-5 text-primary" />
            Live Telemetry
          </CardTitle>
          <CardDescription>Current execution metrics</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 relative z-10">
          
          <div className="flex items-center justify-between p-4 rounded-xl border border-border/50 bg-background/50">
            <span className="font-medium text-muted-foreground">Engine State</span>
            {isRunning ? (
              <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 animate-pulse-slow">
                Running
              </Badge>
            ) : (
              <Badge variant="secondary" className="text-muted-foreground">
                Stopped
              </Badge>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Round Progress</span>
              <span className="font-mono font-medium">
                {status?.currentRound || 0} / {status?.totalRounds || '∞'}
              </span>
            </div>
            <Progress value={status?.totalRounds ? ((status.currentRound || 0) / status.totalRounds) * 100 : 0} className="h-2" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col p-4 rounded-xl border border-border/50 bg-background/50 text-center">
              <span className="text-3xl font-display font-bold text-primary mb-1">
                {status?.completed || 0}
              </span>
              <span className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Successful</span>
            </div>
            <div className="flex flex-col p-4 rounded-xl border border-border/50 bg-background/50 text-center">
              <span className="text-3xl font-display font-bold text-destructive mb-1">
                {status?.failed || 0}
              </span>
              <span className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Failed</span>
            </div>
          </div>

          <div className="p-4 rounded-xl border border-border/50 bg-background/30 text-sm font-mono text-muted-foreground break-words">
            <span className="text-foreground/50 text-xs uppercase mb-2 block">Latest Status Message</span>
            {status?.message || "Awaiting task initialization..."}
          </div>

        </CardContent>
      </Card>

    </div>
  );
}
