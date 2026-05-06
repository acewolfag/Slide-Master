import { useEffect } from "react";
import { useLocation } from "wouter";
import { useListAdminCustomRequests, useUpdateCustomRequestStatus, getListAdminCustomRequestsQueryKey, useGetCurrentUser } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { AdminNav } from "./index";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";

const STATUSES = ["pending", "quoted", "deposit-paid", "in-progress", "review", "final-payment", "delivered"];
const STATUS_VI: Record<string, string> = {
  pending: "Mới", quoted: "Đã báo giá", "deposit-paid": "Đã đặt cọc",
  "in-progress": "Đang làm", review: "Đang duyệt", "final-payment": "Thanh toán cuối", delivered: "Hoàn thành",
};
const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-700", quoted: "bg-blue-100 text-blue-700",
  "deposit-paid": "bg-indigo-100 text-indigo-700", "in-progress": "bg-orange-100 text-orange-700",
  review: "bg-purple-100 text-purple-700", "final-payment": "bg-pink-100 text-pink-700",
  delivered: "bg-green-100 text-green-700",
};

export default function AdminCustomRequests() {
  const [, setLocation] = useLocation();
  const { data: user, isLoading: userLoading } = useGetCurrentUser();
  const { data: requests, isLoading } = useListAdminCustomRequests();
  const updateStatus = useUpdateCustomRequestStatus();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  useEffect(() => {
    if (!userLoading && (!user || (user as any).role !== "admin")) setLocation("/login");
  }, [user, userLoading, setLocation]);

  if (!userLoading && (!user || (user as any).role !== "admin")) return null;

  const handleAdvance = (requestId: string, currentStatus: string) => {
    const idx = STATUSES.indexOf(currentStatus);
    if (idx < 0 || idx >= STATUSES.length - 1) return;
    const nextStatus = STATUSES[idx + 1];
    updateStatus.mutate({ requestId, data: { status: nextStatus } } as any, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListAdminCustomRequestsQueryKey() });
        toast({ title: `Cập nhật → ${STATUS_VI[nextStatus]}` });
      },
    });
  };

  const byStatus = STATUSES.reduce<Record<string, any[]>>((acc, s) => {
    acc[s] = (requests as any[])?.filter(r => r.status === s) ?? [];
    return acc;
  }, {});

  return (
    <div className="flex min-h-screen bg-slate-50">
      <AdminNav />
      <main className="flex-1 p-8 overflow-auto">
        <h1 className="text-2xl font-extrabold mb-6">Custom Requests — Kanban</h1>
        {isLoading ? <Skeleton className="w-full h-64 rounded-xl" /> : (
          <div className="flex gap-4 overflow-x-auto pb-4">
            {STATUSES.map(status => (
              <div key={status} className="flex-shrink-0 w-64">
                <div className="flex items-center gap-2 mb-3">
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${STATUS_COLORS[status]}`}>{STATUS_VI[status]}</span>
                  <span className="text-xs text-muted-foreground">{byStatus[status].length}</span>
                </div>
                <div className="space-y-3">
                  {byStatus[status].map(req => (
                    <div key={req.id} className="bg-white rounded-xl p-4 shadow-sm border border-border/50">
                      <p className="font-mono text-xs font-bold text-primary mb-1">{req.requestId}</p>
                      <p className="font-semibold text-sm mb-0.5">{req.customerName}</p>
                      <p className="text-xs text-muted-foreground mb-2">{req.slideType} · {req.slideCount} slides</p>
                      <p className="text-xs text-muted-foreground mb-3">Deadline: {req.deadline}</p>
                      {status !== "delivered" && (
                        <Button size="sm" variant="outline" className="w-full text-xs h-7" onClick={() => handleAdvance(req.requestId, req.status)}>
                          → {STATUS_VI[STATUSES[STATUSES.indexOf(status) + 1]]}
                        </Button>
                      )}
                    </div>
                  ))}
                  {byStatus[status].length === 0 && (
                    <div className="bg-white/50 rounded-xl p-4 border border-dashed border-border text-center text-xs text-muted-foreground">Trống</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
