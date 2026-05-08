import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useListAdminUsers, useGetCurrentUser, useUpdateUserRole } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { AdminNav } from "./index";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Shield, Settings2 } from "lucide-react";

const ROLE_COLORS: Record<string, string> = {
  admin: "bg-red-100 text-red-700",
  staff: "bg-orange-100 text-orange-700",
  designer: "bg-purple-100 text-purple-700",
  customer: "bg-blue-100 text-blue-700",
};

const ROLE_LABELS: Record<string, string> = {
  admin: "Admin", staff: "Nhân viên", designer: "Designer", customer: "Khách hàng",
};

const PERMISSIONS = [
  { key: "manageOrders", label: "Quản lý Đơn hàng" },
  { key: "manageTemplates", label: "Quản lý Templates" },
  { key: "manageCustomRequests", label: "Quản lý Yêu cầu thiết kế" },
  { key: "manageBlog", label: "Quản lý Blog" },
  { key: "viewStats", label: "Xem Thống kê" },
  { key: "manageVouchers", label: "Quản lý Voucher" },
  { key: "manageUsers", label: "Quản lý Người dùng" },
];

type AnyUser = {
  id: number; name: string; email: string; role: string;
  permissions?: Record<string, boolean> | null;
  avatarUrl?: string | null; createdAt: string;
};

function PermissionsDialog({ user, onClose }: { user: AnyUser; onClose: () => void }) {
  const { toast } = useToast();
  const updateRole = useUpdateUserRole();
  const queryClient = useQueryClient();
  const [role, setRole] = useState(user.role);
  const [perms, setPerms] = useState<Record<string, boolean>>(
    (user.permissions as Record<string, boolean>) ?? {}
  );

  const handleSave = () => {
    updateRole.mutate({
      id: user.id,
      data: { role: role as any, permissions: role === "staff" ? perms : undefined },
    } as any, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["listAdminUsers"] });
        toast({ title: `Đã cập nhật vai trò cho ${user.name}` });
        onClose();
      },
      onError: () => toast({ title: "Lỗi khi cập nhật", variant: "destructive" }),
    });
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary" />
            Phân quyền: {user.name}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-5 py-2">
          <div>
            <Label>Vai trò</Label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger className="mt-1.5">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="customer">Khách hàng</SelectItem>
                <SelectItem value="designer">Designer</SelectItem>
                <SelectItem value="staff">Nhân viên</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {role === "staff" && (
            <div>
              <Label className="block mb-3">Quyền của nhân viên</Label>
              <div className="space-y-2 bg-slate-50 rounded-xl p-4 border">
                {PERMISSIONS.map(p => (
                  <label key={p.key} className="flex items-center gap-3 cursor-pointer py-1">
                    <input
                      type="checkbox"
                      checked={!!perms[p.key]}
                      onChange={e => setPerms(prev => ({ ...prev, [p.key]: e.target.checked }))}
                      className="rounded w-4 h-4 accent-primary"
                    />
                    <span className="text-sm">{p.label}</span>
                  </label>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Nhân viên chỉ truy cập được các mục được cấp phép. Admin luôn có toàn quyền.
              </p>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <Button variant="outline" onClick={onClose} className="flex-1">Hủy</Button>
            <Button className="brand-gradient border-none flex-1" onClick={handleSave} disabled={updateRole.isPending}>
              {updateRole.isPending ? "Đang lưu..." : "Lưu thay đổi"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function AdminUsers() {
  const [, setLocation] = useLocation();
  const { data: user, isLoading: userLoading } = useGetCurrentUser();
  const { data: users, isLoading } = useListAdminUsers();
  const [editingUser, setEditingUser] = useState<AnyUser | null>(null);

  useEffect(() => {
    if (!userLoading && (!user || !["admin", "staff"].includes((user as any).role))) setLocation("/login");
  }, [user, userLoading, setLocation]);

  if (!userLoading && (!user || !["admin", "staff"].includes((user as any).role))) return null;

  return (
    <div className="flex min-h-screen bg-slate-50">
      <AdminNav />
      <main className="flex-1 p-8 overflow-auto">
        <h1 className="text-2xl font-extrabold mb-2">Quản lý Người dùng</h1>
        <p className="text-muted-foreground text-sm mb-6">Phân quyền và quản lý tài khoản</p>
        {isLoading ? <Skeleton className="w-full h-64 rounded-xl" /> : (
          <div className="bg-white rounded-xl border border-border/50 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b">
                <tr>
                  {["ID", "Tên", "Email", "Vai trò", "Ngày tham gia", ""].map(h => (
                    <th key={h} className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(users as AnyUser[])?.map(u => (
                  <tr key={u.id} className="border-b last:border-0 hover:bg-slate-50">
                    <td className="px-4 py-3 text-muted-foreground text-xs">{u.id}</td>
                    <td className="px-4 py-3 font-medium">{u.name}</td>
                    <td className="px-4 py-3 text-muted-foreground">{u.email}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ROLE_COLORS[u.role] ?? "bg-slate-100"}`}>
                          {ROLE_LABELS[u.role] ?? u.role}
                        </span>
                        {u.role === "staff" && u.permissions && (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                            {Object.values(u.permissions as Record<string, boolean>).filter(Boolean).length} quyền
                          </Badge>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{new Date(u.createdAt).toLocaleDateString("vi-VN")}</td>
                    <td className="px-4 py-3">
                      {(user as any)?.role === "admin" && (
                        <Button size="sm" variant="ghost" className="h-7 gap-1.5 text-xs" onClick={() => setEditingUser(u)}>
                          <Settings2 className="w-3.5 h-3.5" /> Phân quyền
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {editingUser && <PermissionsDialog user={editingUser} onClose={() => setEditingUser(null)} />}
      </main>
    </div>
  );
}
