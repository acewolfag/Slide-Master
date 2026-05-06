import { useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useGetAdminStats, useGetCurrentUser } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { TrendingUp, ShoppingCart, Users, FileText, LayoutDashboard, Package, Settings, Tag } from "lucide-react";

function AdminNav() {
  return (
    <aside className="w-56 flex-shrink-0 bg-slate-900 min-h-screen text-white flex flex-col">
      <div className="p-6 border-b border-slate-700">
        <span className="text-lg font-extrabold brand-gradient-text">2Grils Admin</span>
      </div>
      <nav className="p-4 space-y-1 flex-1">
        {[
          { href: "/admin", icon: LayoutDashboard, label: "Dashboard" },
          { href: "/admin/templates", icon: Settings, label: "Templates" },
          { href: "/admin/orders", icon: Package, label: "Đơn hàng" },
          { href: "/admin/custom-requests", icon: FileText, label: "Custom Requests" },
          { href: "/admin/users", icon: Users, label: "Người dùng" },
          { href: "/admin/vouchers", icon: Tag, label: "Voucher" },
        ].map(({ href, icon: Icon, label }) => (
          <Link key={href} href={href} className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-slate-300 hover:text-white hover:bg-slate-800 transition-colors">
            <Icon className="w-4 h-4" />
            {label}
          </Link>
        ))}
      </nav>
      <div className="p-4 border-t border-slate-700">
        <Link href="/" className="text-xs text-slate-400 hover:text-white">← Về trang chủ</Link>
      </div>
    </aside>
  );
}

export { AdminNav };

export default function AdminDashboard() {
  const [, setLocation] = useLocation();
  const { data: user, isLoading: userLoading } = useGetCurrentUser();
  const { data: stats, isLoading } = useGetAdminStats();

  useEffect(() => {
    if (!userLoading && (!user || (user as any).role !== "admin")) {
      setLocation("/login");
    }
  }, [user, userLoading, setLocation]);

  if (!userLoading && (!user || (user as any).role !== "admin")) return null;

  const STAT_CARDS = stats ? [
    { label: "Doanh thu", value: `${((stats as any).totalRevenue / 1_000_000).toFixed(1)}M VND`, icon: TrendingUp, color: "text-green-600" },
    { label: "Đơn hàng", value: (stats as any).totalOrders, icon: ShoppingCart, color: "text-blue-600" },
    { label: "Custom Requests", value: (stats as any).pendingCustomRequests, icon: FileText, color: "text-orange-600" },
    { label: "Khách mới tháng này", value: (stats as any).newCustomersThisMonth, icon: Users, color: "text-purple-600" },
  ] : [];

  return (
    <div className="flex min-h-screen bg-slate-50">
      <AdminNav />
      <main className="flex-1 p-8 overflow-auto">
        <h1 className="text-2xl font-extrabold mb-6">Dashboard</h1>

        {isLoading ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {[1,2,3,4].map(i => <Skeleton key={i} className="h-28 rounded-xl" />)}
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {STAT_CARDS.map(({ label, value, icon: Icon, color }) => (
              <Card key={label} className="border-border/50">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">{label}</p>
                      <p className={`text-2xl font-extrabold ${color}`}>{value}</p>
                    </div>
                    <div className={`w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center ${color}`}>
                      <Icon className="w-5 h-5" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Revenue Chart */}
        <Card className="mb-8 border-border/50">
          <CardHeader>
            <CardTitle className="text-base">Doanh thu 7 ngày qua</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="w-full h-48" /> : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={(stats as any)?.revenueByDay ?? []}>
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `${(v/1000000).toFixed(1)}M`} />
                  <Tooltip formatter={(v: any) => `${v.toLocaleString("vi-VN")} VND`} />
                  <Bar dataKey="revenue" fill="var(--color-primary)" radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Top Templates */}
        <Card className="border-border/50">
          <CardHeader>
            <CardTitle className="text-base">Template bán chạy nhất</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {(stats as any)?.topTemplates?.map((t: any, i: number) => (
                <div key={t.id} className="flex items-center gap-3">
                  <span className="w-6 text-sm font-bold text-muted-foreground">{i+1}</span>
                  <img src={t.thumbnailUrl} alt="" className="w-10 h-7 object-cover rounded" />
                  <p className="text-sm font-medium flex-1 line-clamp-1">{t.title}</p>
                  <span className="text-sm text-muted-foreground">{t.salesCount} bán</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
