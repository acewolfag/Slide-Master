import { Layout } from "@/components/layout";
import { useParams, Link } from "wouter";
import { useGetOrder, useGetOrderPaymentStatus, getGetOrderQueryKey } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Download, AlertCircle, Clock, Loader2, ArrowRight } from "lucide-react";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

export default function OrderSuccess() {
  const params = useParams();
  const orderId = Number(params.id);
  const queryClient = useQueryClient();
  
  const { data: order, isLoading } = useGetOrder(orderId, {
    query: { enabled: !!orderId, queryKey: getGetOrderQueryKey(orderId) }
  });

  const { data: paymentStatus } = useGetOrderPaymentStatus(orderId, {
    query: { 
      enabled: !!orderId && order?.status === 'pending',
      refetchInterval: (data) => {
        // Poll every 3 seconds if status is still pending
        if (!data) return 3000;
        return data.status === 'pending' ? 3000 : false;
      }
    }
  });

  const [timeLeft, setTimeLeft] = useState<number>(15 * 60); // 15 minutes in seconds

  useEffect(() => {
    // If payment succeeds, invalidate order query to get download links
    if (paymentStatus?.status === 'paid') {
      queryClient.invalidateQueries({ queryKey: getGetOrderQueryKey(orderId) });
    }
  }, [paymentStatus?.status, orderId, queryClient]);

  useEffect(() => {
    if (order?.status !== 'pending' || !order.createdAt) return;
    
    // Calculate actual time left based on order creation time
    const createdTime = new Date(order.createdAt).getTime();
    const expiryTime = createdTime + (15 * 60 * 1000);
    
    const timer = setInterval(() => {
      const now = new Date().getTime();
      const difference = Math.floor((expiryTime - now) / 1000);
      
      if (difference <= 0) {
        setTimeLeft(0);
        clearInterval(timer);
      } else {
        setTimeLeft(difference);
      }
    }, 1000);
    
    return () => clearInterval(timer);
  }, [order?.status, order?.createdAt]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(price);
  };

  const status = paymentStatus?.status || order?.status;

  if (isLoading) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-20 max-w-2xl text-center">
          <Skeleton className="w-32 h-32 rounded-full mx-auto mb-8" />
          <Skeleton className="w-2/3 h-10 mx-auto mb-4" />
          <Skeleton className="w-1/2 h-6 mx-auto mb-12" />
        </div>
      </Layout>
    );
  }

  if (!order) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-20 text-center">
          <h1 className="text-2xl font-bold mb-4">Không tìm thấy đơn hàng</h1>
          <Link href="/"><Button>Về trang chủ</Button></Link>
        </div>
      </Layout>
    );
  }

  const isPaid = status === 'paid';
  const isPending = status === 'pending';
  const isFailedOrExpired = status === 'failed' || status === 'expired' || (isPending && timeLeft <= 0);

  return (
    <Layout>
      <div className="container mx-auto px-4 py-16 max-w-3xl">
        
        {isPaid ? (
          // SUCCESS STATE
          <div className="bg-white rounded-3xl p-8 md:p-12 border border-slate-200 shadow-lg text-center">
            <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle2 className="w-12 h-12 text-primary" />
            </div>
            <h1 className="text-3xl font-bold mb-4">Thanh toán thành công!</h1>
            <p className="text-slate-600 mb-8 max-w-md mx-auto">
              Cảm ơn bạn đã mua hàng tại 2Grils.PPT. Hóa đơn và hướng dẫn cài đặt đã được gửi đến email <strong>{order.customerEmail}</strong>.
            </p>
            
            <div className="bg-slate-50 rounded-xl p-6 mb-8 text-left border border-slate-100">
              <h3 className="font-semibold mb-4 border-b pb-2">Tài liệu đã mua ({order.items.length})</h3>
              <div className="space-y-4">
                {order.items.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-8 bg-slate-200 rounded overflow-hidden">
                        <img src={item.thumbnailUrl} alt="" className="w-full h-full object-cover" />
                      </div>
                      <span className="font-medium">{item.titleVi}</span>
                    </div>
                    {order.downloadLinks?.[idx] && (
                      <Button size="sm" className="rounded-full" onClick={() => window.open(order.downloadLinks![idx], '_blank')}>
                        <Download className="w-4 h-4 mr-2" />
                        Tải xuống
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>
            
            <div className="flex flex-col sm:flex-row justify-center gap-4">
              <Link href="/dashboard">
                <Button variant="outline" className="w-full sm:w-auto">Đến Tủ đồ của tôi</Button>
              </Link>
              <Link href="/templates">
                <Button className="w-full sm:w-auto brand-gradient border-none">Tiếp tục mua sắm</Button>
              </Link>
            </div>
          </div>
        ) : isFailedOrExpired ? (
          // FAILED STATE
          <div className="bg-white rounded-3xl p-8 md:p-12 border border-slate-200 shadow-lg text-center">
            <div className="w-24 h-24 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <AlertCircle className="w-12 h-12 text-destructive" />
            </div>
            <h1 className="text-3xl font-bold mb-4">Giao dịch đã hết hạn</h1>
            <p className="text-slate-600 mb-8 max-w-md mx-auto">
              Đơn hàng của bạn đã bị hủy do quá thời gian thanh toán hoặc giao dịch thất bại. Vui lòng thử lại.
            </p>
            <Link href="/cart">
              <Button size="lg" className="rounded-full brand-gradient border-none">
                Quay lại giỏ hàng
              </Button>
            </Link>
          </div>
        ) : (
          // PENDING / PAYMENT STATE
          <div className="bg-white rounded-3xl overflow-hidden border border-slate-200 shadow-xl">
            <div className="brand-gradient p-8 text-white text-center">
              <h1 className="text-2xl font-bold mb-2">Thanh toán đơn hàng</h1>
              <p className="opacity-90">Mã đơn: #{order.id} &bull; Số tiền: {formatPrice(order.total)}</p>
            </div>
            
            <div className="p-8 md:p-12">
              <div className="flex flex-col md:flex-row gap-12 items-center justify-center">
                
                {/* QR Code Column */}
                <div className="flex-1 flex flex-col items-center max-w-sm">
                  <div className="mb-4 bg-yellow-50 text-yellow-800 px-4 py-2 rounded-full text-sm font-medium flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    Vui lòng thanh toán trong: <span className="font-bold text-lg tabular-nums">{formatTime(timeLeft)}</span>
                  </div>
                  
                  <div className="p-4 border-2 border-dashed border-slate-200 rounded-2xl w-64 h-64 flex items-center justify-center relative bg-white">
                    {order.qrCode ? (
                      <img src={order.qrCode} alt="VietQR" className="w-full h-full object-contain" />
                    ) : (
                      <div className="text-center text-slate-400">
                        <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2" />
                        <p>Đang tạo mã QR...</p>
                      </div>
                    )}
                  </div>
                  
                  <div className="mt-8 text-center space-y-2 text-sm text-slate-600">
                    <p>Sử dụng App ngân hàng để quét mã</p>
                    <p className="flex items-center justify-center gap-2 text-primary font-medium">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Đang chờ thanh toán...
                    </p>
                  </div>
                </div>
                
                {/* Manual Transfer Column */}
                <div className="flex-1 w-full max-w-sm">
                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-white px-2 text-muted-foreground">Hoặc chuyển khoản thủ công</span>
                    </div>
                  </div>
                  
                  <div className="mt-6 space-y-4">
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                      <p className="text-sm text-slate-500 mb-1">Ngân hàng</p>
                      <p className="font-semibold text-lg">Vietcombank</p>
                    </div>
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                      <p className="text-sm text-slate-500 mb-1">Chủ tài khoản</p>
                      <p className="font-semibold text-lg">2GRILS PPT CO LTD</p>
                    </div>
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                      <p className="text-sm text-slate-500 mb-1">Số tài khoản</p>
                      <p className="font-bold text-xl tracking-wider">1029384756</p>
                    </div>
                    <div className="bg-primary/5 p-4 rounded-xl border border-primary/20">
                      <p className="text-sm text-primary font-medium mb-1">Nội dung chuyển khoản (Bắt buộc)</p>
                      <p className="font-bold text-xl tracking-wider text-slate-900">{order.transferContent || `DH${order.id}`}</p>
                    </div>
                  </div>
                </div>
                
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
