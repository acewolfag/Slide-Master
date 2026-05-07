import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useListAdminPricing, useUpdateServicePlan, useGetCurrentUser } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { AdminNav } from "./index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Pencil, Save, X, Star } from "lucide-react";

type Plan = {
  id: number; name: string; nameEn: string; slides: string; price: number;
  deliveryDays: number; revisions: string; features: string[]; featuresEn: string[];
  isHighlight: boolean; isActive: boolean; sortOrder: number; updatedAt?: string;
};

function PricingCard({ plan, onSaved }: { plan: Plan; onSaved: () => void }) {
  const { toast } = useToast();
  const updatePlan = useUpdateServicePlan();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Plan>({ ...plan });

  const set = (k: keyof Plan, v: any) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = () => {
    updatePlan.mutate({
      id: plan.id,
      data: {
        name: form.name, nameEn: form.nameEn, slides: form.slides,
        price: Number(form.price), deliveryDays: Number(form.deliveryDays),
        revisions: form.revisions, features: form.features, featuresEn: form.featuresEn,
        isHighlight: form.isHighlight, isActive: form.isActive, sortOrder: form.sortOrder,
      },
    } as any, {
      onSuccess: () => {
        toast({ title: `Đã lưu gói "${form.name}"` });
        setEditing(false);
        onSaved();
      },
      onError: () => toast({ title: "Lỗi khi lưu", variant: "destructive" }),
    });
  };

  const handleCancel = () => { setForm({ ...plan }); setEditing(false); };

  return (
    <div className={`bg-white rounded-xl border p-6 ${plan.isHighlight ? "border-primary shadow-md shadow-primary/10" : "border-border/50"}`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <h3 className="font-bold text-lg">{plan.name}</h3>
          {plan.isHighlight && <Badge className="brand-gradient border-none text-white text-xs">Phổ biến nhất</Badge>}
          {!plan.isActive && <Badge variant="outline" className="text-xs text-muted-foreground">Ẩn</Badge>}
        </div>
        <div className="flex gap-2">
          {editing ? (
            <>
              <Button size="sm" className="brand-gradient border-none" onClick={handleSave} disabled={updatePlan.isPending}>
                <Save className="w-3.5 h-3.5 mr-1.5" /> {updatePlan.isPending ? "Đang lưu..." : "Lưu"}
              </Button>
              <Button size="sm" variant="outline" onClick={handleCancel}>
                <X className="w-3.5 h-3.5 mr-1.5" /> Hủy
              </Button>
            </>
          ) : (
            <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
              <Pencil className="w-3.5 h-3.5 mr-1.5" /> Chỉnh sửa
            </Button>
          )}
        </div>
      </div>

      {editing ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-xs">Tên gói (VI)</Label>
              <Input value={form.name} onChange={e => set("name", e.target.value)} className="mt-1 h-8 text-sm" />
            </div>
            <div>
              <Label className="text-xs">Tên gói (EN)</Label>
              <Input value={form.nameEn} onChange={e => set("nameEn", e.target.value)} className="mt-1 h-8 text-sm" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-xs">Số slide</Label>
              <Input value={form.slides} onChange={e => set("slides", e.target.value)} className="mt-1 h-8 text-sm" placeholder="VD: 10-15 slides" />
            </div>
            <div>
              <Label className="text-xs">Giá (VND)</Label>
              <Input type="number" value={form.price} onChange={e => set("price", Number(e.target.value))} className="mt-1 h-8 text-sm" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-xs">Thời gian giao (ngày)</Label>
              <Input type="number" value={form.deliveryDays} onChange={e => set("deliveryDays", Number(e.target.value))} className="mt-1 h-8 text-sm" />
            </div>
            <div>
              <Label className="text-xs">Lần chỉnh sửa</Label>
              <Input value={form.revisions} onChange={e => set("revisions", e.target.value)} className="mt-1 h-8 text-sm" placeholder="VD: 3 lần" />
            </div>
          </div>
          <div>
            <Label className="text-xs">Tính năng (VI) — mỗi dòng 1 tính năng</Label>
            <Textarea
              value={form.features.join("\n")}
              onChange={e => set("features", e.target.value.split("\n").filter(Boolean))}
              className="mt-1 text-sm font-mono"
              rows={4}
            />
          </div>
          <div>
            <Label className="text-xs">Tính năng (EN) — mỗi dòng 1 tính năng</Label>
            <Textarea
              value={form.featuresEn.join("\n")}
              onChange={e => set("featuresEn", e.target.value.split("\n").filter(Boolean))}
              className="mt-1 text-sm font-mono"
              rows={4}
            />
          </div>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={form.isHighlight} onChange={e => set("isHighlight", e.target.checked)} className="rounded" />
              Gói nổi bật
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={form.isActive} onChange={e => set("isActive", e.target.checked)} className="rounded" />
              Hiển thị
            </label>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-primary">{plan.price.toLocaleString("vi-VN")}</span>
            <span className="text-sm text-muted-foreground">VND</span>
          </div>
          <div className="text-sm text-muted-foreground space-y-1">
            <p>Slides: <span className="font-medium text-foreground">{plan.slides}</span></p>
            <p>Giao trong: <span className="font-medium text-foreground">{plan.deliveryDays} ngày</span></p>
            <p>Chỉnh sửa: <span className="font-medium text-foreground">{plan.revisions}</span></p>
          </div>
          <ul className="space-y-1.5">
            {plan.features.map(f => (
              <li key={f} className="text-sm flex items-start gap-2">
                <Star className="w-3.5 h-3.5 text-primary mt-0.5 flex-shrink-0" />
                {f}
              </li>
            ))}
          </ul>
          {plan.updatedAt && (
            <p className="text-xs text-muted-foreground border-t pt-2">
              Cập nhật lần cuối: {new Date(plan.updatedAt).toLocaleString("vi-VN")}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export default function AdminPricing() {
  const [, setLocation] = useLocation();
  const { data: user, isLoading: userLoading } = useGetCurrentUser();
  const { data: plans, isLoading } = useListAdminPricing();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!userLoading && (!user || (user as any).role !== "admin")) setLocation("/login");
  }, [user, userLoading, setLocation]);

  if (!userLoading && (!user || (user as any).role !== "admin")) return null;

  const handleSaved = () => {
    queryClient.invalidateQueries({ queryKey: ["listAdminPricing"] });
  };

  return (
    <div className="flex min-h-screen bg-slate-50">
      <AdminNav />
      <main className="flex-1 p-8 overflow-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-extrabold">Quản lý Bảng giá</h1>
          <p className="text-muted-foreground text-sm mt-1">Chỉnh sửa giá và thông tin các gói thiết kế riêng</p>
        </div>

        {isLoading ? (
          <div className="grid md:grid-cols-3 gap-6">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-80 rounded-xl" />)}
          </div>
        ) : (
          <div className="grid md:grid-cols-3 gap-6">
            {(plans as Plan[] | undefined)?.map(plan => (
              <PricingCard key={plan.id} plan={plan} onSaved={handleSaved} />
            ))}
          </div>
        )}

        {!isLoading && (!plans || (plans as any[]).length === 0) && (
          <div className="text-center py-20 text-muted-foreground">
            Chưa có gói dịch vụ nào. Chạy lệnh seed để khởi tạo dữ liệu.
          </div>
        )}
      </main>
    </div>
  );
}
