import { useState, useMemo } from "react";
import { startOfWeek, endOfWeek, addWeeks, format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ChevronLeft, ChevronRight, FileText, Pencil, Trash2 } from "lucide-react";
import { Link } from "react-router-dom";

interface CompletedOrdersArchiveProps {
  orders: any[];
  search: string;
  isAdmin: boolean;
  onEdit: (order: any, e: React.MouseEvent) => void;
  onDelete: (order: any, e: React.MouseEvent) => void;
  statusStyle: (status: string) => string;
}

const CompletedOrdersArchive = ({
  orders,
  search,
  isAdmin,
  onEdit,
  onDelete,
  statusStyle,
}: CompletedOrdersArchiveProps) => {
  const [weekStart, setWeekStart] = useState(() =>
    startOfWeek(new Date(), { weekStartsOn: 1 })
  );

  const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });

  const filteredOrders = useMemo(() => {
    const q = search.toLowerCase().trim();

    return orders.filter((o) => {
      // Filter by job_date within the selected week
      const jobDate = o.job_date
        ? new Date(o.job_date + "T00:00:00")
        : new Date(o.created_at);
      if (jobDate < weekStart || jobDate > weekEnd) return false;

      // Apply search filter
      if (q) {
        return [o.job_number, o.title, o.customer_name, o.customer_address, o.description]
          .filter(Boolean)
          .some((field: string) => field.toLowerCase().includes(q));
      }
      return true;
    });
  }, [orders, weekStart, weekEnd, search]);

  // Sort by job_date descending
  const sorted = useMemo(
    () =>
      [...filteredOrders].sort((a, b) => {
        const dateA = a.job_date ? new Date(a.job_date + "T00:00:00") : new Date(a.created_at);
        const dateB = b.job_date ? new Date(b.job_date + "T00:00:00") : new Date(b.created_at);
        return dateB.getTime() - dateA.getTime();
      }),
    [filteredOrders]
  );

  return (
    <div className="space-y-4">
      {/* Week navigation */}
      <div className="flex items-center justify-center gap-3">
        <Button
          variant="outline"
          size="icon"
          onClick={() => setWeekStart((w) => addWeeks(w, -1))}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="font-body font-semibold text-sm">
          {format(weekStart, "MMM d")} — {format(weekEnd, "MMM d, yyyy")}
        </span>
        <Button
          variant="outline"
          size="icon"
          onClick={() => setWeekStart((w) => addWeeks(w, 1))}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {sorted.length === 0 ? (
        <Card>
          <CardContent className="py-12 flex flex-col items-center gap-3">
            <FileText className="h-12 w-12 text-muted-foreground" />
            <p className="text-muted-foreground font-body">
              No completed work orders this week.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {sorted.map((order) => (
            <Link key={order.id} to={`/work-orders/${order.id}`}>
              <Card className="hover:shadow-md transition-shadow cursor-pointer">
                <CardContent className="flex items-center justify-between py-4">
                  <div>
                    <p className="font-body font-semibold">
                      #{order.job_number || order.order_number} — {order.title || "Untitled"}
                    </p>
                    <p className="text-sm text-muted-foreground font-body">
                      {order.customer_name}
                    </p>
                    <p className="text-xs text-muted-foreground font-body">
                      {order.job_date
                        ? format(new Date(order.job_date + "T00:00:00"), "EEE, MMM d, yyyy")
                        : format(new Date(order.created_at), "EEE, MMM d, yyyy")}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => onEdit(order, e)}
                      className="h-8 w-8 p-0"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    {isAdmin && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => onDelete(order, e)}
                        className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                        aria-label={`Delete work order ${order.job_number || order.order_number}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                    <span
                      className={`text-xs font-body px-2 py-1 rounded-full ${statusStyle(order.status)}`}
                    >
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

export default CompletedOrdersArchive;
