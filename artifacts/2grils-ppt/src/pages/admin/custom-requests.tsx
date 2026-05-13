import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { customFetch, useGetCurrentUser } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { AdminLayout } from "./index";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { CustomRequestChat } from "@/components/custom-request-chat";

const STATUSES = [
  "pending",
  "quoted",
  "deposit-paid",
  "in-progress",
  "review",
  "finalizing",
  "final-payment",
  "delivered",
] as const;
type Status = (typeof STATUSES)[number];

const STATUS_VI: Record<Status, string> = {
  pending: "Mới",
  quoted: "Đã báo giá",
  "deposit-paid": "Đã đặt cọc",
  "in-progress": "Đang làm",
  review: "Chờ khách duyệt",
  finalizing: "Đang hoàn thiện",
  "final-payment": "Thanh toán cuối",
  delivered: "Hoàn thành",
};

const STATUS_COLORS: Record<Status, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  quoted: "bg-blue-100 text-blue-800",
  "deposit-paid": "bg-indigo-100 text-indigo-800",
  "in-progress": "bg-orange-100 text-orange-800",
  review: "bg-purple-100 text-purple-800",
  finalizing: "bg-teal-100 text-teal-800",
  "final-payment": "bg-pink-100 text-pink-800",
  delivered: "bg-emerald-100 text-emerald-800",
};

interface CustomRequestFile {
  name: string;
  url: string;
  type: string;
  size?: number;
}

interface CustomRequestRow {
  id: number;
  requestId: string;
  userId: number | null;
  status: Status;
  slideType: string;
  slideCount: number;
  deadline: string;
  style: string | null;
  language: string;
  budget: string | null;
  notes: string | null;
  company: string | null;
  targetAudience: string | null;
  objective: string | null;
  colorPalette: string | null;
  aspectRatio: string;
  attachments: CustomRequestFile[];
  quotedPrice: number | null;
  depositAmount: number | null;
  finalAmount: number | null;
  depositOrderId: number | null;
  finalOrderId: number | null;
  depositPaidAt: string | null;
  finalPaidAt: string | null;
  quoteMessage: string | null;
  customerFeedback: string | null;
  demoFiles: CustomRequestFile[];
  finalFiles: CustomRequestFile[];
  customerName: string;
  customerEmail: string;
  customerPhone: string | null;
  createdAt: string;
}

const QUERY_KEY = ["admin", "custom-requests"] as const;

const formatVND = (n: number | null | undefined) =>
  n == null ? "—" : new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(n);

async function uploadFiles(files: File[]): Promise<CustomRequestFile[]> {
  if (files.length === 0) return [];
  const fd = new FormData();
  for (const f of files) fd.append("files", f);
  const res = await fetch("/api/upload", {
    method: "POST",
    body: fd,
    headers: { Authorization: `Bearer ${localStorage.getItem("auth_token") ?? ""}` },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? `Upload thất bại (HTTP ${res.status})`);
  }
  const data = (await res.json()) as { files: CustomRequestFile[] };
  return data.files;
}

