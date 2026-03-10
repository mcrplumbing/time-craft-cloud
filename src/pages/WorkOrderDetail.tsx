import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";
import { ArrowLeft, Printer } from "lucide-react";

const WorkOrderDetail = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [order, setOrder] = useState<any>(null);

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
                <Select value={order.status} onValueChange={updateStatus}>
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <p className="text-sm font-body text-muted-foreground">{order.customer_name}</p>
              {order.customer_address && <p className="text-sm font-body text-muted-foreground">{order.customer_address}</p>}
              {order.description && <p className="text-sm font-body mt-2 whitespace-pre-line">{order.description}</p>}
              <p className="text-xs text-muted-foreground font-body mt-2">Created: {format(new Date(order.created_at), "MMM d, yyyy")}</p>
              {order.created_by_name && <p className="text-xs text-muted-foreground font-body">Created by: {order.created_by_name}</p>}
            </div>
          </div>
        </CardContent>
      </Card>

    </div>
  );
};

export default WorkOrderDetail;
