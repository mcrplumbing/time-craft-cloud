import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { format, differenceInMinutes } from "date-fns";
import { Clock, PlayCircle, StopCircle, Coffee, Trash2 } from "lucide-react";
import { queueAction, isOnline } from "@/lib/offlineQueue";
import { getCurrentPosition } from "@/lib/geolocation";
import LocationBadge from "@/components/LocationBadge";

const TimeClock = () => {
  const { user } = useAuth();
  const { isAdmin } = useIsAdmin();
  const { toast } = useToast();
  const [activeEntry, setActiveEntry] = useState<any>(null);
  const [entries, setEntries] = useState<any[]>([]);
  const [notes, setNotes] = useState("");
  const [elapsed, setElapsed] = useState("");
  const [loading, setLoading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const fetchEntries = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("time_entries")
      .select("*")
      .eq("user_id", user.id)
      .is("deleted_at", null)
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
      let mins = differenceInMinutes(new Date(), new Date(activeEntry.clock_in));
      // Subtract accumulated break minutes
      mins -= (activeEntry.total_break_minutes || 0);
      // Subtract current active break if on break
      if (activeEntry.break_start && !activeEntry.break_end) {
        mins -= differenceInMinutes(new Date(), new Date(activeEntry.break_start));
      }
      const h = Math.floor(Math.max(0, mins) / 60);
      const m = Math.max(0, mins) % 60;
      setElapsed(`${h}h ${m}m`);
    };
    tick();
    const interval = setInterval(tick, 30000);
    return () => clearInterval(interval);
  }, [activeEntry]);

  const onBreak = activeEntry?.break_start && !activeEntry?.break_end;

  const clockIn = async () => {
    if (!user) return;
    setLoading(true);
    const pos = await getCurrentPosition();
    if (!isOnline()) {
      await queueAction({
        table: "time_entries",
        type: "insert",
        data: {
          user_id: user.id,
          clock_in: new Date().toISOString(),
          ...(pos && { clock_in_lat: pos.lat, clock_in_lng: pos.lng }),
        },
      });
      toast({ title: "Clocked In (Offline)", description: "Will sync when you're back online." });
    } else {
      const { error } = await supabase.from("time_entries").insert({
        user_id: user.id,
        ...(pos && { clock_in_lat: pos.lat, clock_in_lng: pos.lng }),
      } as any);
      if (error) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
      } else {
        toast({ title: "Clocked In!", description: pos ? "Location recorded." : "Your time is now being tracked." });
        fetchEntries();
      }
    }
    setLoading(false);
  };

  const clockOut = async () => {
    if (!user || !activeEntry) return;
    setLoading(true);
    const pos = await getCurrentPosition();
    const locationData = pos ? { clock_out_lat: pos.lat, clock_out_lng: pos.lng } : {};
    if (!isOnline()) {
      await queueAction({
        table: "time_entries",
        type: "update",
        data: { id: activeEntry.id, clock_out: new Date().toISOString(), notes, ...locationData },
      });
      toast({ title: "Clocked Out (Offline)", description: "Will sync when you're back online." });
      setNotes("");
    } else {
      const { error } = await supabase
        .from("time_entries")
        .update({ clock_out: new Date().toISOString(), notes, ...locationData } as any)
        .eq("id", activeEntry.id);
      if (error) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
      } else {
        toast({ title: "Clocked Out!", description: pos ? "Location recorded." : "Time entry saved." });
        setNotes("");
        fetchEntries();
      }
    }
    setLoading(false);
  };

  const startBreak = async () => {
    if (!user || !activeEntry) return;
    setLoading(true);
    const { error } = await supabase
      .from("time_entries")
      .update({ break_start: new Date().toISOString() })
      .eq("id", activeEntry.id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Break Started", description: "Enjoy your break!" });
      fetchEntries();
    }
    setLoading(false);
  };

  const endBreak = async () => {
    if (!user || !activeEntry) return;
    setLoading(true);
    const breakMins = differenceInMinutes(new Date(), new Date(activeEntry.break_start));
    const newTotal = (activeEntry.total_break_minutes || 0) + breakMins;
    const { error } = await supabase
      .from("time_entries")
      .update({ break_start: null, break_end: null, total_break_minutes: newTotal } as any)
      .eq("id", activeEntry.id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Break Ended", description: `${breakMins}m break recorded. Back to work!` });
      fetchEntries();
    }
    setLoading(false);
  };

  const deleteEntry = async () => {
    if (!deleteTarget) return;
    const { error } = await supabase
      .from("time_entries")
      .update({ deleted_at: new Date().toISOString() } as any)
      .eq("id", deleteTarget);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Moved to Trash", description: "Time entry moved to trash." });
      fetchEntries();
    }
    setDeleteTarget(null);
  };

  const formatDuration = (clockIn: string, clockOut: string | null, totalBreakMins?: number) => {
    if (!clockOut) return "Active";
    let mins = differenceInMinutes(new Date(clockOut), new Date(clockIn));
    mins -= (totalBreakMins || 0);
    const h = Math.floor(Math.max(0, mins) / 60);
    const m = Math.max(0, mins) % 60;
    return `${h}h ${m}m`;
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl md:text-3xl font-display font-bold">Time Clock</h1>

      {/* Clock In/Out Card */}
      <Card className={activeEntry ? (onBreak ? "border-warning" : "border-accent") : ""}>
        <CardContent className="py-8 flex flex-col items-center gap-4">
          {onBreak ? (
            <Coffee className="h-16 w-16 text-warning animate-pulse-warm" />
          ) : (
            <Clock className={`h-16 w-16 ${activeEntry ? "text-accent animate-pulse-warm" : "text-muted-foreground"}`} />
          )}
          {activeEntry ? (
            <>
              <p className={`text-3xl font-display font-bold ${onBreak ? "text-warning" : "text-accent"}`}>
                {onBreak ? "On Break" : elapsed}
              </p>
              <p className="text-sm text-muted-foreground font-body">
                Clocked in at {format(new Date(activeEntry.clock_in), "h:mm a")}
                {onBreak && ` • Break since ${format(new Date(activeEntry.break_start), "h:mm a")}`}
                {(activeEntry.total_break_minutes > 0) && ` • ${activeEntry.total_break_minutes}m total break`}
              </p>
              <Input
                placeholder="Add notes about this shift..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="max-w-sm"
              />
              <div className="flex gap-3 flex-wrap justify-center">
                {!onBreak && (
                  <Button onClick={startBreak} disabled={loading} variant="outline" size="lg" className="gap-2">
                    <Coffee className="h-5 w-5" /> Start Break
                  </Button>
                )}
                {onBreak && (
                  <Button onClick={endBreak} disabled={loading} variant="outline" size="lg" className="gap-2 border-warning text-warning hover:bg-warning/10">
                    <Coffee className="h-5 w-5" /> End Break
                  </Button>
                )}
                {!onBreak && (
                  <Button onClick={clockOut} disabled={loading} variant="destructive" size="lg" className="gap-2">
                    <StopCircle className="h-5 w-5" /> Clock Out
                  </Button>
                )}
              </div>
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
                    {entry.break_start && (
                      <p className="text-xs text-warning font-body mt-0.5">
                        ☕ {formatBreak(entry.break_start, entry.break_end)}
                      </p>
                    )}
                    {entry.notes && <p className="text-xs text-muted-foreground mt-1 italic font-body">{entry.notes}</p>}
                    {(entry.clock_in_lat || entry.clock_out_lat) && (
                      <div className="flex gap-3 mt-1">
                        {entry.clock_in_lat && entry.clock_in_lng && (
                          <LocationBadge label="Clock In" lat={entry.clock_in_lat} lng={entry.clock_in_lng} />
                        )}
                        {entry.clock_out_lat && entry.clock_out_lng && (
                          <LocationBadge label="Clock Out" lat={entry.clock_out_lat} lng={entry.clock_out_lng} />
                        )}
                      </div>
                    )}
                  </div>
                  <span className={`text-sm font-body font-semibold ${!entry.clock_out ? "text-accent" : "text-foreground"}`}>
                    {formatDuration(entry.clock_in, entry.clock_out, entry.break_start, entry.break_end)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Admin delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display">Delete Time Entry?</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={deleteEntry} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default TimeClock;