export default function AdminCustomRequests() {
  const [, setLocation] = useLocation();
  const { data: user, isLoading: userLoading } = useGetCurrentUser();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tab, setTab] = useState<Status | "all">("pending");

  useEffect(() => {
    if (!userLoading && (!user || ((user as any).role !== "admin" && (user as any).role !== "staff"))) {
      setLocation("/login");
    }
  }, [user, userLoading, setLocation]);

  const { data: requests, isLoading } = useQuery<CustomRequestRow[]>({
    queryKey: QUERY_KEY,
    queryFn: () => customFetch<CustomRequestRow[]>("/api/admin/custom-requests"),
  });

  const refetch = () => queryClient.invalidateQueries({ queryKey: QUERY_KEY });
  const selected = useMemo(
    () => requests?.find((r) => r.requestId === selectedId) ?? null,
    [requests, selectedId],
  );

  if (!userLoading && (!user || ((user as any).role !== "admin" && (user as any).role !== "staff"))) return null;

  const filtered =
    tab === "all" ? requests ?? [] : (requests ?? []).filter((r) => r.status === tab);

  return (
    <AdminLayout
      title="Yêu cầu thiết kế"
      description={`${requests?.length ?? 0} yêu cầu`}
    >
      <Tabs value={tab} onValueChange={(v) => setTab(v as Status | "all")}>
        <div className="-mx-3 md:mx-0 mb-4 overflow-x-auto scrollbar-none">
          <TabsList className="mx-3 md:mx-0 inline-flex w-max md:w-auto md:flex-wrap h-auto p-1 gap-0.5">
            <TabsTrigger value="all" className="text-xs px-3 py-1.5 whitespace-nowrap">
              Tất cả{" "}
              <span className="ml-1 opacity-70">{requests?.length ?? 0}</span>
            </TabsTrigger>
            {STATUSES.map((s) => {
              const count = (requests ?? []).filter((r) => r.status === s).length;
              return (
                <TabsTrigger
                  key={s}
                  value={s}
                  className="text-xs px-3 py-1.5 whitespace-nowrap"
                >
                  {STATUS_VI[s]}
                  <span className="ml-1 opacity-70">{count}</span>
                </TabsTrigger>
              );
            })}
          </TabsList>
        </div>

        <TabsContent value={tab} className="mt-0">
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-24 rounded-2xl" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="bg-white rounded-2xl p-10 text-center text-muted-foreground border border-dashed border-border/60">
              Không có yêu cầu trong trạng thái này
            </div>
          ) : (
            <div className="grid gap-2.5 md:gap-3">
              {filtered.map((r) => (
                <button
                  key={r.id}
                  onClick={() => setSelectedId(r.requestId)}
                  className="bg-white rounded-2xl p-3 md:p-4 border border-border/40 hover:border-primary/40 hover:shadow-sm transition text-left active:scale-[0.99]"
                >
                  <div className="flex items-start gap-3 md:gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                        <span className="font-mono text-[11px] md:text-xs font-bold text-primary">
                          {r.requestId}
                        </span>
                        <Badge className={`${STATUS_COLORS[r.status]} text-[10px] md:text-xs`}>
                          {STATUS_VI[r.status]}
                        </Badge>
                      </div>
                      <p className="font-semibold text-sm truncate">{r.customerName}</p>
                      <p className="text-xs text-muted-foreground truncate mt-0.5">
                        {r.slideType} · {r.slideCount} slides · DL {r.deadline}
                      </p>
                      <p className="text-[11px] text-muted-foreground truncate mt-0.5 md:hidden">
                        {r.customerEmail}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-bold whitespace-nowrap">
                        {formatVND(r.quotedPrice)}
                      </p>
                      {r.depositAmount != null && (
                        <p className="text-[11px] text-muted-foreground whitespace-nowrap mt-0.5">
                          Cọc {formatVND(r.depositAmount)}
                          {r.depositPaidAt && " ✓"}
                        </p>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {selected && (
        <RequestDialog
          request={selected}
          onClose={() => setSelectedId(null)}
          onChanged={refetch}
          toast={toast}
        />
      )}
    </AdminLayout>
  );
}

interface DialogProps {
  request: CustomRequestRow;
  onClose: () => void;
  onChanged: () => void;
  toast: ReturnType<typeof useToast>["toast"];
}

function RequestDialog({ request, onClose, onChanged, toast }: DialogProps) {
  const { data: currentUser } = useGetCurrentUser();
  const viewerRole = (currentUser as any)?.role === "admin" ? "admin" : "staff";
  const [quotedPrice, setQuotedPrice] = useState<string>(
    request.quotedPrice != null ? String(request.quotedPrice) : "",
  );
  const [depositAmount, setDepositAmount] = useState<string>(
    request.depositAmount != null ? String(request.depositAmount) : "",
  );
  const [quoteMessage, setQuoteMessage] = useState<string>(request.quoteMessage ?? "");
  const [demoUploading, setDemoUploading] = useState(false);
  const [finalUploading, setFinalUploading] = useState(false);

  const quoteMutation = useMutation({
    mutationFn: () =>
      customFetch(`/api/admin/custom-requests/${request.requestId}/quote`, {
        method: "POST",
        body: JSON.stringify({
          quotedPrice: Number(quotedPrice),
          depositAmount: Number(depositAmount),
          quoteMessage: quoteMessage.trim() || null,
        }),
      }),
    onSuccess: () => {
      toast({ title: "Đã gửi báo giá" });
      onChanged();
      onClose();
    },
    onError: (e: any) =>
      toast({ title: "Lỗi", description: e?.message ?? "Không thể báo giá", variant: "destructive" }),
  });

  const startWorkMutation = useMutation({
    mutationFn: () =>
      customFetch(`/api/admin/custom-requests/${request.requestId}/start-work`, { method: "POST" }),
    onSuccess: () => {
      toast({ title: "Đã chuyển sang Đang làm" });
      onChanged();
      onClose();
    },
    onError: (e: any) => toast({ title: "Lỗi", description: e?.message, variant: "destructive" }),
  });

  const notifyDoneMutation = useMutation({
    mutationFn: () =>
      customFetch(`/api/admin/custom-requests/${request.requestId}/notify-done`, { method: "POST" }),
    onSuccess: () => {
      toast({ title: "Đã thông báo khách — chờ thanh toán cuối" });
      onChanged();
      onClose();
    },
    onError: (e: any) => toast({ title: "Lỗi", description: e?.message, variant: "destructive" }),
  });

  const uploadDemoMutation = useMutation({
    mutationFn: async (files: File[]) => {
      setDemoUploading(true);
      try {
        const uploaded = await uploadFiles(files);
        return customFetch(`/api/admin/custom-requests/${request.requestId}/upload-demo`, {
          method: "POST",
          body: JSON.stringify({ files: uploaded }),
        });
      } finally {
        setDemoUploading(false);
      }
    },
    onSuccess: () => {
      toast({ title: "Đã gửi demo cho khách" });
      onChanged();
      onClose();
    },
    onError: (e: any) => toast({ title: "Lỗi", description: e?.message, variant: "destructive" }),
  });

  const uploadFinalMutation = useMutation({
    mutationFn: async (files: File[]) => {
      setFinalUploading(true);
      try {
        const uploaded = await uploadFiles(files);
        return customFetch(`/api/admin/custom-requests/${request.requestId}/upload-final`, {
          method: "POST",
          body: JSON.stringify({ files: uploaded }),
        });
      } finally {
        setFinalUploading(false);
      }
    },
    onSuccess: () => {
      toast({ title: "Đã giao bài cuối" });
      onChanged();
      onClose();
    },
    onError: (e: any) => toast({ title: "Lỗi", description: e?.message, variant: "destructive" }),
  });

  const syncMutation = useMutation({
    mutationFn: () =>
      customFetch<{ syncResults: { orderId: number; synced: boolean; kind: "deposit" | "final" }[] }>(
        `/api/admin/custom-requests/${request.requestId}/sync-payment`,
        { method: "POST" },
      ),
    onSuccess: (resp) => {
      const synced = resp.syncResults.filter((r) => r.synced);
      if (synced.length > 0) {
        toast({
          title: "Đã đồng bộ thanh toán",
          description: synced.map((s) => `${s.kind === "deposit" ? "Cọc" : "Cuối"} order #${s.orderId}`).join(", "),
        });
      } else {
        toast({ title: "Không có gì để đồng bộ", description: "Trạng thái đã đúng." });
      }
      onChanged();
    },
    onError: (e: any) => toast({ title: "Lỗi", description: e?.message, variant: "destructive" }),
  });

  const handleFileInput = (cb: (files: File[]) => void) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length > 0) cb(files);
    e.target.value = "";
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs font-bold text-primary">{request.requestId}</span>
            <Badge className={STATUS_COLORS[request.status]}>{STATUS_VI[request.status]}</Badge>
          </div>
          <DialogTitle className="text-xl">{request.customerName}</DialogTitle>
          <DialogDescription>
            {request.customerEmail}
            {request.customerPhone && ` · ${request.customerPhone}`}
          </DialogDescription>
        </DialogHeader>

        <section className="text-sm space-y-1.5 bg-slate-50 rounded-lg p-3">
          <p>
            <strong>Loại slide:</strong> {request.slideType} · <strong>Số lượng:</strong> {request.slideCount}
          </p>
          <p>
            <strong>Deadline:</strong> {request.deadline} · <strong>Tỷ lệ:</strong> {request.aspectRatio}
          </p>
          {request.style && <p><strong>Phong cách:</strong> {request.style}</p>}
          {request.objective && <p><strong>Mục tiêu:</strong> {request.objective}</p>}
          {request.targetAudience && <p><strong>Đối tượng:</strong> {request.targetAudience}</p>}
          {request.notes && <p><strong>Ghi chú khách:</strong> {request.notes}</p>}
          {request.budget && <p><strong>Ngân sách:</strong> {request.budget}</p>}
          {request.attachments.length > 0 && (
            <div>
              <strong>File đính kèm khách gửi:</strong>{" "}
              {request.attachments.map((f, i) => (
                <a key={i} href={f.url} target="_blank" rel="noreferrer" className="text-primary underline mr-2">
                  {f.name}
                </a>
              ))}
            </div>
          )}
        </section>

        {request.status === "pending" && (
          <section className="space-y-3 border-t pt-4">
            <h3 className="font-semibold">Báo giá cho khách</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Giá báo (VND)</Label>
                <Input
                  type="number"
                  value={quotedPrice}
                  onChange={(e) => setQuotedPrice(e.target.value)}
                  placeholder="ví dụ 5000000"
                />
              </div>
              <div>
                <Label>Tiền cọc (VND)</Label>
                <Input
                  type="number"
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                  placeholder="ví dụ 1500000"
                />
              </div>
            </div>
            <div>
              <Label>Lời nhắn cho khách</Label>
              <Textarea
                value={quoteMessage}
                onChange={(e) => setQuoteMessage(e.target.value)}
                placeholder="Mô tả phạm vi công việc, thời gian giao bài..."
                rows={3}
              />
            </div>
            <Button
              onClick={() => quoteMutation.mutate()}
              disabled={!quotedPrice || !depositAmount || quoteMutation.isPending}
              className="w-full"
            >
              {quoteMutation.isPending ? "Đang gửi..." : "Gửi báo giá"}
            </Button>
          </section>
        )}

        {request.status === "quoted" && (
          <section className="border-t pt-4 space-y-2 text-sm">
            <h3 className="font-semibold">Đã báo giá — chờ khách trả cọc</h3>
            <p>Tổng: <strong>{formatVND(request.quotedPrice)}</strong></p>
            <p>Cọc: <strong>{formatVND(request.depositAmount)}</strong></p>
            <p>Còn lại: <strong>{formatVND(request.finalAmount)}</strong></p>
            {request.quoteMessage && <p className="text-muted-foreground">"{request.quoteMessage}"</p>}
          </section>
        )}

        {request.status === "deposit-paid" && (
          <section className="border-t pt-4 space-y-3">
            <p className="text-sm">
              Khách đã thanh toán cọc <strong>{formatVND(request.depositAmount)}</strong>. Bắt đầu xây bài.
            </p>
            <Button
              onClick={() => startWorkMutation.mutate()}
              disabled={startWorkMutation.isPending}
              className="w-full"
            >
              {startWorkMutation.isPending ? "..." : "Bắt đầu xây bài"}
            </Button>
          </section>
        )}

        {(request.status === "in-progress" || request.status === "review") && (
          <section className="border-t pt-4 space-y-3">
            <h3 className="font-semibold">Gửi bài demo cho khách</h3>
            {request.demoFiles.length > 0 && (
              <div className="text-sm space-y-1">
                <p className="text-xs text-muted-foreground">Đã gửi:</p>
                {request.demoFiles.map((f, i) => (
                  <a key={i} href={f.url} target="_blank" rel="noreferrer" className="block text-primary underline">
                    {f.name}
                  </a>
                ))}
              </div>
            )}
            <input
              type="file"
              multiple
              onChange={handleFileInput((files) => uploadDemoMutation.mutate(files))}
              className="block text-sm"
              disabled={demoUploading}
            />
            {demoUploading && <p className="text-xs text-muted-foreground">Đang upload...</p>}
            <p className="text-xs text-muted-foreground">
              Sau khi upload, status chuyển sang "Chờ khách duyệt".
            </p>
          </section>
        )}

        {request.status === "review" && request.customerFeedback && (
          <section className="border-t pt-4 text-sm">
            <p className="font-semibold mb-1">Phản hồi của khách:</p>
            <p className="text-muted-foreground">"{request.customerFeedback}"</p>
          </section>
        )}

        {request.status === "finalizing" && (
          <section className="border-t pt-4 space-y-3">
            <h3 className="font-semibold">Hoàn thiện bài cuối</h3>
            <p className="text-sm text-muted-foreground">
              Khách đã duyệt demo. Khi bạn hoàn thiện và đóng gói xong, bấm nút bên dưới để báo khách thanh toán phần còn lại.
            </p>
            {request.customerFeedback && (
              <div className="text-sm bg-slate-50 rounded-lg p-3">
                <p className="font-semibold mb-1 text-xs uppercase tracking-wider text-slate-500">
                  Phản hồi của khách khi duyệt
                </p>
                <p className="text-slate-700">"{request.customerFeedback}"</p>
              </div>
            )}
            <Button
              className="w-full"
              onClick={() => notifyDoneMutation.mutate()}
              disabled={notifyDoneMutation.isPending}
            >
              {notifyDoneMutation.isPending
                ? "..."
                : `Báo đã xong & yêu cầu thanh toán ${formatVND(request.finalAmount)}`}
            </Button>
          </section>
        )}

        {request.status === "final-payment" && (
          <section className="border-t pt-4 space-y-3">
            <h3 className="font-semibold">Thanh toán cuối</h3>
            <p className="text-sm">
              Khách đã duyệt demo. Cần thanh toán phần còn lại{" "}
              <strong>{formatVND(request.finalAmount)}</strong>.
            </p>
            {request.finalPaidAt ? (
              <>
                <p className="text-sm text-emerald-600">✓ Đã nhận đủ tiền — gửi bài cuối:</p>
                <input
                  type="file"
                  multiple
                  onChange={handleFileInput((files) => uploadFinalMutation.mutate(files))}
                  className="block text-sm"
                  disabled={finalUploading}
                />
                {finalUploading && <p className="text-xs text-muted-foreground">Đang upload...</p>}
              </>
            ) : (
              <p className="text-sm text-muted-foreground">⏳ Đang chờ khách thanh toán phần cuối...</p>
            )}
            {request.customerFeedback && (
              <div className="text-sm">
                <p className="font-semibold">Phản hồi khách:</p>
                <p className="text-muted-foreground">"{request.customerFeedback}"</p>
              </div>
            )}
          </section>
        )}

        {request.status === "delivered" && (
          <section className="border-t pt-4 space-y-2 text-sm">
            <h3 className="font-semibold text-emerald-700">Đã giao hàng</h3>
            {request.finalFiles.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">File cuối đã gửi khách:</p>
                {request.finalFiles.map((f, i) => (
                  <a key={i} href={f.url} target="_blank" rel="noreferrer" className="block text-primary underline">
                    {f.name}
                  </a>
                ))}
              </div>
            )}
          </section>
        )}

        {(request.status === "in-progress" ||
          request.status === "review" ||
          request.status === "finalizing" ||
          request.status === "final-payment" ||
          request.status === "delivered") && (
          <section className="border-t pt-4 space-y-2">
            <h3 className="font-semibold">Trao đổi với khách</h3>
            <CustomRequestChat
              requestId={request.requestId}
              status={request.status}
              viewerRole={viewerRole}
              compact
            />
          </section>
        )}

        <DialogFooter className="gap-2 sm:justify-between">
          {(request.depositOrderId || request.finalOrderId) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => syncMutation.mutate()}
              disabled={syncMutation.isPending}
              title="Khôi phục trạng thái nếu SePay đã nhận tiền nhưng chưa cập nhật"
            >
              {syncMutation.isPending ? "Đang đồng bộ..." : "🔄 Đồng bộ thanh toán"}
            </Button>
          )}
          <Button variant="outline" onClick={onClose}>
            Đóng
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
