import { useEffect } from "react";
import { useLocation } from "wouter";
import { useListAdminUsers, useGetCurrentUser } from "@workspace/api-client-react";
import { AdminNav } from "./index";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

const ROLE_COLORS: Record<string, string> = {
  admin: "bg-red-100 text-red-700",
  designer: "bg-purple-100 text-purple-700",
  customer: "bg-blue-100 text-blue-700",
};

export default function AdminUsers() {
  const [, setLocation] = useLocation();
  const { data: user, isLoading: userLoading } = useGetCurrentUser();
  const { data: users, isLoading } = useListAdminUsers();

  useEffect(() => {
    if (!userLoading && (!user || (user as any).role !== "admin")) setLocation("/login");
  }, [user, userLoading, setLocation]);

  if (!userLoading && (!user || (user as any).role !== "admin")) return null;

  return (
    <div className="flex min-h-screen bg-slate-50">
      <AdminNav />
      <main className="flex-1 p-8 overflow-auto">
        <h1 className="text-2xl font-extrabold mb-6">Quản lý Người dùng</h1>
        {isLoading ? <Skeleton className="w-full h-64 rounded-xl" /> : (
          <div className="bg-white rounded-xl border border-border/50 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b">
                <tr>
                  {["ID", "Tên", "Email", "Vai trò", "Ngày tham gia"].map(h => (
                    <th key={h} className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(users as any[])?.map(u => (
                  <tr key={u.id} className="border-b last:border-0 hover:bg-slate-50">
                    <td className="px-4 py-3 text-muted-foreground text-xs">{u.id}</td>
                    <td className="px-4 py-3 font-medium">{u.name}</td>
                    <td className="px-4 py-3 text-muted-foreground">{u.email}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ROLE_COLORS[u.role] ?? ""}`}>{u.role}</span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{new Date(u.createdAt).toLocaleDateString("vi-VN")}</td>
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
