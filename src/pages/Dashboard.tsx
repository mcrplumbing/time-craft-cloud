import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock, FileText, CheckCircle, PlayCircle } from "lucide-react";
import { Link } from "react-router-dom";
import { format } from "date-fns";

const Dashboard = () => {
  const { user } = useAuth();
  const [activeEntry, setActiveEntry] = useState<any>(null);
  const [stats, setStats] = useState({ totalOrders: 0, activeOrders: 0, completedOrders: 0 });
  const [recentOrders, setRecentOrders] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;

    // Fetch active time entry
    supabase
      .from("time_entries")
      .select("*")
      .eq("user_id", user.id)
      .is("clock_out", null)
      .maybeSingle()
      .then(({ data }) => setActiveEntry(data));

    // Fetch work order stats
    supabase
      .from("work_orders")
      .select("id, status")
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .then(({ data }) => {
        if (data) {
          setStats({
            totalOrders: data.length,
            activeOrders: data.filter((o) => o.status === "in_progress" || o.status === "draft").length,
            completedOrders: data.filter((o) => o.status === "completed" || o.status === "invoiced").length,
          });
        }
      });

    // Recent work orders
    supabase
      .from("work_orders")
      .select("*")
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(5)
      .then(({ data }) => setRecentOrders(data || []));
  }, [user]);

  const statCards = [
    { label: "Total Work Orders", value: stats.totalOrders, icon: FileText, color: "text-foreground" },
    { label: "Active Orders", value: stats.activeOrders, icon: PlayCircle, color: "text-accent" },
    { label: "Completed", value: stats.completedOrders, icon: CheckCircle, color: "text-success" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-display font-bold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground font-body">Welcome back.</p>
      </div>

      {/* Active clock */}
      <Card className={activeEntry ? "border-accent bg-accent/5" : ""}>
        <CardContent className="flex items-center gap-4 py-4">
          <Clock className={`h-8 w-8 ${activeEntry ? "text-accent animate-pulse-warm" : "text-muted-foreground"}`} />
          <div className="flex-1">
            <p className="font-display font-semibold text-lg">
              {activeEntry ? "You're on the clock" : "Not clocked in"}
            </p>
            <p className="text-sm text-muted-foreground font-body">
              {activeEntry
                ? `Since ${format(new Date(activeEntry.clock_in), "h:mm a")}`
                : "Head to Time Clock to start your day."}
            </p>
          </div>
          <Link
            to="/time-clock"
            className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-body font-semibold hover:opacity-90 transition-opacity"
          >
            {activeEntry ? "View Clock" : "Clock In"}
          </Link>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {statCards.map(({ label, value, icon: Icon, color }) => (
          <Card key={label}>
            <CardContent className="flex items-center gap-4 py-4">
              <Icon className={`h-6 w-6 ${color}`} />
              <div>
                <p className="text-2xl font-display font-bold">{value}</p>
                <p className="text-sm text-muted-foreground font-body">{label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Recent orders */}
      <Card>
        <CardHeader>
          <CardTitle className="font-display text-lg">Recent Work Orders</CardTitle>
        </CardHeader>
        <CardContent>
          {recentOrders.length === 0 ? (
            <p className="text-muted-foreground text-sm font-body">No work orders yet. <Link to="/work-orders" className="text-accent hover:underline">Create one</Link>.</p>
          ) : (
            <div className="space-y-2">
              {recentOrders.map((order) => (
                <Link
                  key={order.id}
                  to={`/work-orders/${order.id}`}
                  className="flex items-center justify-between p-3 rounded-md hover:bg-muted transition-colors"
                >
                  <div>
                    <p className="font-body font-semibold text-sm">#{order.job_number || order.order_number} — {order.title || "Untitled"}</p>
                    <p className="text-xs text-muted-foreground font-body">{order.customer_name}</p>
                  </div>
                  <span className={`text-xs font-body px-2 py-1 rounded-full ${
                    order.status === "completed" || order.status === "invoiced"
                      ? "bg-success/10 text-success"
                      : order.status === "in_progress"
                      ? "bg-accent/10 text-accent"
                      : "bg-muted text-muted-foreground"
                  }`}>
                    {order.status.replace("_", " ")}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Dashboard;
