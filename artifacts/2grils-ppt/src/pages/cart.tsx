import { Layout } from "@/components/layout";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Trash2, ArrowRight, ShoppingCart } from "lucide-react";
import { useGetCart, useRemoveFromCart, useApplyVoucher, getGetCartQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { useState } from "react";

export default function Cart() {
  const [_, setLocation] = useLocation();
  const { data: cart, isLoading } = useGetCart();
  const removeFromCart = useRemoveFromCart();
  const applyVoucher = useApplyVoucher();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  const [voucherCode, setVoucherCode] = useState("");

  const handleRemove = (templateId: number) => {
    removeFromCart.mutate({ data: { templateId } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetCartQueryKey() });
        toast({ title: "Đã xóa khỏi giỏ hàng" });
      }
    });
  };

  const handleApplyVoucher = (e: React.FormEvent) => {
    e.preventDefault();
    if (!voucherCode.trim()) return;
    
    applyVoucher.mutate({ data: { code: voucherCode } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetCartQueryKey() });
        toast({ title: "Áp dụng mã giảm giá thành công" });
      },
      onError: (err: any) => {
        toast({ title: "Mã giảm giá không hợp lệ", variant: "destructive" });
      }
    });
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(price);
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-12 max-w-5xl">
          <Skeleton className="w-48 h-10 mb-8" />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
            <div className="lg:col-span-2 space-y-6">
              {[1, 2].map(i => <Skeleton key={i} className="w-full h-32 rounded-xl" />)}
            </div>
            <Skeleton className="w-full h-80 rounded-xl" />
          </div>
        </div>
      </Layout>
    );
  }

  if (!cart || cart.items.length === 0) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-20 max-w-md text-center">
          <div className="w-24 h-24 mx-auto bg-slate-100 rounded-full flex items-center justify-center mb-6">
            <ShoppingCart className="w-10 h-10 text-slate-400" />
          </div>
          <h1 className="text-3xl font-bold mb-4">Giỏ hàng trống</h1>
          <p className="text-slate-600 mb-8">
            Bạn chưa thêm sản phẩm nào vào giỏ hàng. Hãy khám phá thư viện template của chúng tôi.
          </p>
          <Link href="/templates">
            <Button size="lg" className="rounded-full brand-gradient border-none px-8">
              Khám phá ngay
            </Button>
          </Link>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container mx-auto px-4 py-12 max-w-5xl">
        <h1 className="text-3xl font-bold mb-8">Giỏ hàng của bạn</h1>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
          {/* Cart Items */}
          <div className="lg:col-span-2 space-y-6">
            {cart.items.map(item => (
              <div key={item.templateId} className="flex flex-col sm:flex-row items-center gap-6 p-4 rounded-xl border border-slate-200 bg-white">
                <div className="w-full sm:w-32 aspect-[16/9] rounded-lg overflow-hidden flex-shrink-0 bg-slate-100">
                  <img src={item.thumbnailUrl} alt={item.titleVi} className="w-full h-full object-cover" />
                </div>
                <div className="flex-1 text-center sm:text-left">
                  <Link href={`/templates/${item.templateId}`}>
                    <h3 className="font-semibold text-lg hover:text-primary transition-colors cursor-pointer">{item.titleVi}</h3>
                  </Link>
                  <p className="text-sm text-slate-500 mt-1">Bản quyền sử dụng cá nhân</p>
                </div>
                <div className="flex flex-row sm:flex-col items-center justify-between sm:items-end w-full sm:w-auto gap-4 sm:gap-2">
                  <div className="font-bold text-lg">{formatPrice(item.price)}</div>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="text-slate-400 hover:text-destructive hover:bg-destructive/10"
                    onClick={() => handleRemove(item.templateId)}
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Xóa
                  </Button>
                </div>
              </div>
            ))}
          </div>

          {/* Summary */}
          <div className="lg:col-span-1">
            <div className="bg-slate-50 rounded-2xl p-6 border border-slate-200 sticky top-24">
              <h2 className="text-xl font-bold mb-6">Tổng đơn hàng</h2>
              
              <div className="space-y-4 text-sm mb-6">
                <div className="flex justify-between">
                  <span className="text-slate-600">Tạm tính ({cart.items.length} sản phẩm):</span>
                  <span className="font-medium">{formatPrice(cart.subtotal)}</span>
                </div>
                
                {cart.discount > 0 && (
                  <div className="flex justify-between text-primary">
                    <span>Giảm giá (Voucher):</span>
                    <span className="font-medium">-{formatPrice(cart.discount)}</span>
                  </div>
                )}
                
                <div className="pt-4 border-t border-slate-200">
                  <div className="flex justify-between items-end">
                    <span className="font-semibold text-base">Tổng cộng:</span>
                    <div className="text-right">
                      <span className="text-2xl font-bold text-primary">{formatPrice(cart.total)}</span>
                      <p className="text-xs text-slate-500 mt-1">Đã bao gồm VAT</p>
                    </div>
                  </div>
                </div>
              </div>

              <form onSubmit={handleApplyVoucher} className="flex gap-2 mb-8">
                <Input 
                  placeholder="Mã giảm giá" 
                  value={voucherCode}
                  onChange={(e) => setVoucherCode(e.target.value)}
                  className="bg-white"
                />
                <Button type="submit" variant="secondary" disabled={applyVoucher.isPending}>
                  Áp dụng
                </Button>
              </form>

              <Link href="/checkout">
                <Button size="lg" className="w-full rounded-xl brand-gradient border-none h-14 text-base shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 transition-all">
                  Tiến hành thanh toán
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
