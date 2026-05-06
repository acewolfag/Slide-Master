import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useListVouchers, useCreateVoucher, getListVouchersQueryKey, useGetCurrentUser } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { AdminNav } from "./index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus } from "lucide-react";

export default function AdminVouchers() {
  const [, setLocation] = useLocation();
  const { data: user, isLoading: userLoading } = useGetCurrentUser();
  const { data: vouchers, isLoading } = useListVouchers();
  const createVoucher = useCreateVoucher();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);

  const [form, setForm] = useState({ code: "", discountType: "percentage", discountValue: "", usageLimit: "100" });
  const set = (k: keyof typeof form, v: string) => setForm(f => ({ ...f, [k]: v }));

  useEffect(() => {
    if (!userLoading && (!user || (user as any).role !== "admin")) setLocation("/login");
  }, [user, userLoading, setLocation]);

  if (!userLoading && (!user || (user as any).role !== "admin")) return null;

  const handleCreate = () => {
    createVoucher.mutate({ data: { code: form.code, discountType: form.discountType as any, discountValue: Number(form.discountValue), usageLimit: Number(form.usageLimit) } } as any, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListVouchersQueryKey() });
        toast({ title: "Tạo voucher thành công!" });
        setOpen(false);
        setForm({ code: "", discountType: "percentage", discountValue: "", usageLimit: "100" });
      },
      onError: () => toast({ title: "Lỗi tạo voucher", variant: "destructive" }),
    });
  };

  return (
    <div className="flex min-h-screen bg-slate-50">
      <AdminNav />
      <main className="flex-1 p-8 overflow-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-extrabold">Quản lý Voucher</h1>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="brand-gradient border-none gap-2"><Plus className="w-4 h-4" /> Tạo voucher</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Tạo Voucher mới</DialogTitle></DialogHeader>
              <div className="space-y-4 mt-2">
                <div><Label>Mã voucher</Label>
                  <Input className="mt-1.5 uppercase" placeholder="WELCOME20" value={form.code} onChange={e => set("code", e.target.value.toUpperCase())} /></div>
                <div><Label>Loại giảm giá</Label>
                  <Select value={form.discountType} onValueChange={v => set("discountType", v)}>
                    <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="percentage">Phần trăm (%)</SelectItem>
                      <SelectItem value="fixed">Cố định (VND)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Giá trị giảm</Label>
                  <Input className="mt-1.5" type="number" placeholder={form.discountType === "percentage" ? "20" : "50000"} value={form.discountValue} onChange={e => set("discountValue", e.target.value)} /></div>
                <div><Label>Giới hạn sử dụng</Label>
                  <Input className="mt-1.5" type="number" value={form.usageLimit} onChange={e => set("usageLimit", e.target.value)} /></div>
                <Button className="w-full brand-gradient border-none" onClick={handleCreate} disabled={createVoucher.isPending}>
                  {createVoucher.isPending ? "Đang tạo..." : "Tạo voucher"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {isLoading ? <Skeleton className="w-full h-64 rounded-xl" /> : (
          <div className="bg-white rounded-xl border border-border/50 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b">
                <tr>
                  {["Mã", "Loại", "Giá trị", "Đã dùng / Giới hạn", "Trạng thái", "Hết hạn"].map(h => (
                    <th key={h} className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(vouchers as any[])?.map(v => (
                  <tr key={v.id} className="border-b last:border-0 hover:bg-slate-50">
                    <td className="px-4 py-3 font-mono font-bold text-primary">{v.code}</td>
                    <td className="px-4 py-3 text-muted-foreground">{v.discountType === "percentage" ? "%" : "Cố định"}</td>
                    <td className="px-4 py-3 font-semibold">{v.discountType === "percentage" ? `${v.discountValue}%` : `${v.discountValue.toLocaleString("vi-VN")}đ`}</td>
                    <td className="px-4 py-3">{v.usageCount} / {v.usageLimit}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${v.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"}`}>
                        {v.isActive ? "Hoạt động" : "Tắt"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{v.expiresAt ? new Date(v.expiresAt).toLocaleDateString("vi-VN") : "Không giới hạn"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}
