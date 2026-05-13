import { useState } from "react";
import { useRoute, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
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
  pending: "Đang chờ phản hồi",
  quoted: "Đã có báo giá",
  "deposit-paid": "Đã đặt cọc",
  "in-progress": "Đang thực hiện",
  review: "Bài demo sẵn sàng",
  finalizing: "Đang hoàn thiện",
  "final-payment": "Thanh toán cuối",
  delivered: "Hoàn thành",
};

const STATUS_DESC: Record<Status, string> = {
  pending: "Chúng tôi sẽ phản hồi và báo giá sớm nhất qua email.",
  quoted: "Vui lòng kiểm tra báo giá và đặt cọc để chúng tôi bắt đầu.",
  "deposit-paid": "Đã nhận cọc — chúng tôi sẽ bắt đầu thiết kế.",
  "in-progress": "Đội ngũ đang thực hiện. Bạn sẽ nhận được bài demo khi hoàn tất.",
  review: "Bài demo đã sẵn sàng. Vui lòng xem và phản hồi.",
  finalizing: "Bạn đã duyệt demo. Đội ngũ đang hoàn thiện bài, sẽ báo khi xong để bạn thanh toán phần còn lại.",
  "final-payment": "Bài đã hoàn thiện. Vui lòng thanh toán phần còn lại để nhận bài cuối.",
  delivered: "Bài cuối đã sẵn sàng để tải về.",
};

interface CustomRequestFile {
  name: string;
  url: string;
  type: string;
  size?: number;
}

interface RequestDetail {
  id: number;
  requestId: string;
  status: Status;
  slideType: string;
  slideCount: number;
  deadline: string;
  customerName: string;
  customerEmail: string;
  quotedPrice: number | null;
  depositAmount: number | null;
  finalAmount: number | null;
  depositPaidAt: string | null;
  finalPaidAt: string | null;
  quoteMessage: string | null;
  customerFeedback: string | null;
  demoFiles: CustomRequestFile[];
  finalFiles: CustomRequestFile[];
  attachments: CustomRequestFile[];
}

interface PayResponse {
  orderId: number;
  total: number;
  qrCode: string;
  transferContent: string;
  expiresAt: string | null;
}

const formatVND = (n: number | null | undefined) =>
  n == null ? "—" : new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(n);

