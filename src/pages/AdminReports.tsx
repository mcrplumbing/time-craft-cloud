import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format, startOfWeek, endOfWeek, addWeeks, differenceInMinutes } from "date-fns";
import { ChevronLeft, ChevronRight, Shield } from "lucide-react";

interface TimeEntry {
  id: string;
  user_id: string;
  clock_in: string;
  clock_out: string | null;
  notes: string | null;
}

interface Profile {
  user_id: string;
  full_name: string;
}

interface WorkOrder {
  id: string;
  user_id: string;
  title: string;
  job_number: string;
  order_number: number;
  customer_name: string;
  status: string;
  created_at: string;
}

const AdminReports = () => {
  const { isAdmin, loading: adminLoading } = useIsAdmin();
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [loading, setLoading] = useState(true);

  const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });

  useEffect(() => {
    if (!isAdmin) return;
    setLoading(true);

    const fetchData = async () => {
      const [timeRes, profilesRes, woRes] = await Promise.all([
        supabase
          .from("time_entries")
          .select("*")
          .gte("clock_in", weekStart.toISOString())
          .lte("clock_in", weekEnd.toISOString())
          .order("clock_in", { ascending: true }),
        supabase.from("profiles").select("user_id, full_name"),
        supabase
          .from("work_orders")
          .select("*")
          .gte("created_at", weekStart.toISOString())
          .lte("created_at", weekEnd.toISOString())
          .order("created_at", { ascending: false }),
      ]);

      setTimeEntries(timeRes.data || []);
      setProfiles(profilesRes.data || []);
      setWorkOrders(woRes.data || []);
      setLoading(false);
    };

    fetchData();
  }, [isAdmin, weekStart]);

  const getName = (userId: string) => {
    const p = profiles.find((p) => p.user_id === userId);
    return p?.full_name || "Unknown";
  };

  const formatDuration = (mins: number) => {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${h}h ${m}m`;
  };

  // Group time entries by user
  const userTimeMap = timeEntries.reduce<Record<string, { entries: TimeEntry[]; totalMins: number }>>((acc, entry) => {
    if (!acc[entry.user_id]) acc[entry.user_id] = { entries: [], totalMins: 0 };
    acc[entry.user_id].entries.push(entry);
    if (entry.clock_out) {
      acc[entry.user_id].totalMins += differenceInMinutes(new Date(entry.clock_out), new Date(entry.clock_in));
    }
    return acc;
  }, {});

  if (adminLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <p className="text-muted-foreground font-body animate-pulse">Loading...</p>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4">
        <Shield className="h-12 w-12 text-muted-foreground" />
        <p className="text-muted-foreground font-body text-lg">Admin access required.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-display font-bold text-foreground">Admin Reports</h1>
        <p className="text-muted-foreground font-body">Weekly timesheet &amp; work order summary.</p>
      </div>

      {/* Week navigation */}
      <div className="flex items-center gap-3">
        <Button variant="outline" size="icon" onClick={() => setWeekStart((w) => addWeeks(w, -1))}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="font-body font-semibold text-sm">
          {format(weekStart, "MMM d")} — {format(weekEnd, "MMM d, yyyy")}
        </span>
        <Button variant="outline" size="icon" onClick={() => setWeekStart((w) => addWeeks(w, 1))}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {loading ? (
        <p className="text-muted-foreground font-body animate-pulse">Loading reports...</p>
      ) : (
        <>
          {/* Timesheet by employee */}
          <Card>
            <CardHeader>
              <CardTitle className="font-display text-lg">Weekly Timesheet</CardTitle>
            </CardHeader>
            <CardContent>
              {Object.keys(userTimeMap).length === 0 ? (
                <p className="text-sm text-muted-foreground font-body">No time entries this week.</p>
              ) : (
                <div className="space-y-6">
                  {Object.entries(userTimeMap).map(([userId, { entries, totalMins }]) => (
                    <div key={userId}>
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-display font-semibold text-base">{getName(userId)}</h3>
                        <span className="text-sm font-body font-bold text-accent">
                          Total: {formatDuration(totalMins)}
                        </span>
                      </div>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="font-body">Date</TableHead>
                            <TableHead className="font-body">Clock In</TableHead>
                            <TableHead className="font-body">Clock Out</TableHead>
                            <TableHead className="font-body">Duration</TableHead>
                            <TableHead className="font-body">Notes</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {entries.map((entry) => (
                            <TableRow key={entry.id}>
                              <TableCell className="font-body text-sm">
                                {format(new Date(entry.clock_in), "EEE, MMM d")}
                              </TableCell>
                              <TableCell className="font-body text-sm">
                                {format(new Date(entry.clock_in), "h:mm a")}
                              </TableCell>
                              <TableCell className="font-body text-sm">
                                {entry.clock_out ? format(new Date(entry.clock_out), "h:mm a") : "Active"}
                              </TableCell>
                              <TableCell className="font-body text-sm font-semibold">
                                {entry.clock_out
                                  ? formatDuration(differenceInMinutes(new Date(entry.clock_out), new Date(entry.clock_in)))
                                  : "—"}
                              </TableCell>
                              <TableCell className="font-body text-sm text-muted-foreground italic">
                                {entry.notes || "—"}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Work orders this week */}
          <Card>
            <CardHeader>
              <CardTitle className="font-display text-lg">Work Orders This Week</CardTitle>
            </CardHeader>
            <CardContent>
              {workOrders.length === 0 ? (
                <p className="text-sm text-muted-foreground font-body">No work orders created this week.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="font-body">Job #</TableHead>
                      <TableHead className="font-body">Title</TableHead>
                      <TableHead className="font-body">Customer</TableHead>
                      <TableHead className="font-body">Employee</TableHead>
                      <TableHead className="font-body">Status</TableHead>
                      <TableHead className="font-body">Created</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {workOrders.map((wo) => (
                      <TableRow key={wo.id}>
                        <TableCell className="font-body text-sm font-semibold">
                          #{wo.job_number || wo.order_number}
                        </TableCell>
                        <TableCell className="font-body text-sm">{wo.title || "Untitled"}</TableCell>
                        <TableCell className="font-body text-sm">{wo.customer_name}</TableCell>
                        <TableCell className="font-body text-sm">{getName(wo.user_id)}</TableCell>
                        <TableCell>
                          <span
                            className={`text-xs font-body px-2 py-1 rounded-full ${
                              wo.status === "completed" || wo.status === "invoiced"
                                ? "bg-success/10 text-success"
                                : wo.status === "in_progress"
                                ? "bg-accent/10 text-accent"
                                : "bg-muted text-muted-foreground"
                            }`}
                          >
                            {wo.status.replace("_", " ")}
                          </span>
                        </TableCell>
                        <TableCell className="font-body text-sm text-muted-foreground">
                          {format(new Date(wo.created_at), "MMM d")}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};

export default AdminReports;
