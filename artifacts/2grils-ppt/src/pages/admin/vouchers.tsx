import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import {
  useListVouchers,
  useCreateVoucher,
  getListVouchersQueryKey,
  useGetCurrentUser,
  customFetch,
} from "@workspace/api-client-react";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { AdminLayout } from "./index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, Pencil } from "lucide-react";

interface VoucherRow {
  id: number;
  code: string;
  discountType: "percentage" | "fixed";
  discountValue: number;
  minOrderAmount: number | null;
  expiresAt: string | null;
  usageLimit: number;
  usageCount: number;
  isActive: boolean;
  applicableCategory: string | null;
}

export default function AdminVouchers() {
  const [, setLocation] = useLocation();
  const { data: user, isLoading: userLoading } = useGetCurrentUser();
  const { data: vouchers, isLoading } = useListVouchers();
  const createVoucher = useCreateVoucher();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<VoucherRow | null>(null);

  const [form, setForm] = useState({ code: "", discountType: "percentage", discountValue: "", usageLimit: "100" });
  const set = (k: keyof typeof form, v: string) => setForm(f => ({ ...f, [k]: v }));

  useEffect(() => {
    if (!userLoading && (!user || (user as any).role !== "admin")) setLocation("/login");
  }, [user, userLoading, setLocation]);

  const refetch = () => queryClient.invalidateQueries({ queryKey: getListVouchersQueryKey() });

  const patchMutation = useMutation({
    mutationFn: (vars: { id: number; data: Record<string, unknown> }) =>
      customFetch(`/api/admin/vouchers/${vars.id}`, {
        method: "PATCH",
        body: JSON.stringify(vars.data),
      }),
    onSuccess: () => {
      refetch();
      toast({ title: "Đã cập nhật voucher" });
    },
    onError: (e: any) => toast({ title: "Lỗi", description: e?.message, variant: "destructive" }),
  });

  if (!userLoading && (!user || (user as any).role !== "admin")) return null;

  const handleCreate = () => {
    createVoucher.mutate({ data: { code: form.code, discountType: form.discountType as any, discountValue: Number(form.discountValue), usageLimit: Number(form.usageLimit) } } as any, {
      onSuccess: () => {
        refetch();
        toast({ title: "Tạo voucher thành công!" });
        setOpen(false);
        setForm({ code: "", discountType: "percentage", discountValue: "", usageLimit: "100" });
      },
      onError: () => toast({ title: "Lỗi tạo voucher", variant: "destructive" }),
    });
  };

  const vouchersList = (vouchers as VoucherRow[] | undefined) ?? [];
  const createTrigger = (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="brand-gradient border-none gap-1.5 h-9 px-2 sm:px-3">
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline text-xs">Tạo voucher</span>
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Tạo Voucher mới</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          <div>
            <Label>Mã voucher</Label>
            <Input
              className="mt-1.5 uppercase"
              placeholder="WELCOME20"
              value={form.code}
              onChange={(e) => set("code", e.target.value.toUpperCase())}
            />
          </div>
          <div>
            <Label>Loại giảm giá</Label>
            <Select value={form.discountType} onValueChange={(v) => set("discountType", v)}>
              <SelectTrigger className="mt-1.5">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="percentage">Phần trăm (%)</SelectItem>
                <SelectItem value="fixed">Cố định (VND)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Giá trị giảm</Label>
            <Input
              className="mt-1.5"
              type="number"
              placeholder={form.discountType === "percentage" ? "20" : "50000"}
              value={form.discountValue}
              onChange={(e) => set("discountValue", e.target.value)}
            />
          </div>
          <div>
            <Label>Giới hạn sử dụng</Label>
            <Input
              className="mt-1.5"
              type="number"
              value={form.usageLimit}
              onChange={(e) => set("usageLimit", e.target.value)}
            />
          </div>
          <Button
            className="w-full brand-gradient border-none"
            onClick={handleCreate}
            disabled={createVoucher.isPending}
          >
            {createVoucher.isPending ? "Đang tạo..." : "Tạo voucher"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );

  return (
    <AdminLayout title="Quản lý Voucher" actions={createTrigger}>
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 rounded-2xl" />
          ))}
        </div>
      ) : vouchersList.length === 0 ? (
        <div className="bg-white rounded-2xl p-10 text-center text-muted-foreground border border-dashed border-border/60">
          Chưa có voucher nào
        </div>
      ) : (
        <>
          {/* Mobile cards */}
          <div className="md:hidden space-y-2.5">
            {vouchersList.map((v) => (
              <div key={v.id} className="bg-white rounded-2xl border border-border/50 p-3">
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono font-bold text-primary text-sm">{v.code}</span>
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                          v.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"
                        }`}
                      >
                        {v.isActive ? "Hoạt động" : "Tạm dừng"}
                      </span>
                    </div>
                    <p className="text-sm font-semibold mt-1">
                      Giảm{" "}
                      {v.discountType === "percentage"
                        ? `${v.discountValue}%`
                        : `${v.discountValue.toLocaleString("vi-VN")}đ`}
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Đã dùng {v.usageCount}/{v.usageLimit} · Hết hạn{" "}
                      {v.expiresAt
                        ? new Date(v.expiresAt).toLocaleDateString("vi-VN")
                        : "không giới hạn"}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                    <Switch
                      checked={v.isActive}
                      disabled={patchMutation.isPending}
                      onCheckedChange={(checked) =>
                        patchMutation.mutate({ id: v.id, data: { isActive: checked } })
                      }
                    />
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8"
                      onClick={() => setEditing(v)}
                      aria-label="Sửa"
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop table */}
          <div className="hidden md:block bg-white rounded-2xl border border-border/50 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b">
                <tr>
                  {["Mã", "Loại", "Giá trị", "Đã dùng / Giới hạn", "Trạng thái", "Hết hạn", "Hành động"].map((h) => (
                    <th key={h} className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {vouchersList.map((v) => (
                  <tr key={v.id} className="border-b last:border-0 hover:bg-slate-50">
                    <td className="px-4 py-3 font-mono font-bold text-primary">{v.code}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {v.discountType === "percentage" ? "%" : "Cố định"}
                    </td>
                    <td className="px-4 py-3 font-semibold">
                      {v.discountType === "percentage"
                        ? `${v.discountValue}%`
                        : `${v.discountValue.toLocaleString("vi-VN")}đ`}
                    </td>
                    <td className="px-4 py-3">{v.usageCount} / {v.usageLimit}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={v.isActive}
                          disabled={patchMutation.isPending}
                          onCheckedChange={(checked) =>
                            patchMutation.mutate({ id: v.id, data: { isActive: checked } })
                          }
                        />
                        <span className={`text-xs ${v.isActive ? "text-green-700" : "text-gray-500"}`}>
                          {v.isActive ? "Hoạt động" : "Tạm dừng"}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {v.expiresAt ? new Date(v.expiresAt).toLocaleDateString("vi-VN") : "Không giới hạn"}
                    </td>
                    <td className="px-4 py-3">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2"
                        onClick={() => setEditing(v)}
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {editing && (
        <EditVoucherDialog
          voucher={editing}
          onClose={() => setEditing(null)}
          onSave={(data) =>
            patchMutation.mutate(
              { id: editing.id, data },
              { onSuccess: () => setEditing(null) },
            )
          }
          saving={patchMutation.isPending}
        />
      )}
    </AdminLayout>
  );
}

interface EditVoucherDialogProps {
  voucher: VoucherRow;
  onClose: () => void;
  onSave: (data: Record<string, unknown>) => void;
  saving: boolean;
}

function EditVoucherDialog({ voucher, onClose, onSave, saving }: EditVoucherDialogProps) {
  const initialDate = voucher.expiresAt ? voucher.expiresAt.slice(0, 10) : "";
  const [expiresAt, setExpiresAt] = useState(initialDate);
  const [discountValue, setDiscountValue] = useState(String(voucher.discountValue));
  const [usageLimit, setUsageLimit] = useState(String(voucher.usageLimit));

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Chỉnh sửa {voucher.code}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          <div>
            <Label>Hạn sử dụng</Label>
            <Input
              type="date"
              className="mt-1.5"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
            />
            <p className="text-xs text-muted-foreground mt-1">Để trống nếu không giới hạn</p>
          </div>
          <div>
            <Label>Giá trị giảm</Label>
            <Input
              type="number"
              className="mt-1.5"
              value={discountValue}
              onChange={(e) => setDiscountValue(e.target.value)}
            />
          </div>
          <div>
            <Label>Giới hạn sử dụng</Label>
            <Input
              type="number"
              className="mt-1.5"
              value={usageLimit}
              onChange={(e) => setUsageLimit(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Hủy</Button>
          <Button
            disabled={saving}
            onClick={() =>
              onSave({
                expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
                discountValue: Number(discountValue),
                usageLimit: Number(usageLimit),
              })
            }
          >
            {saving ? "Đang lưu..." : "Lưu"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
