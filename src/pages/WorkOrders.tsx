import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Link } from "react-router-dom";
import { Plus, FileText, Pencil } from "lucide-react";
import { format } from "date-fns";
import { queueAction, isOnline } from "@/lib/offlineQueue";

const WorkOrders = () => {
  const { user } = useAuth();
  const { isAdmin } = useIsAdmin();
  const { toast } = useToast();
  const [orders, setOrders] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editOrder, setEditOrder] = useState<any>(null);
  const [form, setForm] = useState({ title: "", customer_name: "", customer_address: "", description: "", job_number: "" });
  const [editForm, setEditForm] = useState({ title: "", customer_name: "", customer_address: "", description: "", job_number: "" });
  const [loading, setLoading] = useState(false);

  const fetchOrders = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("work_orders")
      .select("*")
      .order("created_at", { ascending: false });
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
        },
      });
      toast({ title: "Work Order Saved Offline", description: "Will sync when you're back online." });
      setForm({ title: "", customer_name: "", customer_address: "", description: "", job_number: "" });
      setOpen(false);
    } else {
      const { error } = await supabase.from("work_orders").insert({
        user_id: user.id,
        title: form.title,
        customer_name: form.customer_name,
        customer_address: form.customer_address,
        description: form.description,
        job_number: finalJobNumber,
      });
      if (error) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
      } else {
        toast({ title: "Work Order Created" });
        setForm({ title: "", customer_name: "", customer_address: "", description: "", job_number: "" });
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
    }).eq("id", editOrder.id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Work Order Updated" });
      setEditOpen(false);
      fetchOrders();
    }
    setLoading(false);
  };

  const statusStyle = (status: string) => {
    switch (status) {
      case "completed":
      case "invoiced":
        return "bg-success/10 text-success";
      case "in_progress":
        return "bg-accent/10 text-accent";
      default:
        return "bg-muted text-muted-foreground";
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
              <Label>Description</Label>
              <Textarea value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} rows={3} />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Saving..." : "Save Changes"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {orders.length === 0 ? (
        <Card>
          <CardContent className="py-12 flex flex-col items-center gap-3">
            <FileText className="h-12 w-12 text-muted-foreground" />
            <p className="text-muted-foreground font-body">No work orders yet. Create your first one!</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {orders.map((order) => (
            <Link key={order.id} to={`/work-orders/${order.id}`}>
              <Card className="hover:shadow-md transition-shadow cursor-pointer">
                <CardContent className="flex items-center justify-between py-4">
                  <div>
                    <p className="font-body font-semibold">#{order.job_number || order.order_number} — {order.title || "Untitled"}</p>
                    <p className="text-sm text-muted-foreground font-body">{order.customer_name}</p>
                    <p className="text-xs text-muted-foreground font-body">{format(new Date(order.created_at), "MMM d, yyyy")}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => openEdit(order, e)}
                      className="h-8 w-8 p-0"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <span className={`text-xs font-body px-2 py-1 rounded-full ${statusStyle(order.status)}`}>
                      {order.status.replace("_", " ")}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
};

export default WorkOrders;
