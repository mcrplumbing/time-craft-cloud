import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Link } from "react-router-dom";
import { Plus, FileText, Pencil, Trash2, CalendarIcon, Search, ChevronLeft, ChevronRight } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { queueAction, isOnline } from "@/lib/offlineQueue";
import CompletedOrdersArchive from "@/components/CompletedOrdersArchive";

const ITEMS_PER_PAGE = 20;

const WorkOrders = () => {
  const { user } = useAuth();
  const { isAdmin } = useIsAdmin();
  const { toast } = useToast();
  const [orders, setOrders] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editOrder, setEditOrder] = useState<any>(null);
  const [form, setForm] = useState({ title: "", customer_name: "", customer_address: "", description: "", job_number: "", job_date: new Date() as Date | undefined });
  const [editForm, setEditForm] = useState({ title: "", customer_name: "", customer_address: "", description: "", job_number: "", job_date: new Date() as Date | undefined });
  const [loading, setLoading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; label: string | number } | null>(null);
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  const fetchOrders = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("work_orders")
      .select("*")
      .is("deleted_at", null)
      .order("job_date", { ascending: false });
    setOrders(data || []);
  };

  useEffect(() => { fetchOrders(); }, [user]);

  const createOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);

    const baseJob = form.job_number.trim();
    let finalJobNumber = baseJob;
    if (baseJob) {
      const { data: existing } = await supabase
        .from("work_orders")
        .select("job_number")
        .or(`job_number.eq.${baseJob},job_number.like.${baseJob}.%`);
      if (existing && existing.length > 0) {
        finalJobNumber = `${baseJob}.${existing.length}`;
      }
    }

    const jobDateStr = form.job_date ? format(form.job_date, "yyyy-MM-dd") : format(new Date(), "yyyy-MM-dd");

    if (!isOnline()) {
      await queueAction({
        table: "work_orders",
        type: "insert",
        data: {
          user_id: user.id,
          title: form.title,
          customer_name: form.customer_name,
          customer_address: form.customer_address,
          description: form.description,
          job_number: finalJobNumber,
          job_date: jobDateStr,
        },
      });
      toast({ title: "Work Order Saved Offline", description: "Will sync when you're back online." });
      setForm({ title: "", customer_name: "", customer_address: "", description: "", job_number: "", job_date: new Date() });
      setOpen(false);
    } else {
      const { error } = await supabase.from("work_orders").insert({
        user_id: user.id,
        title: form.title,
        customer_name: form.customer_name,
        customer_address: form.customer_address,
        description: form.description,
        job_number: finalJobNumber,
        job_date: jobDateStr,
      } as any);
      if (error) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
      } else {
        toast({ title: "Work Order Created" });
        setForm({ title: "", customer_name: "", customer_address: "", description: "", job_number: "", job_date: new Date() });
        setOpen(false);
        fetchOrders();
      }
    }
    setLoading(false);
  };

  const canEdit = (order: any) => {
    if (order.status === "completed" || order.status === "invoiced") {
      return isAdmin;
    }
    return true;
  };

  const openEdit = (order: any, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!canEdit(order)) {
      toast({ title: "Read Only", description: "Only admins can edit completed/invoiced orders.", variant: "destructive" });
      return;
    }
    setEditOrder(order);
    setEditForm({
      title: order.title || "",
      customer_name: order.customer_name || "",
      customer_address: order.customer_address || "",
      description: order.description || "",
      job_number: order.job_number || "",
      job_date: order.job_date ? new Date(order.job_date + "T00:00:00") : new Date(),
    });
    setEditOpen(true);
  };

  const saveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editOrder) return;
    setLoading(true);
    const { error } = await supabase.from("work_orders").update({
      title: editForm.title,
      customer_name: editForm.customer_name,
      customer_address: editForm.customer_address,
      description: editForm.description,
      job_number: editForm.job_number,
      job_date: editForm.job_date ? format(editForm.job_date, "yyyy-MM-dd") : null,
    } as any).eq("id", editOrder.id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Work Order Updated" });
      setEditOpen(false);
      fetchOrders();
    }
    setLoading(false);
  };

  const openDeleteDialog = (order: any, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDeleteTarget({
      id: order.id,
      label: order.job_number || order.order_number,
    });
  };

  const deleteOrder = async (orderId: string) => {
    const { error } = await supabase
      .from("work_orders")
      .update({ deleted_at: new Date().toISOString() } as any)
      .eq("id", orderId);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Moved to Trash", description: "Work order moved to trash. Restore within 30 days." });
      setDeleteTarget(null);
      fetchOrders();
    }
  };

  const statusStyle = (status: string) => {
    switch (status) {
      case "completed":
        return "bg-success/10 text-success";
      default:
        return "bg-accent/10 text-accent";
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl md:text-3xl font-display font-bold">Work Orders</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2"><Plus className="h-4 w-4" /> New Order</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="font-display">New Work Order</DialogTitle>
            </DialogHeader>
            <form onSubmit={createOrder} className="space-y-4">
              <div className="space-y-2">
                <Label>Job Number</Label>
                <Input value={form.job_number} onChange={(e) => setForm({ ...form, job_number: e.target.value })} placeholder="e.g. 25546" required />
                <p className="text-xs text-muted-foreground font-body">If this job number already exists, a sub-number (.1, .2, etc.) will be added automatically.</p>
              </div>
              <div className="space-y-2">
                <Label>Title</Label>
                <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Job title" required />
              </div>
              <div className="space-y-2">
                <Label>Customer Name</Label>
                <Input value={form.customer_name} onChange={(e) => setForm({ ...form, customer_name: e.target.value })} placeholder="Customer name" required />
              </div>
              <div className="space-y-2">
                <Label>Customer Address</Label>
                <Input value={form.customer_address} onChange={(e) => setForm({ ...form, customer_address: e.target.value })} placeholder="Address (optional)" />
              </div>
              <div className="space-y-2">
                <Label>Job Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !form.job_date && "text-muted-foreground")}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {form.job_date ? format(form.job_date, "PPP") : <span>Pick a date</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={form.job_date} onSelect={(d) => setForm({ ...form, job_date: d })} initialFocus className={cn("p-3 pointer-events-auto")} />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Job description" rows={3} />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Creating..." : "Create Work Order"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Edit dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display">Edit Work Order</DialogTitle>
          </DialogHeader>
          <form onSubmit={saveEdit} className="space-y-4">
            <div className="space-y-2">
              <Label>Job Number</Label>
              <Input value={editForm.job_number} onChange={(e) => setEditForm({ ...editForm, job_number: e.target.value })} required />
            </div>
            <div className="space-y-2">
              <Label>Title</Label>
              <Input value={editForm.title} onChange={(e) => setEditForm({ ...editForm, title: e.target.value })} required />
            </div>
            <div className="space-y-2">
              <Label>Customer Name</Label>
              <Input value={editForm.customer_name} onChange={(e) => setEditForm({ ...editForm, customer_name: e.target.value })} required />
            </div>
            <div className="space-y-2">
              <Label>Customer Address</Label>
              <Input value={editForm.customer_address} onChange={(e) => setEditForm({ ...editForm, customer_address: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Job Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !editForm.job_date && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {editForm.job_date ? format(editForm.job_date, "PPP") : <span>Pick a date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={editForm.job_date} onSelect={(d) => setEditForm({ ...editForm, job_date: d })} initialFocus className={cn("p-3 pointer-events-auto")} />
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} rows={3} />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Saving..." : "Save Changes"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(openState) => {
          if (!openState) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Work Order</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete work order #{deleteTarget?.label}. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteTarget) deleteOrder(deleteTarget.id);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {(() => {
        const q = search.toLowerCase().trim();
        const filtered = q
          ? orders.filter((o) =>
              [o.job_number, o.title, o.customer_name, o.customer_address, o.description]
                .filter(Boolean)
                .some((field: string) => field.toLowerCase().includes(q))
            )
          : orders;
        const activeOrders = filtered.filter((o) => o.status !== "completed");
        const completedOrders = filtered.filter((o) => o.status === "completed");

        // Pagination for active orders
        const totalPages = Math.max(1, Math.ceil(activeOrders.length / ITEMS_PER_PAGE));
        const safePage = Math.min(currentPage, totalPages);
        const paginatedActive = activeOrders.slice(
          (safePage - 1) * ITEMS_PER_PAGE,
          safePage * ITEMS_PER_PAGE
        );

        const renderOrderList = (list: any[], emptyMsg: string) =>
          list.length === 0 ? (
            <Card>
              <CardContent className="py-12 flex flex-col items-center gap-3">
                <FileText className="h-12 w-12 text-muted-foreground" />
                <p className="text-muted-foreground font-body">{emptyMsg}</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-3">
              {list.map((order) => (
                <Link key={order.id} to={`/work-orders/${order.id}`}>
                  <Card className="hover:shadow-md transition-shadow cursor-pointer">
                    <CardContent className="flex items-center justify-between py-4">
                      <div>
                        <p className="font-body font-semibold">#{order.job_number || order.order_number} — {order.title || "Untitled"}</p>
                        <p className="text-sm text-muted-foreground font-body">{order.customer_name}</p>
                        <p className="text-xs text-muted-foreground font-body">{order.job_date ? format(new Date(order.job_date + "T00:00:00"), "MMM d, yyyy") : format(new Date(order.created_at), "MMM d, yyyy")}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button variant="ghost" size="sm" onClick={(e) => openEdit(order, e)} className="h-8 w-8 p-0">
                          <Pencil className="h-4 w-4" />
                        </Button>
                        {isAdmin && (
                          <Button variant="ghost" size="sm" onClick={(e) => openDeleteDialog(order, e)} className="h-8 w-8 p-0 text-destructive hover:text-destructive" aria-label={`Delete work order ${order.job_number || order.order_number}`}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                        <span className={`text-xs font-body px-2 py-1 rounded-full ${statusStyle(order.status)}`}>
                          {order.status.replace("_", " ")}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          );

        return (
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, job #, description..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
                className="pl-9"
              />
            </div>
            <Tabs defaultValue="active" className="w-full">
            <TabsList className="w-full">
              <TabsTrigger value="active" className="flex-1">Active ({activeOrders.length})</TabsTrigger>
              <TabsTrigger value="completed" className="flex-1">Completed ({completedOrders.length})</TabsTrigger>
            </TabsList>
            <TabsContent value="active">
              {renderOrderList(paginatedActive, "No active work orders. Create your first one!")}
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 mt-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={safePage <= 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Previous
                  </Button>
                  <span className="text-sm text-muted-foreground font-body px-3">
                    Page {safePage} of {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={safePage >= totalPages}
                  >
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </TabsContent>
            <TabsContent value="completed">
              <CompletedOrdersArchive
                orders={orders.filter((o) => o.status === "completed")}
                search={search}
                isAdmin={isAdmin}
                onEdit={openEdit}
                onDelete={openDeleteDialog}
                statusStyle={statusStyle}
              />
            </TabsContent>
           </Tabs>
          </div>
        );
      })()}
    </div>
  );
};

export default WorkOrders;
