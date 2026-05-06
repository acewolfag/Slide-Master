import { Layout } from "@/components/layout";
import { useLocation, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { useGetCart, useCreateOrder, useGetCurrentUser, getGetCartQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState, useEffect } from "react";
import { AlertCircle, Lock } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function Checkout() {
  const [location, setLocation] = useLocation();
  const { data: cart, isLoading: cartLoading } = useGetCart();
  const { data: user } = useGetCurrentUser();
  const createOrder = useCreateOrder();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState({
    customerName: "",
    customerEmail: "",
    customerPhone: ""
  });

  // Pre-fill if user is logged in
  useEffect(() => {
    if (user && !formData.customerEmail) {
      setFormData({
        customerName: user.name || "",
        customerEmail: user.email || "",
        customerPhone: ""
      });
    }
  }, [user]);

  // Redirect if empty cart
  useEffect(() => {
    if (!cartLoading && (!cart || cart.items.length === 0)) {
      setLocation("/cart");
    }
  }, [cart, cartLoading, setLocation]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.customerName || !formData.customerEmail) {
      toast({ title: "Vui lòng điền đầy đủ thông tin bắt buộc", variant: "destructive" });
      return;
    }

    createOrder.mutate({ 
      data: { 
        ...formData,
        voucherCode: cart?.appliedVoucher || undefined
      } 
    }, {
      onSuccess: (order) => {
        queryClient.invalidateQueries({ queryKey: getGetCartQueryKey() });
        // Will go to order success/payment page
        setLocation(`/order-success/${order.id}`);
      },
      onError: (err) => {
        toast({ title: "Có lỗi xảy ra khi tạo đơn hàng", variant: "destructive" });
      }
    });
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(price);
  };

  if (cartLoading) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-12 max-w-5xl">
          <Skeleton className="w-full h-96" />
        </div>
      </Layout>
    );
  }

  if (!cart || cart.items.length === 0) return null;

  return (
    <Layout>
      <div className="container mx-auto px-4 py-12 max-w-5xl">
        <h1 className="text-3xl font-bold mb-8 text-center">Thanh toán</h1>
        
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-12">
          
          {/* Form */}
          <div className="lg:col-span-3">
            <div className="bg-white rounded-2xl p-6 md:p-8 border border-slate-200 shadow-sm">
              <h2 className="text-xl font-bold mb-6">Thông tin nhận hàng</h2>
              
              {!user && (
                <Alert className="mb-6 bg-blue-50 text-blue-800 border-blue-200">
                  <AlertCircle className="h-4 w-4 text-blue-600" />
                  <AlertDescription>
                    Bạn đã có tài khoản? <Link href="/login?redirect=/checkout" className="font-semibold underline hover:text-blue-900">Đăng nhập</Link> để mua hàng nhanh hơn và quản lý template dễ dàng.
                  </AlertDescription>
                </Alert>
              )}

              <form id="checkout-form" onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="customerName">Họ và tên *</Label>
                  <Input 
                    id="customerName" 
                    name="customerName"
                    value={formData.customerName}
                    onChange={handleChange}
                    required
                    placeholder="Nhập họ tên của bạn"
                    className="h-12"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="customerEmail">Email nhận template *</Label>
                  <Input 
                    id="customerEmail" 
                    name="customerEmail" 
                    type="email"
                    value={formData.customerEmail}
                    onChange={handleChange}
                    required
                    placeholder="Email để nhận file cài đặt"
                    className="h-12"
                  />
                  <p className="text-xs text-slate-500 mt-1">Đường dẫn tải template sẽ được gửi vào email này.</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="customerPhone">Số điện thoại</Label>
                  <Input 
                    id="customerPhone" 
                    name="customerPhone" 
                    type="tel"
                    value={formData.customerPhone}
                    onChange={handleChange}
                    placeholder="Tùy chọn"
                    className="h-12"
                  />
                </div>

                <div className="pt-6 border-t">
                  <h3 className="font-bold mb-4">Phương thức thanh toán</h3>
                  <div className="p-4 border-2 border-primary rounded-xl bg-primary/5 flex items-start gap-4">
                    <div className="mt-1">
                      <div className="w-5 h-5 rounded-full border-4 border-primary flex items-center justify-center">
                        <div className="w-2.5 h-2.5 bg-primary rounded-full"></div>
                      </div>
                    </div>
                    <div>
                      <p className="font-semibold">Chuyển khoản mã QR (VietQR)</p>
                      <p className="text-sm text-slate-600 mt-1">Quét mã QR trên ứng dụng ngân hàng. Hệ thống sẽ duyệt tự động trong 5-10 giây.</p>
                    </div>
                  </div>
                </div>
              </form>
            </div>
          </div>

          {/* Order Summary */}
          <div className="lg:col-span-2">
            <div className="bg-slate-50 rounded-2xl p-6 border border-slate-200 sticky top-24">
              <h2 className="text-xl font-bold mb-6">Đơn hàng của bạn</h2>
              
              <div className="space-y-4 mb-6 max-h-60 overflow-y-auto pr-2">
                {cart.items.map(item => (
                  <div key={item.templateId} className="flex gap-4">
                    <div className="w-16 h-12 bg-slate-200 rounded overflow-hidden flex-shrink-0">
                      <img src={item.thumbnailUrl} alt={item.titleVi} className="w-full h-full object-cover" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate" title={item.titleVi}>{item.titleVi}</p>
                      <p className="text-sm font-medium text-slate-600">{formatPrice(item.price)}</p>
                    </div>
                  </div>
                ))}
              </div>
              
              <div className="space-y-3 text-sm pt-4 border-t border-slate-200">
                <div className="flex justify-between">
                  <span className="text-slate-600">Tạm tính:</span>
                  <span className="font-medium">{formatPrice(cart.subtotal)}</span>
                </div>
                
                {cart.discount > 0 && (
                  <div className="flex justify-between text-primary">
                    <span>Giảm giá:</span>
                    <span className="font-medium">-{formatPrice(cart.discount)}</span>
                  </div>
                )}
                
                <div className="flex justify-between items-center pt-3 mt-3 border-t border-slate-200">
                  <span className="font-bold text-base">Tổng thanh toán:</span>
                  <span className="text-2xl font-bold text-primary">{formatPrice(cart.total)}</span>
                </div>
              </div>

              <div className="mt-8">
                <Button 
                  type="submit" 
                  form="checkout-form"
                  disabled={createOrder.isPending}
                  size="lg" 
                  className="w-full rounded-xl brand-gradient border-none h-14 text-base shadow-lg hover:shadow-xl transition-all"
                >
                  {createOrder.isPending ? "Đang xử lý..." : "Đặt hàng & Thanh toán"}
                </Button>
                <div className="flex items-center justify-center gap-2 mt-4 text-xs text-slate-500">
                  <Lock className="w-3 h-3" />
                  <span>Thông tin của bạn được bảo mật tuyệt đối</span>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </Layout>
  );
}
