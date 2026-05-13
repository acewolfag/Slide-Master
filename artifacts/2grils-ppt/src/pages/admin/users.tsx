import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import {
  useGetCurrentUser,
  useUpdateUserRole,
  customFetch,
} from "@workspace/api-client-react";
import { useQueryClient, useQuery, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { AdminLayout } from "./index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Shield, Settings2, KeyRound, Mail, Search } from "lucide-react";

const ROLE_COLORS: Record<string, string> = {
  admin: "bg-red-100 text-red-700",
  staff: "bg-orange-100 text-orange-700",
  designer: "bg-purple-100 text-purple-700",
  customer: "bg-blue-100 text-blue-700",
};

const ROLE_LABELS: Record<string, string> = {
  admin: "Admin",
  staff: "Nhân viên",
  designer: "Designer",
  customer: "Khách hàng",
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

interface AdminUser {
  id: number;
  name: string;
  email: string;
  role: string;
  permissions?: Record<string, boolean> | null;
  avatarUrl?: string | null;
  lastLoginAt: string | null;
  createdAt: string;
}

const USERS_QUERY_KEY = ["admin", "users"] as const;

function PermissionsDialog({ user, onClose }: { user: AdminUser; onClose: () => void }) {
  const { toast } = useToast();
  const updateRole = useUpdateUserRole();
  const queryClient = useQueryClient();
  const [role, setRole] = useState(user.role);
  const [perms, setPerms] = useState<Record<string, boolean>>(
    (user.permissions as Record<string, boolean>) ?? {},
  );

  const handleSave = () => {
    updateRole.mutate(
      { id: user.id, data: { role: role as any, permissions: role === "staff" ? perms : undefined } } as any,
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: USERS_QUERY_KEY });
          toast({ title: `Đã cập nhật vai trò cho ${user.name}` });
          onClose();
        },
        onError: () => toast({ title: "Lỗi khi cập nhật", variant: "destructive" }),
      },
    );
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
                {PERMISSIONS.map((p) => (
                  <label key={p.key} className="flex items-center gap-3 cursor-pointer py-1">
                    <input
                      type="checkbox"
                      checked={!!perms[p.key]}
                      onChange={(e) => setPerms((prev) => ({ ...prev, [p.key]: e.target.checked }))}
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
            <Button
              className="brand-gradient border-none flex-1"
              onClick={handleSave}
              disabled={updateRole.isPending}
            >
              {updateRole.isPending ? "Đang lưu..." : "Lưu thay đổi"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function PasswordDialog({ user, onClose }: { user: AdminUser; onClose: () => void }) {
  const { toast } = useToast();
  const [newPassword, setNewPassword] = useState("");
  const [notify, setNotify] = useState(true);

  const setMutation = useMutation({
    mutationFn: () =>
      customFetch(`/api/admin/users/${user.id}/set-password`, {
        method: "POST",
        body: JSON.stringify({ newPassword, notify }),
      }),
    onSuccess: () => {
      toast({
        title: "Đã đặt lại mật khẩu",
        description: notify ? "Email đã gửi đến user" : "Hãy thông báo cho user theo cách thủ công",
      });
      onClose();
    },
    onError: (e: any) => toast({ title: "Lỗi", description: e?.message, variant: "destructive" }),
  });

  const linkMutation = useMutation({
    mutationFn: () =>
      customFetch<{ ok: boolean; sent: boolean; resetUrl: string | null }>(
        `/api/admin/users/${user.id}/send-reset-link`,
        { method: "POST" },
      ),
    onSuccess: (resp) => {
      if (resp.sent) {
        toast({ title: "Đã gửi link reset qua email" });
      } else if (resp.resetUrl) {
        toast({
          title: "SMTP chưa cấu hình",
          description: `Copy link cho user: ${resp.resetUrl}`,
        });
      }
      onClose();
    },
    onError: (e: any) => toast({ title: "Lỗi", description: e?.message, variant: "destructive" }),
  });

  const busy = setMutation.isPending || linkMutation.isPending;

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="w-5 h-5 text-primary" />
            Đặt lại mật khẩu: {user.name}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-5 py-2">
          <div className="bg-slate-50 rounded-xl p-4 space-y-3">
            <p className="text-sm font-semibold">Cách 1: Đặt mật khẩu mới ngay</p>
            <div>
              <Label>Mật khẩu mới (tối thiểu 6 ký tự)</Label>
              <Input
                type="text"
                className="mt-1.5 font-mono"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="ví dụ: NewPass123!"
              />
            </div>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={notify}
                onChange={(e) => setNotify(e.target.checked)}
                className="rounded w-4 h-4 accent-primary"
              />
              Gửi email thông báo cho user
            </label>
            <Button
              className="w-full"
              disabled={busy || newPassword.length < 6}
              onClick={() => setMutation.mutate()}
            >
              {setMutation.isPending ? "Đang xử lý..." : "Đặt mật khẩu mới"}
            </Button>
          </div>

          <div className="bg-blue-50 rounded-xl p-4 space-y-2">
            <p className="text-sm font-semibold">Cách 2: Gửi link reset qua email</p>
            <p className="text-xs text-muted-foreground">
              User nhận email chứa link reset (hết hạn sau 1 giờ). An toàn hơn cách 1.
            </p>
            <Button
              variant="outline"
              className="w-full"
              disabled={busy}
              onClick={() => linkMutation.mutate()}
            >
              <Mail className="w-4 h-4 mr-2" />
              {linkMutation.isPending ? "Đang gửi..." : "Gửi link reset"}
            </Button>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Đóng</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function AdminUsers() {
  const [, setLocation] = useLocation();
  const { data: user, isLoading: userLoading } = useGetCurrentUser();
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
  const [pwUser, setPwUser] = useState<AdminUser | null>(null);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    if (!userLoading && (!user || !["admin", "staff"].includes((user as any).role))) setLocation("/login");
  }, [user, userLoading, setLocation]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  const { data: users, isLoading } = useQuery<AdminUser[]>({
    queryKey: [...USERS_QUERY_KEY, debouncedSearch],
    queryFn: () => {
      const url = debouncedSearch
        ? `/api/admin/users?q=${encodeURIComponent(debouncedSearch)}`
        : `/api/admin/users`;
      return customFetch<AdminUser[]>(url);
    },
  });

  if (!userLoading && (!user || !["admin", "staff"].includes((user as any).role))) return null;

  const list = users ?? [];
  const isAdmin = (user as any)?.role === "admin";
  const formatLastLogin = (iso: string | null) =>
    iso ? new Date(iso).toLocaleString("vi-VN", { dateStyle: "short", timeStyle: "short" }) : null;

  return (
    <AdminLayout
      title="Quản lý Người dùng"
      description="Phân quyền, đổi mật khẩu, theo dõi đăng nhập"
    >
      <div className="relative mb-4">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
        <Input
          className="pl-9 h-11 sm:h-10 rounded-xl"
          placeholder="Tìm theo tên / email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-20 rounded-2xl" />
          ))}
        </div>
      ) : list.length === 0 ? (
        <div className="bg-white rounded-2xl p-10 text-center text-muted-foreground border border-dashed border-border/60">
          Không tìm thấy người dùng
        </div>
      ) : (
        <>
          {/* Mobile: card view */}
          <div className="md:hidden space-y-2.5">
            {list.map((u) => {
              const last = formatLastLogin(u.lastLoginAt);
              return (
                <div
                  key={u.id}
                  className="bg-white rounded-2xl border border-border/50 p-3 flex items-start gap-3"
                >
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary/15 to-blue-500/15 text-primary font-bold flex items-center justify-center flex-shrink-0 text-sm">
                    {u.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className="font-semibold text-sm truncate">{u.name}</p>
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium flex-shrink-0 ${ROLE_COLORS[u.role] ?? "bg-slate-100"}`}
                      >
                        {ROLE_LABELS[u.role] ?? u.role}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">{u.email}</p>
                    <p className="text-[11px] text-muted-foreground mt-1">
                      {last ? (
                        <>Đăng nhập: {last}</>
                      ) : (
                        <span className="italic">Chưa đăng nhập lần nào</span>
                      )}
                    </p>
                    {u.role === "staff" && u.permissions && (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 mt-1">
                        {Object.values(u.permissions).filter(Boolean).length} quyền
                      </Badge>
                    )}
                  </div>
                  {isAdmin && (
                    <div className="flex flex-col gap-1 flex-shrink-0">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-9 w-9 text-muted-foreground hover:text-primary"
                        onClick={() => setEditingUser(u)}
                        aria-label="Phân quyền"
                      >
                        <Settings2 className="w-4 h-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-9 w-9 text-muted-foreground hover:text-primary"
                        onClick={() => setPwUser(u)}
                        aria-label="Đặt lại mật khẩu"
                      >
                        <KeyRound className="w-4 h-4" />
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Desktop: table */}
          <div className="hidden md:block bg-white rounded-2xl border border-border/50 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b">
                <tr>
                  {["ID", "Tên", "Email", "Vai trò", "Đăng nhập gần nhất", "Ngày tham gia", "Hành động"].map((h) => (
                    <th key={h} className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {list.map((u) => (
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
                            {Object.values(u.permissions).filter(Boolean).length} quyền
                          </Badge>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">
                      {u.lastLoginAt
                        ? new Date(u.lastLoginAt).toLocaleString("vi-VN", { dateStyle: "short", timeStyle: "short" })
                        : <span className="italic">Chưa từng</span>}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {new Date(u.createdAt).toLocaleDateString("vi-VN")}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        {isAdmin && (
                          <>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 gap-1 text-xs"
                              onClick={() => setEditingUser(u)}
                              title="Phân quyền"
                            >
                              <Settings2 className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 gap-1 text-xs"
                              onClick={() => setPwUser(u)}
                              title="Đặt lại mật khẩu"
                            >
                              <KeyRound className="w-3.5 h-3.5" />
                            </Button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {editingUser && <PermissionsDialog user={editingUser} onClose={() => setEditingUser(null)} />}
      {pwUser && <PasswordDialog user={pwUser} onClose={() => setPwUser(null)} />}
    </AdminLayout>
  );
}