export default function CustomRequestDetail() {
  const [, params] = useRoute<{ id: string }>("/custom-requests/:id");
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const requestId = params?.id;

  const [feedback, setFeedback] = useState("");
  const [paymentInfo, setPaymentInfo] = useState<{ kind: "deposit" | "final"; data: PayResponse } | null>(null);

  const { data, isLoading } = useQuery<RequestDetail>({
    queryKey: ["custom-request", requestId],
    queryFn: () => customFetch<RequestDetail>(`/api/custom-requests/${requestId}`),
    enabled: !!requestId,
    refetchInterval: paymentInfo ? 5000 : false,
  });

  const refetch = () => queryClient.invalidateQueries({ queryKey: ["custom-request", requestId] });

  const payDepositMutation = useMutation({
    mutationFn: () =>
      customFetch<PayResponse>(`/api/custom-requests/${requestId}/pay-deposit`, { method: "POST" }),
    onSuccess: (resp) => {
      setPaymentInfo({ kind: "deposit", data: resp });
      refetch();
    },
    onError: (e: any) =>
      toast({ title: "Lỗi", description: e?.message ?? "Không tạo được đơn cọc", variant: "destructive" }),
  });

  const approveDemoMutation = useMutation({
    mutationFn: () =>
      customFetch(`/api/custom-requests/${requestId}/approve-demo`, {
        method: "POST",
        body: JSON.stringify({ feedback: feedback.trim() || null }),
      }),
    onSuccess: () => {
      toast({ title: "Đã duyệt demo. Đội ngũ sẽ hoàn thiện và báo lại." });
      setFeedback("");
      refetch();
    },
    onError: (e: any) => toast({ title: "Lỗi", description: e?.message, variant: "destructive" }),
  });

  const rejectDemoMutation = useMutation({
    mutationFn: () =>
      customFetch(`/api/custom-requests/${requestId}/reject-demo`, {
        method: "POST",
        body: JSON.stringify({ feedback: feedback.trim() || null }),
      }),
    onSuccess: () => {
      toast({ title: "Đã từ chối demo", description: "Đội ngũ sẽ chỉnh sửa và gửi lại." });
      setFeedback("");
      refetch();
    },
    onError: (e: any) => toast({ title: "Lỗi", description: e?.message, variant: "destructive" }),
  });

  const payFinalMutation = useMutation({
    mutationFn: () =>
      customFetch<PayResponse>(`/api/custom-requests/${requestId}/pay-final`, { method: "POST" }),
    onSuccess: (resp) => {
      setPaymentInfo({ kind: "final", data: resp });
      refetch();
    },
    onError: (e: any) =>
      toast({ title: "Lỗi", description: e?.message ?? "Không tạo được đơn", variant: "destructive" }),
  });

  if (!requestId) {
    setLocation("/dashboard");
    return null;
  }

  if (isLoading || !data) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-12">
          <Skeleton className="w-full h-96 rounded-xl" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container mx-auto px-4 py-12 max-w-3xl space-y-6">
        <div>
          <p className="font-mono text-sm font-bold text-primary">{data.requestId}</p>
          <h1 className="text-3xl font-extrabold mt-1">{STATUS_VI[data.status]}</h1>
          <p className="text-muted-foreground mt-1">{STATUS_DESC[data.status]}</p>
        </div>

        <Card>
          <CardContent className="pt-6 space-y-2 text-sm">
            <p>
              <strong>Loại slide:</strong> {data.slideType} · {data.slideCount} slides
            </p>
            <p>
              <strong>Deadline:</strong> {data.deadline}
            </p>
            <p>
              <strong>Trạng thái:</strong>{" "}
              <Badge>{STATUS_VI[data.status]}</Badge>
            </p>
          </CardContent>
        </Card>

        {(data.status === "quoted" || data.status === "deposit-paid" ||
          data.status === "in-progress" || data.status === "review" ||
          data.status === "final-payment" || data.status === "delivered") && (
          <Card>
            <CardContent className="pt-6 space-y-2">
              <h3 className="font-semibold">Báo giá</h3>
              <div className="grid grid-cols-3 gap-3 text-sm">
                <div>
                  <p className="text-muted-foreground text-xs">Tổng</p>
                  <p className="font-bold">{formatVND(data.quotedPrice)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Cọc</p>
                  <p className="font-bold">
                    {formatVND(data.depositAmount)} {data.depositPaidAt && "✓"}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Còn lại</p>
                  <p className="font-bold">
                    {formatVND(data.finalAmount)} {data.finalPaidAt && "✓"}
                  </p>
                </div>
              </div>
              {data.quoteMessage && (
                <p className="text-sm text-muted-foreground italic mt-2">"{data.quoteMessage}"</p>
              )}
            </CardContent>
          </Card>
        )}

        {data.status === "quoted" && !paymentInfo && (
          <Button
            size="lg"
            className="w-full"
            onClick={() => payDepositMutation.mutate()}
            disabled={payDepositMutation.isPending}
          >
            {payDepositMutation.isPending ? "Đang tạo đơn..." : `Đặt cọc ${formatVND(data.depositAmount)}`}
          </Button>
        )}

        {(data.status === "in-progress" ||
          data.status === "review" ||
          data.status === "finalizing" ||
          data.status === "final-payment" ||
          data.status === "delivered") && (
          <div className="space-y-2">
            <h3 className="font-semibold text-base">Trao đổi với đội ngũ</h3>
            <CustomRequestChat
              requestId={data.requestId}
              status={data.status}
              viewerRole="customer"
            />
          </div>
        )}

        {data.status === "review" && data.demoFiles.length > 0 && (
          <Card>
            <CardContent className="pt-6 space-y-3">
              <h3 className="font-semibold">Bài demo</h3>
              <div className="space-y-1">
                {data.demoFiles.map((f, i) => (
                  <a
                    key={i}
                    href={f.url}
                    target="_blank"
                    rel="noreferrer"
                    className="block text-primary underline text-sm"
                  >
                    {f.name}
                  </a>
                ))}
              </div>
              <div>
                <Textarea
                  placeholder="Phản hồi của bạn (tùy chọn — nếu từ chối, hãy ghi rõ chỉnh sửa)..."
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  rows={3}
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="outline"
                  onClick={() => rejectDemoMutation.mutate()}
                  disabled={rejectDemoMutation.isPending || approveDemoMutation.isPending}
                  className="border-red-200 text-red-600 hover:bg-red-50"
                >
                  {rejectDemoMutation.isPending ? "..." : "Từ chối"}
                </Button>
                <Button
                  onClick={() => approveDemoMutation.mutate()}
                  disabled={approveDemoMutation.isPending || rejectDemoMutation.isPending}
                  className="brand-gradient border-none"
                >
                  {approveDemoMutation.isPending ? "..." : "Đồng ý"}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground text-center">
                Đồng ý: đội ngũ hoàn thiện rồi yêu cầu thanh toán cuối · Từ chối: trả lại để chỉnh sửa
              </p>
            </CardContent>
          </Card>
        )}

        {data.status === "finalizing" && (
          <Card>
            <CardContent className="pt-6 space-y-2">
              <h3 className="font-semibold">Đội ngũ đang hoàn thiện bài</h3>
              <p className="text-sm text-muted-foreground">
                Bạn đã duyệt demo. Chúng tôi đang chỉnh sửa và đóng gói bài cuối. Khi hoàn tất, hệ thống sẽ thông báo để bạn thanh toán phần còn lại.
              </p>
              {data.demoFiles.length > 0 && (
                <div className="pt-2">
                  <p className="text-xs text-muted-foreground mb-1">Bài demo đã duyệt:</p>
                  {data.demoFiles.map((f, i) => (
                    <a
                      key={i}
                      href={f.url}
                      target="_blank"
                      rel="noreferrer"
                      className="block text-primary underline text-sm"
                    >
                      {f.name}
                    </a>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {data.status === "final-payment" && !data.finalPaidAt && !paymentInfo && (
          <Button
            size="lg"
            className="w-full"
            onClick={() => payFinalMutation.mutate()}
            disabled={payFinalMutation.isPending}
          >
            {payFinalMutation.isPending ? "..." : `Thanh toán phần còn lại ${formatVND(data.finalAmount)}`}
          </Button>
        )}

        {data.status === "final-payment" && data.finalPaidAt && (
          <Card>
            <CardContent className="pt-6 text-sm text-muted-foreground">
              Đã nhận đủ tiền. Đội ngũ đang chuẩn bị file cuối cho bạn.
            </CardContent>
          </Card>
        )}

        {data.status === "delivered" && data.finalFiles.length > 0 && (
          <Card>
            <CardContent className="pt-6 space-y-3">
              <h3 className="font-semibold text-emerald-700">Bài cuối</h3>
              <div className="space-y-1">
                {data.finalFiles.map((f, i) => (
                  <a
                    key={i}
                    href={f.url}
                    target="_blank"
                    rel="noreferrer"
                    className="block text-primary underline text-sm"
                  >
                    {f.name}
                  </a>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {paymentInfo && (
          <Card className="border-primary">
            <CardContent className="pt-6 space-y-3 text-center">
              <h3 className="font-bold">
                Quét mã QR để thanh toán {paymentInfo.kind === "deposit" ? "cọc" : "phần cuối"}
              </h3>
              <img src={paymentInfo.data.qrCode} alt="QR" className="mx-auto max-w-xs rounded-lg" />
              <p className="text-sm">
                Số tiền: <strong>{formatVND(paymentInfo.data.total)}</strong>
              </p>
              <p className="text-sm">
                Nội dung CK: <code className="font-mono bg-slate-100 px-2 py-1 rounded">{paymentInfo.data.transferContent}</code>
              </p>
              <p className="text-xs text-muted-foreground">
                Trang này sẽ tự động cập nhật khi nhận được thanh toán (~5 giây/lần).
              </p>
              <Button variant="ghost" size="sm" onClick={() => setPaymentInfo(null)}>
                Đóng QR
              </Button>
            </CardContent>
          </Card>
        )}

        <div>
          <Button variant="outline" onClick={() => setLocation("/dashboard")}>
            ← Về Dashboard
          </Button>
        </div>
      </div>
    </Layout>
  );
}
