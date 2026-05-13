import { useLocation } from "wouter";
import { useListAdminOrders, useConfirmOrder, getListAdminOrdersQueryKey, useGetCurrentUser } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { AdminLayout } from "./index";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { useState, useEffect } from "react";
import { CheckCircle, ChevronDown, ChevronUp } from "lucide-react";

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-700",
  paid: "bg-green-100 text-green-700",
  failed: "bg-red-100 text-red-700",
  refunded: "bg-gray-100 text-gray-600",
};
const STATUS_LABELS: Record<string, string> = {
  pending: "Chờ TT", paid: "Đã TT", failed: "Thất bại", refunded: "Hoàn tiền",
};

// Mobile-friendly order card
function OrderCard({ order, onConfirm }: { order: any; onConfirm: (id: number) => void }) {
  const [expanded, setExpanded] = useState(false);
  const statusColor = STATUS_COLORS[order.status] || "bg-gray-100 text-gray-600";
  
  return (
    <Card className="border-border/50 overflow-hidden">
      <div 
        className="p-4 flex items-center justify-between cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-mono text-sm font-semibold">#{order.id}</span>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColor}`}>
              {STATUS_LABELS[order.status] ?? order.status}
            </span>
          </div>
          <p className="text-sm font-medium truncate">{order.customerName}</p>
          <p className="text-sm font-bold text-primary">{order.total.toLocaleString("vi-VN")}đ</p>
        </div>
        <div className="flex items-center gap-2">
          {order.status === "pending" && (
            <Button 
              size="sm" 
              variant="outline" 
              className="text-green-600 border-green-200 hover:bg-green-50 flex-shrink-0"
              onClick={(e) => {
                e.stopPropagation();
                onConfirm(order.id);
              }}
            >
              <CheckCircle className="w-3.5 h-3.5 mr-1" />
              <span className="hidden sm:inline">Xác nhận</span>
            </Button>
          )}
          {expanded ? <ChevronUp className="w-5 h-5 text-muted-foreground" /> : <ChevronDown className="w-5 h-5 text-muted-foreground" />}
        </div>
      </div>
      
      {/* Expanded details */}
      {expanded && (
        <CardContent className="pt-0 border-t border-border/30 space-y-3">
          <div className="grid grid-cols-2 gap-3 pt-3">
            <div>
              <p className="text-xs text-muted-foreground">Email</p>
              <p className="text-sm">{order.customerEmail}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Ngày tạo</p>
              <p className="text-sm">{new Date(order.createdAt).toLocaleDateString("vi-VN")}</p>
            </div>
          </div>
          {order.items && order.items.length > 0 && (
            <div>
              <p className="text-xs text-muted-foreground mb-2">Sản phẩm</p>
              <div className="space-y-2">
                {order.items.map((item: any, idx: number) => (
                  <div key={idx} className="flex items-center gap-2 text-sm">
                    <img src={item.thumbnailUrl} alt="" className="w-12 h-8 object-cover rounded" />
                    <span className="truncate flex-1">{item.titleVi}</span>
                    <span className="font-medium">{item.price?.toLocaleString("vi-VN")}đ</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}

// Desktop table view (hidden on mobile)
function OrdersTable({ orders, onConfirm }: { orders: any[]; onConfirm: (id: number) => void }) {
  return (
    <div className="hidden md:block bg-white rounded-xl border border-border/50 overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 border-b">
          <tr>
            {["ID", "Khách hàng", "Email", "Tổng tiền", "Trạng thái", "Ngày tạo", ""].map(h => (
              <th key={h} className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {orders?.map(order => (
            <tr key={order.id} className="border-b last:border-0 hover:bg-slate-50 transition-colors">
              <td className="px-4 py-3 font-mono text-xs">#{order.id}</td>
              <td className="px-4 py-3 font-medium">{order.customerName}</td>
              <td className="px-4 py-3 text-muted-foreground">{order.customerEmail}</td>
              <td className="px-4 py-3 font-bold text-primary">{order.total.toLocaleString("vi-VN")}đ</td>
              <td className="px-4 py-3">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[order.status] ?? ""}`}>
                  {STATUS_LABELS[order.status] ?? order.status}
                </span>
              </td>
              <td className="px-4 py-3 text-muted-foreground">{new Date(order.createdAt).toLocaleDateString("vi-VN")}</td>
              <td className="px-4 py-3">
                {order.status === "pending" && (
                  <Button size="sm" variant="outline" className="text-green-600 border-green-200 hover:bg-green-50" onClick={() => onConfirm(order.id)}>
                    <CheckCircle className="w-3.5 h-3.5 mr-1" /> Xác nhận
                  </Button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {orders?.length === 0 && (
        <p className="text-center py-12 text-muted-foreground">Không có đơn hàng nào</p>
      )}
    </div>
  );
}

export default function AdminOrders() {
  const [, setLocation] = useLocation();
  const { data: user, isLoading: userLoading } = useGetCurrentUser();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const { data: orders, isLoading } = useListAdminOrders(
    statusFilter !== "all" ? { status: statusFilter } : {},
    { query: { queryKey: getListAdminOrdersQueryKey(statusFilter !== "all" ? { status: statusFilter } : {}) } }
  );
  const confirmOrder = useConfirmOrder();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  useEffect(() => {
    if (!userLoading && (!user || (user as any).role !== "admin")) setLocation("/login");
  }, [user, userLoading, setLocation]);

  if (!userLoading && (!user || (user as any).role !== "admin")) return null;

  const handleConfirm = (id: number) => {
    confirmOrder.mutate({ id }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListAdminOrdersQueryKey({}) });
        toast({ title: "Xác nhận thanh toán thành công!" });
      },
    });
  };

  const ordersList = (orders as any[]) ?? [];
  const filterControl = (
    <Select value={statusFilter} onValueChange={setStatusFilter}>
      <SelectTrigger className="h-9 w-[130px] sm:w-40 text-xs sm:text-sm">
        <SelectValue placeholder="Lọc" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">Tất cả</SelectItem>
        <SelectItem value="pending">Chờ thanh toán</SelectItem>
        <SelectItem value="paid">Đã thanh toán</SelectItem>
        <SelectItem value="failed">Thất bại</SelectItem>
      </SelectContent>
    </Select>
  );

  return (
    <AdminLayout
      title="Quản lý Đơn hàng"
      description={`${ordersList.length} đơn`}
      actions={filterControl}
    >
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 rounded-2xl" />
          ))}
        </div>
      ) : ordersList.length === 0 ? (
        <div className="bg-white rounded-2xl p-10 text-center text-muted-foreground border border-dashed border-border/60">
          Không có đơn hàng nào
        </div>
      ) : (
        <>
          <div className="md:hidden space-y-3">
            {ordersList.map((order) => (
              <OrderCard key={order.id} order={order} onConfirm={handleConfirm} />
            ))}
          </div>
          <OrdersTable orders={ordersList} onConfirm={handleConfirm} />
        </>
      )}
    </AdminLayout>
  );
}
