import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { format, differenceInMinutes } from "date-fns";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { RotateCcw, Shield, Trash2 } from "lucide-react";

interface Profile {
  user_id: string;
  full_name: string;
}

const Trash = () => {
  const { isAdmin, loading: adminLoading } = useIsAdmin();
  const { user } = useAuth();
  const { toast } = useToast();
  const [deletedTimeEntries, setDeletedTimeEntries] = useState<any[]>([]);
  const [deletedWorkOrders, setDeletedWorkOrders] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmAction, setConfirmAction] = useState<{ type: "restore" | "permanent"; table: "time_entries" | "work_orders"; id: string } | null>(null);

  const fetchTrash = async () => {
    if (!isAdmin) return;
    setLoading(true);
    const [timeRes, woRes, profilesRes] = await Promise.all([
      supabase
        .from("time_entries")
        .select("*")
        .not("deleted_at", "is", null)
        .order("deleted_at", { ascending: false }),
      supabase
        .from("work_orders")
        .select("*")
        .not("deleted_at", "is", null)
        .order("deleted_at", { ascending: false }),
      supabase.from("profiles").select("user_id, full_name"),
    ]);
    setDeletedTimeEntries(timeRes.data || []);
    setDeletedWorkOrders(woRes.data || []);
    setProfiles(profilesRes.data || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchTrash();
  }, [isAdmin]);

  const getName = (userId: string) => {
    const p = profiles.find((p) => p.user_id === userId);
    return p?.full_name || "Unknown";
  };

  const handleAction = async () => {
    if (!confirmAction) return;
    const { type, table, id } = confirmAction;

    if (type === "restore") {
      const { error } = await supabase
        .from(table)
        .update({ deleted_at: null } as any)
        .eq("id", id);
      if (error) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
      } else {
        toast({ title: "Restored", description: "Item restored successfully." });
        fetchTrash();
      }
    } else {
      const { error } = await supabase.from(table).delete().eq("id", id);
      if (error) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
      } else {
        toast({ title: "Permanently Deleted", description: "Item removed forever." });
        fetchTrash();
      }
    }
    setConfirmAction(null);
  };

  const formatDuration = (clockIn: string, clockOut: string | null) => {
    if (!clockOut) return "Active";
    const mins = differenceInMinutes(new Date(clockOut), new Date(clockIn));
    return `${Math.floor(mins / 60)}h ${mins % 60}m`;
  };

  const daysUntilPurge = (deletedAt: string) => {
    const deleted = new Date(deletedAt);
    const purgeDate = new Date(deleted.getTime() + 30 * 24 * 60 * 60 * 1000);
    const remaining = Math.ceil((purgeDate.getTime() - Date.now()) / (24 * 60 * 60 * 1000));
    return Math.max(0, remaining);
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
        <h1 className="text-2xl md:text-3xl font-display font-bold text-foreground">Trash</h1>
        <p className="text-muted-foreground font-body">Deleted items are kept for 30 days before permanent removal.</p>
      </div>

      {loading ? (
        <p className="text-muted-foreground font-body animate-pulse">Loading...</p>
      ) : (
        <>
          {/* Deleted Time Entries */}
          <Card>
            <CardHeader>
              <CardTitle className="font-display text-lg">Deleted Time Entries</CardTitle>
            </CardHeader>
            <CardContent>
              {deletedTimeEntries.length === 0 ? (
                <p className="text-sm text-muted-foreground font-body">No deleted time entries.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="font-body">Employee</TableHead>
                      <TableHead className="font-body">Date</TableHead>
                      <TableHead className="font-body">Duration</TableHead>
                      <TableHead className="font-body">Deleted</TableHead>
                      <TableHead className="font-body">Expires</TableHead>
                      <TableHead className="font-body w-24">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {deletedTimeEntries.map((entry) => (
                      <TableRow key={entry.id} className="opacity-70">
                        <TableCell className="font-body text-sm">{getName(entry.user_id)}</TableCell>
                        <TableCell className="font-body text-sm">
                          {format(new Date(entry.clock_in), "MMM d, yyyy")}
                        </TableCell>
                        <TableCell className="font-body text-sm">
                          {formatDuration(entry.clock_in, entry.clock_out)}
                        </TableCell>
                        <TableCell className="font-body text-sm text-muted-foreground">
                          {format(new Date(entry.deleted_at), "MMM d")}
                        </TableCell>
                        <TableCell className="font-body text-sm text-destructive">
                          {daysUntilPurge(entry.deleted_at)}d left
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-0.5">
                            <Button
                              variant="ghost"
                              size="icon"
                              title="Restore"
                              onClick={() => setConfirmAction({ type: "restore", table: "time_entries", id: entry.id })}
                            >
                              <RotateCcw className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-destructive hover:text-destructive"
                              title="Delete permanently"
                              onClick={() => setConfirmAction({ type: "permanent", table: "time_entries", id: entry.id })}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
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

          {/* Deleted Work Orders */}
          <Card>
            <CardHeader>
              <CardTitle className="font-display text-lg">Deleted Work Orders</CardTitle>
            </CardHeader>
            <CardContent>
              {deletedWorkOrders.length === 0 ? (
                <p className="text-sm text-muted-foreground font-body">No deleted work orders.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="font-body">Job #</TableHead>
                      <TableHead className="font-body">Title</TableHead>
                      <TableHead className="font-body">Customer</TableHead>
                      <TableHead className="font-body">Deleted</TableHead>
                      <TableHead className="font-body">Expires</TableHead>
                      <TableHead className="font-body w-24">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {deletedWorkOrders.map((wo) => (
                      <TableRow key={wo.id} className="opacity-70">
                        <TableCell className="font-body text-sm font-semibold">
                          #{wo.job_number || wo.order_number}
                        </TableCell>
                        <TableCell className="font-body text-sm">{wo.title || "Untitled"}</TableCell>
                        <TableCell className="font-body text-sm">{wo.customer_name}</TableCell>
                        <TableCell className="font-body text-sm text-muted-foreground">
                          {format(new Date(wo.deleted_at), "MMM d")}
                        </TableCell>
                        <TableCell className="font-body text-sm text-destructive">
                          {daysUntilPurge(wo.deleted_at)}d left
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-0.5">
                            <Button
                              variant="ghost"
                              size="icon"
                              title="Restore"
                              onClick={() => setConfirmAction({ type: "restore", table: "work_orders", id: wo.id })}
                            >
                              <RotateCcw className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-destructive hover:text-destructive"
                              title="Delete permanently"
                              onClick={() => setConfirmAction({ type: "permanent", table: "work_orders", id: wo.id })}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
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
        </>
      )}

      {/* Confirm dialog */}
      <AlertDialog open={!!confirmAction} onOpenChange={(open) => !open && setConfirmAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display">
              {confirmAction?.type === "restore" ? "Restore Item?" : "Permanently Delete?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmAction?.type === "restore"
                ? "This item will be moved back to its original location."
                : "This action cannot be undone. The item will be gone forever."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleAction}
              className={confirmAction?.type === "permanent" ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : ""}
            >
              {confirmAction?.type === "restore" ? "Restore" : "Delete Forever"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Trash;
