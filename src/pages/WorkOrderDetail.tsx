import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ArrowLeft, Plus, Printer, Trash2 } from "lucide-react";

const WorkOrderDetail = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [order, setOrder] = useState<any>(null);
  const [timeEntries, setTimeEntries] = useState<any[]>([]);
  const [materials, setMaterials] = useState<any[]>([]);
  const [newTime, setNewTime] = useState({ description: "", hours: "", rate: "", date: format(new Date(), "yyyy-MM-dd") });
  const [newMaterial, setNewMaterial] = useState({ description: "", quantity: "", unit_cost: "" });

  const fetchAll = async () => {
    if (!id || !user) return;
    const [orderRes, timeRes, matRes] = await Promise.all([
      supabase.from("work_orders").select("*").eq("id", id).eq("user_id", user.id).maybeSingle(),
      supabase.from("work_order_time").select("*").eq("work_order_id", id).eq("user_id", user.id).order("date", { ascending: false }),
      supabase.from("work_order_materials").select("*").eq("work_order_id", id).eq("user_id", user.id),
    ]);
    setOrder(orderRes.data);
    setTimeEntries(timeRes.data || []);
    setMaterials(matRes.data || []);
  };

  useEffect(() => { fetchAll(); }, [id, user]);

  const updateStatus = async (status: string) => {
    if (!id) return;
    await supabase.from("work_orders").update({ status }).eq("id", id);
    fetchAll();
  };

  const addTime = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !user) return;
    const { error } = await supabase.from("work_order_time").insert({
      work_order_id: id,
      user_id: user.id,
      description: newTime.description,
      hours: parseFloat(newTime.hours),
      rate: parseFloat(newTime.rate),
      date: newTime.date,
    });
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else {
      setNewTime({ description: "", hours: "", rate: "", date: format(new Date(), "yyyy-MM-dd") });
      fetchAll();
    }
  };

  const addMaterial = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !user) return;
    const { error } = await supabase.from("work_order_materials").insert({
      work_order_id: id,
      user_id: user.id,
      description: newMaterial.description,
      quantity: parseFloat(newMaterial.quantity),
      unit_cost: parseFloat(newMaterial.unit_cost),
    });
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else {
      setNewMaterial({ description: "", quantity: "", unit_cost: "" });
      fetchAll();
    }
  };

  const deleteTime = async (timeId: string) => {
    await supabase.from("work_order_time").delete().eq("id", timeId);
    fetchAll();
  };

  const deleteMaterial = async (matId: string) => {
    await supabase.from("work_order_materials").delete().eq("id", matId);
    fetchAll();
  };

  const timeTotals = timeEntries.reduce((acc, t) => acc + t.hours * t.rate, 0);
  const materialTotals = materials.reduce((acc, m) => acc + m.quantity * m.unit_cost, 0);
  const grandTotal = timeTotals + materialTotals;

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
            Work Order #{order.order_number}
          </h1>
        </div>
        <Button variant="outline" size="sm" onClick={() => window.print()} className="gap-2">
          <Printer className="h-4 w-4" /> Print
        </Button>
      </div>

      {/* Print header */}
      <div className="print-only mb-6">
        <h1 className="text-2xl font-bold font-display">MCR Plumbing Tracker</h1>
        <h2 className="text-xl font-display">Work Order #{order.order_number}</h2>
      </div>

      {/* Order info */}
      <Card>
        <CardContent className="py-4 space-y-2">
          <div className="flex justify-between items-start">
            <div>
              <p className="font-display font-bold text-lg">{order.title || "Untitled"}</p>
              <p className="text-sm font-body text-muted-foreground">{order.customer_name}</p>
              {order.customer_address && <p className="text-sm font-body text-muted-foreground">{order.customer_address}</p>}
              {order.description && <p className="text-sm font-body mt-2">{order.description}</p>}
              <p className="text-xs text-muted-foreground font-body mt-2">Created: {format(new Date(order.created_at), "MMM d, yyyy")}</p>
            </div>
            <div className="no-print">
              <Select value={order.status} onValueChange={updateStatus}>
                <SelectTrigger className="w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="invoiced">Invoiced</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Time entries */}
      <Card>
        <CardHeader>
          <CardTitle className="font-display text-lg">Time</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {timeEntries.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm font-body">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-2">Date</th>
                    <th className="pb-2">Description</th>
                    <th className="pb-2 text-right">Hours</th>
                    <th className="pb-2 text-right">Rate</th>
                    <th className="pb-2 text-right">Total</th>
                    <th className="pb-2 no-print"></th>
                  </tr>
                </thead>
                <tbody>
                  {timeEntries.map((t) => (
                    <tr key={t.id} className="border-b last:border-0">
                      <td className="py-2">{format(new Date(t.date), "MM/dd/yy")}</td>
                      <td className="py-2">{t.description}</td>
                      <td className="py-2 text-right">{t.hours}</td>
                      <td className="py-2 text-right">${Number(t.rate).toFixed(2)}</td>
                      <td className="py-2 text-right font-semibold">${(t.hours * t.rate).toFixed(2)}</td>
                      <td className="py-2 text-right no-print">
                        <Button variant="ghost" size="sm" onClick={() => deleteTime(t.id)}>
                          <Trash2 className="h-3 w-3 text-destructive" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                  <tr className="font-bold">
                    <td colSpan={4} className="py-2 text-right">Time Total:</td>
                    <td className="py-2 text-right">${timeTotals.toFixed(2)}</td>
                    <td className="no-print"></td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          {/* Add time form */}
          <form onSubmit={addTime} className="no-print grid grid-cols-2 md:grid-cols-5 gap-2 items-end">
            <div>
              <Label className="text-xs">Date</Label>
              <Input type="date" value={newTime.date} onChange={(e) => setNewTime({ ...newTime, date: e.target.value })} required />
            </div>
            <div className="col-span-2 md:col-span-1">
              <Label className="text-xs">Description</Label>
              <Input value={newTime.description} onChange={(e) => setNewTime({ ...newTime, description: e.target.value })} placeholder="Work done" required />
            </div>
            <div>
              <Label className="text-xs">Hours</Label>
              <Input type="number" step="0.25" value={newTime.hours} onChange={(e) => setNewTime({ ...newTime, hours: e.target.value })} placeholder="0" required />
            </div>
            <div>
              <Label className="text-xs">Rate ($/hr)</Label>
              <Input type="number" step="0.01" value={newTime.rate} onChange={(e) => setNewTime({ ...newTime, rate: e.target.value })} placeholder="0" required />
            </div>
            <Button type="submit" size="sm" className="gap-1"><Plus className="h-3 w-3" /> Add</Button>
          </form>
        </CardContent>
      </Card>

      {/* Materials */}
      <Card>
        <CardHeader>
          <CardTitle className="font-display text-lg">Materials</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {materials.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm font-body">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-2">Description</th>
                    <th className="pb-2 text-right">Qty</th>
                    <th className="pb-2 text-right">Unit Cost</th>
                    <th className="pb-2 text-right">Total</th>
                    <th className="pb-2 no-print"></th>
                  </tr>
                </thead>
                <tbody>
                  {materials.map((m) => (
                    <tr key={m.id} className="border-b last:border-0">
                      <td className="py-2">{m.description}</td>
                      <td className="py-2 text-right">{m.quantity}</td>
                      <td className="py-2 text-right">${Number(m.unit_cost).toFixed(2)}</td>
                      <td className="py-2 text-right font-semibold">${(m.quantity * m.unit_cost).toFixed(2)}</td>
                      <td className="py-2 text-right no-print">
                        <Button variant="ghost" size="sm" onClick={() => deleteMaterial(m.id)}>
                          <Trash2 className="h-3 w-3 text-destructive" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                  <tr className="font-bold">
                    <td colSpan={3} className="py-2 text-right">Materials Total:</td>
                    <td className="py-2 text-right">${materialTotals.toFixed(2)}</td>
                    <td className="no-print"></td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          {/* Add material form */}
          <form onSubmit={addMaterial} className="no-print grid grid-cols-2 md:grid-cols-4 gap-2 items-end">
            <div className="col-span-2 md:col-span-1">
              <Label className="text-xs">Description</Label>
              <Input value={newMaterial.description} onChange={(e) => setNewMaterial({ ...newMaterial, description: e.target.value })} placeholder="Material" required />
            </div>
            <div>
              <Label className="text-xs">Quantity</Label>
              <Input type="number" step="0.01" value={newMaterial.quantity} onChange={(e) => setNewMaterial({ ...newMaterial, quantity: e.target.value })} placeholder="0" required />
            </div>
            <div>
              <Label className="text-xs">Unit Cost ($)</Label>
              <Input type="number" step="0.01" value={newMaterial.unit_cost} onChange={(e) => setNewMaterial({ ...newMaterial, unit_cost: e.target.value })} placeholder="0" required />
            </div>
            <Button type="submit" size="sm" className="gap-1"><Plus className="h-3 w-3" /> Add</Button>
          </form>
        </CardContent>
      </Card>

      {/* Grand total */}
      <Card className="border-accent">
        <CardContent className="py-4 flex justify-between items-center">
          <span className="font-display font-bold text-lg">Grand Total</span>
          <span className="font-display font-bold text-2xl text-accent">${grandTotal.toFixed(2)}</span>
        </CardContent>
      </Card>
    </div>
  );
};

export default WorkOrderDetail;
