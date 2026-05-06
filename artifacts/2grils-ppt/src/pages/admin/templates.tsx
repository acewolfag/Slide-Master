import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useListAdminTemplates, useDeleteTemplate, getListAdminTemplatesQueryKey, useGetCurrentUser } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { AdminNav } from "./index";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Trash2, Pencil, Plus } from "lucide-react";

export default function AdminTemplates() {
  const [, setLocation] = useLocation();
  const { data: user, isLoading: userLoading } = useGetCurrentUser();
  const { data: templates, isLoading } = useListAdminTemplates();
  const deleteTemplate = useDeleteTemplate();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  useEffect(() => {
    if (!userLoading && (!user || (user as any).role !== "admin")) setLocation("/login");
  }, [user, userLoading, setLocation]);

  if (!userLoading && (!user || (user as any).role !== "admin")) return null;

  const handleDelete = (id: number, title: string) => {
    if (!confirm(`Xóa template "${title}"?`)) return;
    deleteTemplate.mutate({ templateId: id } as any, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListAdminTemplatesQueryKey() });
        toast({ title: "Đã xóa template" });
      },
      onError: () => toast({ title: "Lỗi khi xóa", variant: "destructive" }),
    });
  };

  return (
    <div className="flex min-h-screen bg-slate-50">
      <AdminNav />
      <main className="flex-1 p-8 overflow-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-extrabold">Quản lý Templates</h1>
          <Button className="brand-gradient border-none gap-2" disabled>
            <Plus className="w-4 h-4" /> Thêm template
          </Button>
        </div>

        {isLoading ? <Skeleton className="w-full h-64 rounded-xl" /> : (
          <div className="bg-white rounded-xl border border-border/50 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b">
                <tr>
                  {["", "Tiêu đề", "Danh mục", "Giá", "Doanh số", "Trạng thái", ""].map((h, i) => (
                    <th key={i} className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(templates as any[])?.map(t => (
                  <tr key={t.id} className="border-b last:border-0 hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <img src={t.thumbnailUrl} alt="" className="w-14 h-9 object-cover rounded" />
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium line-clamp-1">{t.titleVi}</p>
                      <p className="text-xs text-muted-foreground">{t.slideCount} slides · {t.aspectRatio}</p>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{t.categoryName}</td>
                    <td className="px-4 py-3 font-bold text-primary">
                      {t.isFree ? "Miễn phí" : `${t.price.toLocaleString("vi-VN")}đ`}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{t.salesCount}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${t.status === "active" ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"}`}>
                        {t.status === "active" ? "Hoạt động" : "Nháp"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:text-primary" disabled>
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => handleDelete(t.id, t.titleVi)}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {(templates as any[])?.length === 0 && (
              <p className="text-center py-12 text-muted-foreground">Chưa có template nào</p>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
