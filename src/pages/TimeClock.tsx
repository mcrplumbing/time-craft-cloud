import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { format, differenceInMinutes } from "date-fns";
import { Clock, PlayCircle, StopCircle } from "lucide-react";

const TimeClock = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [activeEntry, setActiveEntry] = useState<any>(null);
  const [entries, setEntries] = useState<any[]>([]);
  const [notes, setNotes] = useState("");
  const [elapsed, setElapsed] = useState("");
  const [loading, setLoading] = useState(false);

  const fetchEntries = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("time_entries")
      .select("*")
      .eq("user_id", user.id)
      .order("clock_in", { ascending: false })
      .limit(20);
    setEntries(data || []);

    const active = data?.find((e) => !e.clock_out);
    setActiveEntry(active || null);
  };

  useEffect(() => {
    fetchEntries();
  }, [user]);

  // Live timer
  useEffect(() => {
    if (!activeEntry) { setElapsed(""); return; }
    const tick = () => {
      const mins = differenceInMinutes(new Date(), new Date(activeEntry.clock_in));
      const h = Math.floor(mins / 60);
      const m = mins % 60;
      setElapsed(`${h}h ${m}m`);
    };
    tick();
    const interval = setInterval(tick, 30000);
    return () => clearInterval(interval);
  }, [activeEntry]);

  const clockIn = async () => {
    if (!user) return;
    setLoading(true);
    const { error } = await supabase.from("time_entries").insert({ user_id: user.id });
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Clocked In!", description: "Your time is now being tracked." });
      fetchEntries();
    }
    setLoading(false);
  };

  const clockOut = async () => {
    if (!user || !activeEntry) return;
    setLoading(true);
    const { error } = await supabase
      .from("time_entries")
      .update({ clock_out: new Date().toISOString(), notes })
      .eq("id", activeEntry.id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Clocked Out!", description: "Time entry saved." });
      setNotes("");
      fetchEntries();
    }
    setLoading(false);
  };

  const formatDuration = (clockIn: string, clockOut: string | null) => {
    if (!clockOut) return "Active";
    const mins = differenceInMinutes(new Date(clockOut), new Date(clockIn));
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${h}h ${m}m`;
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl md:text-3xl font-display font-bold">Time Clock</h1>

      {/* Clock In/Out Card */}
      <Card className={activeEntry ? "border-accent" : ""}>
        <CardContent className="py-8 flex flex-col items-center gap-4">
          <Clock className={`h-16 w-16 ${activeEntry ? "text-accent animate-pulse-warm" : "text-muted-foreground"}`} />
          {activeEntry ? (
            <>
              <p className="text-3xl font-display font-bold text-accent">{elapsed}</p>
              <p className="text-sm text-muted-foreground font-body">
                Clocked in at {format(new Date(activeEntry.clock_in), "h:mm a")}
              </p>
              <Input
                placeholder="Add notes about this shift..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="max-w-sm"
              />
              <Button onClick={clockOut} disabled={loading} variant="destructive" size="lg" className="gap-2">
                <StopCircle className="h-5 w-5" /> Clock Out
              </Button>
            </>
          ) : (
            <>
              <p className="text-lg font-body text-muted-foreground">Ready to start working?</p>
              <Button onClick={clockIn} disabled={loading} size="lg" className="gap-2">
                <PlayCircle className="h-5 w-5" /> Clock In
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      {/* Recent entries */}
      <Card>
        <CardHeader>
          <CardTitle className="font-display text-lg">Recent Time Entries</CardTitle>
        </CardHeader>
        <CardContent>
          {entries.length === 0 ? (
            <p className="text-sm text-muted-foreground font-body">No time entries yet.</p>
          ) : (
            <div className="space-y-2">
              {entries.map((entry) => (
                <div key={entry.id} className="flex items-center justify-between p-3 rounded-md bg-muted/50">
                  <div>
                    <p className="font-body font-semibold text-sm">
                      {format(new Date(entry.clock_in), "MMM d, yyyy")}
                    </p>
                    <p className="text-xs text-muted-foreground font-body">
                      {format(new Date(entry.clock_in), "h:mm a")} — {entry.clock_out ? format(new Date(entry.clock_out), "h:mm a") : "Active"}
                    </p>
                    {entry.notes && <p className="text-xs text-muted-foreground mt-1 italic font-body">{entry.notes}</p>}
                  </div>
                  <span className={`text-sm font-body font-semibold ${!entry.clock_out ? "text-accent" : "text-foreground"}`}>
                    {formatDuration(entry.clock_in, entry.clock_out)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default TimeClock;
