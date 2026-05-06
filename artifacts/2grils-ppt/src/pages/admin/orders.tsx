import { useLocation } from "wouter";
import { useListAdminOrders, useConfirmOrder, getListAdminOrdersQueryKey, useGetCurrentUser } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { AdminNav } from "./index";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useState, useEffect } from "react";
import { CheckCircle } from "lucide-react";

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-700",
  paid: "bg-green-100 text-green-700",
  failed: "bg-red-100 text-red-700",
  refunded: "bg-gray-100 text-gray-600",
};
const STATUS_LABELS: Record<string, string> = {
  pending: "Chờ TT", paid: "Đã TT", failed: "Thất bại", refunded: "Hoàn tiền",
};

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
    confirmOrder.mutate({ orderId: id } as any, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListAdminOrdersQueryKey({}) });
        toast({ title: "Xác nhận thanh toán thành công!" });
      },
    });
  };

  return (
    <div className="flex min-h-screen bg-slate-50">
      <AdminNav />
      <main className="flex-1 p-8 overflow-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-extrabold">Quản lý Đơn hàng</h1>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tất cả</SelectItem>
              <SelectItem value="pending">Chờ thanh toán</SelectItem>
              <SelectItem value="paid">Đã thanh toán</SelectItem>
              <SelectItem value="failed">Thất bại</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {isLoading ? <Skeleton className="w-full h-64 rounded-xl" /> : (
          <div className="bg-white rounded-xl border border-border/50 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b">
                <tr>
                  {["ID", "Khách hàng", "Email", "Tổng tiền", "Trạng thái", "Ngày tạo", ""].map(h => (
                    <th key={h} className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(orders as any[])?.map(order => (
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
                        <Button size="sm" variant="outline" className="text-green-600 border-green-200 hover:bg-green-50" onClick={() => handleConfirm(order.id)}>
                          <CheckCircle className="w-3.5 h-3.5 mr-1" /> Xác nhận
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {(orders as any[])?.length === 0 && (
              <p className="text-center py-12 text-muted-foreground">Không có đơn hàng nào</p>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
