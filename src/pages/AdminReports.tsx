import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { format, startOfWeek, endOfWeek, addWeeks, differenceInMinutes } from "date-fns";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronLeft, ChevronRight, KeyRound, Pencil, Printer, Shield, Users } from "lucide-react";
import LocationBadge from "@/components/LocationBadge";

interface TimeEntry {
  id: string;
  user_id: string;
  clock_in: string;
  clock_out: string | null;
  notes: string | null;
  break_start: string | null;
  break_end: string | null;
  clock_in_lat: number | null;
  clock_in_lng: number | null;
  clock_out_lat: number | null;
  clock_out_lng: number | null;
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

// Helper to format a Date to datetime-local input value (local time)
const toLocalInput = (iso: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  const offset = d.getTimezoneOffset();
  const local = new Date(d.getTime() - offset * 60000);
  return local.toISOString().slice(0, 16);
};

const AdminReports = () => {
  const { isAdmin, loading: adminLoading } = useIsAdmin();
  const { session } = useAuth();
  const { toast } = useToast();
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [loading, setLoading] = useState(true);

  // Edit state
  const [editEntry, setEditEntry] = useState<TimeEntry | null>(null);
  const [editClockIn, setEditClockIn] = useState("");
  const [editClockOut, setEditClockOut] = useState("");
  const [editBreakStart, setEditBreakStart] = useState("");
  const [editBreakEnd, setEditBreakEnd] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [saving, setSaving] = useState(false);

  // Roster state
  interface RosterUser {
    id: string;
    email: string;
    full_name: string;
    role: string;
    created_at: string;
    last_sign_in_at: string | null;
  }
  const [rosterUsers, setRosterUsers] = useState<RosterUser[]>([]);
  const [rosterLoading, setRosterLoading] = useState(false);

  // Roster edit state
  const [editingUser, setEditingUser] = useState<RosterUser | null>(null);
  const [editUserName, setEditUserName] = useState("");
  const [editUserRole, setEditUserRole] = useState("user");
  const [savingUser, setSavingUser] = useState(false);
  const [resettingPassword, setResettingPassword] = useState<string | null>(null);

  const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });

  const fetchData = async () => {
    if (!isAdmin) return;
    setLoading(true);
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

  const fetchRoster = async () => {
    if (!isAdmin || !session?.access_token) return;
    setRosterLoading(true);
    try {
      const res = await supabase.functions.invoke("list-users", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (res.data) setRosterUsers(res.data);
    } catch (err) {
      console.error("Failed to fetch roster", err);
    }
    setRosterLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [isAdmin, weekStart]);

  useEffect(() => {
    fetchRoster();
  }, [isAdmin, session]);

  const getName = (userId: string) => {
    const p = profiles.find((p) => p.user_id === userId);
    return p?.full_name || "Unknown";
  };

  const formatDuration = (mins: number) => {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${h}h ${m}m`;
  };

  const getBreakMins = (entry: TimeEntry) => {
    if (entry.break_start && entry.break_end) {
      return differenceInMinutes(new Date(entry.break_end), new Date(entry.break_start));
    }
    return 0;
  };

  // Group time entries by user
  const userTimeMap = timeEntries.reduce<Record<string, { entries: TimeEntry[]; totalMins: number }>>((acc, entry) => {
    if (!acc[entry.user_id]) acc[entry.user_id] = { entries: [], totalMins: 0 };
    acc[entry.user_id].entries.push(entry);
    if (entry.clock_out) {
      const worked = differenceInMinutes(new Date(entry.clock_out), new Date(entry.clock_in)) - getBreakMins(entry);
      acc[entry.user_id].totalMins += worked;
    }
    return acc;
  }, {});

  const openEdit = (entry: TimeEntry) => {
    setEditEntry(entry);
    setEditClockIn(toLocalInput(entry.clock_in));
    setEditClockOut(toLocalInput(entry.clock_out));
    setEditBreakStart(toLocalInput(entry.break_start));
    setEditBreakEnd(toLocalInput(entry.break_end));
    setEditNotes(entry.notes || "");
  };

  const saveEdit = async () => {
    if (!editEntry) return;
    setSaving(true);

    const updates: Record<string, string | null> = {
      clock_in: new Date(editClockIn).toISOString(),
      clock_out: editClockOut ? new Date(editClockOut).toISOString() : null,
      break_start: editBreakStart ? new Date(editBreakStart).toISOString() : null,
      break_end: editBreakEnd ? new Date(editBreakEnd).toISOString() : null,
      notes: editNotes || null,
    };

    const { error } = await supabase
      .from("time_entries")
      .update(updates)
      .eq("id", editEntry.id);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Saved", description: "Time entry updated." });
      setEditEntry(null);
      fetchData();
    }
    setSaving(false);
  };

  const openEditUser = (u: RosterUser) => {
    setEditingUser(u);
    setEditUserName(u.full_name || "");
    setEditUserRole(u.role || "user");
  };

  const saveUserEdit = async () => {
    if (!editingUser || !session?.access_token) return;
    setSavingUser(true);

    try {
      // Update name
      const nameRes = await supabase.functions.invoke("admin-user-actions", {
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: { action: "update_profile", target_user_id: editingUser.id, full_name: editUserName },
      });
      if (nameRes.error) throw new Error(nameRes.error.message);

      // Update role if changed
      if (editUserRole !== editingUser.role) {
        const roleRes = await supabase.functions.invoke("admin-user-actions", {
          headers: { Authorization: `Bearer ${session.access_token}` },
          body: { action: "update_role", target_user_id: editingUser.id, role: editUserRole },
        });
        if (roleRes.error) throw new Error(roleRes.error.message);
      }

      toast({ title: "Saved", description: `Updated ${editUserName}.` });
      setEditingUser(null);
      fetchRoster();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
    setSavingUser(false);
  };

  const sendPasswordReset = async (userId: string) => {
    if (!session?.access_token) return;
    setResettingPassword(userId);
    try {
      const res = await supabase.functions.invoke("admin-user-actions", {
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: { action: "send_password_reset", target_user_id: userId },
      });
      if (res.error) throw new Error(res.error.message);
      const email = res.data?.email || "";
      toast({ title: "Reset email sent", description: `Password reset link sent to ${email}.` });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
    setResettingPassword(null);
  };

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

      {/* Week navigation + print */}
      <div className="flex items-center justify-between">
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
        <Button variant="outline" size="sm" className="no-print gap-2" onClick={() => window.print()}>
          <Printer className="h-4 w-4" /> Print
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
                            <TableHead className="font-body">Break</TableHead>
                            <TableHead className="font-body">Worked</TableHead>
                            <TableHead className="font-body">Notes</TableHead>
                            <TableHead className="font-body no-print">Location</TableHead>
                            <TableHead className="font-body no-print w-10"></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {entries.map((entry) => {
                            const breakMins = getBreakMins(entry);
                            const totalMins = entry.clock_out
                              ? differenceInMinutes(new Date(entry.clock_out), new Date(entry.clock_in)) - breakMins
                              : 0;
                            return (
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
                                <TableCell className="font-body text-sm text-warning">
                                  {breakMins > 0 ? `${breakMins}m` : "—"}
                                </TableCell>
                                <TableCell className="font-body text-sm font-semibold">
                                  {entry.clock_out ? formatDuration(totalMins) : "—"}
                                </TableCell>
                                <TableCell className="font-body text-sm text-muted-foreground italic">
                                  {entry.notes || "—"}
                                </TableCell>
                                <TableCell className="no-print">
                                  <div className="flex gap-2">
                                    {entry.clock_in_lat && entry.clock_in_lng && (
                                      <LocationBadge label="In" lat={entry.clock_in_lat} lng={entry.clock_in_lng} />
                                    )}
                                    {entry.clock_out_lat && entry.clock_out_lng && (
                                      <LocationBadge label="Out" lat={entry.clock_out_lat} lng={entry.clock_out_lng} />
                                    )}
                                  </div>
                                </TableCell>
                                <TableCell className="no-print">
                                  <Button variant="ghost" size="icon" onClick={() => openEdit(entry)}>
                                    <Pencil className="h-3.5 w-3.5" />
                                  </Button>
                                </TableCell>
                              </TableRow>
                            );
                          })}
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

      {/* Employee Roster */}
      <Card>
        <CardHeader>
          <CardTitle className="font-display text-lg flex items-center gap-2">
            <Users className="h-5 w-5" /> Employee Roster
          </CardTitle>
        </CardHeader>
        <CardContent>
          {rosterLoading ? (
            <p className="text-sm text-muted-foreground font-body animate-pulse">Loading roster...</p>
          ) : rosterUsers.length === 0 ? (
            <p className="text-sm text-muted-foreground font-body">No users found.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="font-body">Name</TableHead>
                  <TableHead className="font-body">Email</TableHead>
                  <TableHead className="font-body">Role</TableHead>
                  <TableHead className="font-body">Joined</TableHead>
                  <TableHead className="font-body">Last Sign In</TableHead>
                  <TableHead className="font-body no-print w-24">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rosterUsers.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell className="font-body text-sm font-semibold">
                      {u.full_name || "—"}
                    </TableCell>
                    <TableCell className="font-body text-sm">{u.email}</TableCell>
                    <TableCell>
                      <Badge variant={u.role === "admin" ? "default" : "secondary"} className="font-body text-xs">
                        {u.role}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-body text-sm text-muted-foreground">
                      {format(new Date(u.created_at), "MMM d, yyyy")}
                    </TableCell>
                    <TableCell className="font-body text-sm text-muted-foreground">
                      {u.last_sign_in_at ? format(new Date(u.last_sign_in_at), "MMM d, yyyy h:mm a") : "Never"}
                    </TableCell>
                    <TableCell className="no-print">
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEditUser(u)} title="Edit user">
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => sendPasswordReset(u.id)}
                          disabled={resettingPassword === u.id}
                          title="Send password reset"
                        >
                          <KeyRound className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Edit Time Entry Dialog */}
      <Dialog open={!!editEntry} onOpenChange={(open) => !open && setEditEntry(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">Edit Time Entry</DialogTitle>
          </DialogHeader>
          {editEntry && (
            <div className="space-y-4">
              <p className="text-sm font-body text-muted-foreground">
                {getName(editEntry.user_id)} — {format(new Date(editEntry.clock_in), "EEE, MMM d")}
              </p>
              <div className="grid gap-3">
                <div>
                  <Label className="font-body text-sm">Clock In</Label>
                  <Input type="datetime-local" value={editClockIn} onChange={(e) => setEditClockIn(e.target.value)} />
                </div>
                <div>
                  <Label className="font-body text-sm">Clock Out</Label>
                  <Input type="datetime-local" value={editClockOut} onChange={(e) => setEditClockOut(e.target.value)} />
                </div>
                <div>
                  <Label className="font-body text-sm">Break Start</Label>
                  <Input type="datetime-local" value={editBreakStart} onChange={(e) => setEditBreakStart(e.target.value)} />
                </div>
                <div>
                  <Label className="font-body text-sm">Break End</Label>
                  <Input type="datetime-local" value={editBreakEnd} onChange={(e) => setEditBreakEnd(e.target.value)} />
                </div>
                <div>
                  <Label className="font-body text-sm">Notes</Label>
                  <Input value={editNotes} onChange={(e) => setEditNotes(e.target.value)} placeholder="Shift notes..." />
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditEntry(null)}>Cancel</Button>
            <Button onClick={saveEdit} disabled={saving}>{saving ? "Saving..." : "Save"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit User Dialog */}
      <Dialog open={!!editingUser} onOpenChange={(open) => !open && setEditingUser(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">Edit Employee</DialogTitle>
          </DialogHeader>
          {editingUser && (
            <div className="space-y-4">
              <p className="text-sm font-body text-muted-foreground">{editingUser.email}</p>
              <div className="grid gap-3">
                <div>
                  <Label className="font-body text-sm">Full Name</Label>
                  <Input value={editUserName} onChange={(e) => setEditUserName(e.target.value)} placeholder="Employee name" />
                </div>
                <div>
                  <Label className="font-body text-sm">Role</Label>
                  <Select value={editUserRole} onValueChange={setEditUserRole}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="user">User</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingUser(null)}>Cancel</Button>
            <Button onClick={saveUserEdit} disabled={savingUser}>{savingUser ? "Saving..." : "Save"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminReports;
