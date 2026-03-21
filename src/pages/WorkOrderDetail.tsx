import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ArrowLeft, Printer, Pencil, CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const WorkOrderDetail = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { isAdmin } = useIsAdmin();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [order, setOrder] = useState<any>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({ title: "", customer_name: "", customer_address: "", description: "", job_number: "", job_date: new Date() as Date | undefined });
  const [loading, setLoading] = useState(false);

  const fetchAll = async () => {
    if (!id || !user) return;
    const orderRes = await supabase.from("work_orders").select("*").eq("id", id).maybeSingle();
    let createdByName = "";
    if (orderRes.data?.user_id) {
      const { data: profile } = await supabase.from("profiles").select("full_name").eq("user_id", orderRes.data.user_id).maybeSingle();
      createdByName = profile?.full_name || "";
    }
    setOrder({ ...orderRes.data, created_by_name: createdByName });
  };

  useEffect(() => { fetchAll(); }, [id, user]);

  const updateStatus = async (status: string) => {
    if (!id) return;
    await supabase.from("work_orders").update({ status }).eq("id", id);
    fetchAll();
  };

  const canEdit = (order: any) => {
    if (order.status === "completed" || order.status === "invoiced") return isAdmin;
    return true;
  };

  const openEdit = () => {
    if (!order) return;
    if (!canEdit(order)) {
      toast({ title: "Read Only", description: "Only admins can edit completed/invoiced orders.", variant: "destructive" });
      return;
    }
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
    if (!id) return;
    setLoading(true);
    const { error } = await supabase.from("work_orders").update({
      title: editForm.title,
      customer_name: editForm.customer_name,
      customer_address: editForm.customer_address,
      description: editForm.description,
      job_number: editForm.job_number,
      job_date: editForm.job_date ? format(editForm.job_date, "yyyy-MM-dd") : null,
    } as any).eq("id", id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Work Order Updated" });
      setEditOpen(false);
      fetchAll();
    }
    setLoading(false);
  };

  if (!order) return <div className="p-8 text-center text-muted-foreground font-body">Loading...</div>;

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="no-print flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate("/work-orders")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-xl md:text-2xl font-display font-bold">
            Work Order #{order.job_number || order.order_number}
          </h1>
        </div>
        <Button variant="outline" size="sm" onClick={openEdit} className="gap-2">
          <Pencil className="h-4 w-4" /> Edit
        </Button>
        <Button variant="outline" size="sm" onClick={() => { const prev = document.title; document.title = `Work-Order-${order.job_number || order.order_number}.pdf`; window.print(); document.title = prev; }} className="gap-2">
          <Printer className="h-4 w-4" /> Print
        </Button>
      </div>

      {/* Print header */}
      <div className="print-only mb-6">
        <h1 className="text-2xl font-bold font-display">MCR Plumbing Tracker</h1>
        <h2 className="text-xl font-display">Work Order #{order.job_number || order.order_number}</h2>
      </div>

      {/* Order info */}
      <Card>
        <CardContent className="py-4 space-y-2">
          <div className="flex flex-col gap-3">
            <div className="flex justify-between items-start">
              <p className="font-display font-bold text-lg">{order.title || "Untitled"}</p>
              <div className="no-print shrink-0">
                {isAdmin ? (
                  <Select value={order.status} onValueChange={updateStatus}>
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                    </SelectContent>
                  </Select>
                ) : (
                  <span className={`text-xs font-body px-2 py-1 rounded-full ${order.status === "completed" ? "bg-success/10 text-success" : "bg-accent/10 text-accent"}`}>
                    {order.status}
                  </span>
                )}
              </div>
            </div>
            <div>
              <p className="text-sm font-body text-muted-foreground">{order.customer_name}</p>
              {order.customer_address && <p className="text-sm font-body text-muted-foreground">{order.customer_address}</p>}
              {order.description && <p className="text-sm font-body mt-2 whitespace-pre-line">{order.description}</p>}
              <p className="text-xs text-muted-foreground font-body mt-2">
                Job Date: {order.job_date ? format(new Date(order.job_date + "T00:00:00"), "MMM d, yyyy") : format(new Date(order.created_at), "MMM d, yyyy")}
              </p>
              {order.created_by_name && <p className="text-xs text-muted-foreground font-body">Created by: {order.created_by_name}</p>}
            </div>
          </div>
        </CardContent>
      </Card>

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
    </div>
  );
};

export default WorkOrderDetail;
