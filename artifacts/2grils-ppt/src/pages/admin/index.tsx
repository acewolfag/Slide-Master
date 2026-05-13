import { useEffect, useState, type ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { useGetAdminStats, useGetCurrentUser } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import {
  TrendingUp,
  ShoppingCart,
  Users,
  FileText,
  LayoutDashboard,
  Package,
  Settings,
  Tag,
  DollarSign,
  Image as ImageIcon,
  Menu,
  MoreHorizontal,
  ChevronLeft,
  ExternalLink,
  Star,
} from "lucide-react";

const PIE_COLORS = [
  "#00B14F",
  "#1E5FAF",
  "#F59E0B",
  "#EF4444",
  "#A855F7",
  "#06B6D4",
  "#10B981",
  "#F97316",
];

interface AdminMenuItem {
  href: string;
  icon: typeof LayoutDashboard;
  label: string;
  shortLabel?: string;
}

const ADMIN_MENU_ITEMS: AdminMenuItem[] = [
  { href: "/admin", icon: LayoutDashboard, label: "Dashboard", shortLabel: "Tổng quan" },
  { href: "/admin/orders", icon: Package, label: "Đơn hàng" },
  { href: "/admin/templates", icon: Settings, label: "Templates", shortLabel: "Mẫu" },
  { href: "/admin/custom-requests", icon: FileText, label: "Yêu cầu thiết kế", shortLabel: "Yêu cầu" },
  { href: "/admin/reviews", icon: Star, label: "Đánh giá" },
  { href: "/admin/users", icon: Users, label: "Người dùng" },
  { href: "/admin/vouchers", icon: Tag, label: "Voucher" },
  { href: "/admin/pricing", icon: DollarSign, label: "Bảng giá" },
  { href: "/admin/banner", icon: ImageIcon, label: "Banner" },
];

const MOBILE_BOTTOM_TABS = ADMIN_MENU_ITEMS.slice(0, 4);

interface AdminLayoutProps {
  title: string;
  description?: string;
  children: ReactNode;
  actions?: ReactNode;
}

function SidebarBrand() {
  return (
    <div className="px-5 py-4 border-b border-slate-700/60 flex items-center gap-3">
      <img src="/logo.jpg" alt="" className="w-9 h-9 rounded-full object-cover ring-2 ring-slate-700/50" />
      <div className="leading-tight">
        <div className="text-base font-extrabold brand-gradient-text">2Grils</div>
        <div className="text-[10px] uppercase tracking-wider text-slate-400">Admin Panel</div>
      </div>
    </div>
  );
}

function SidebarFooter({ onLinkClick }: { onLinkClick?: () => void }) {
  return (
    <div className="px-5 py-3 border-t border-slate-700/60">
      <Link
        href="/"
        onClick={onLinkClick}
        className="text-xs text-slate-400 hover:text-white inline-flex items-center gap-1.5 transition-colors"
      >
        <ChevronLeft className="w-3.5 h-3.5" />
        Về trang chủ
      </Link>
    </div>
  );
}

function SidebarNav({ onItemClick }: { onItemClick?: () => void }) {
  const [location] = useLocation();
  return (
    <nav className="p-3 space-y-0.5">
      {ADMIN_MENU_ITEMS.map(({ href, icon: Icon, label }) => {
        const active = location === href;
        return (
          <Link
            key={href}
            href={href}
            onClick={onItemClick}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
              active
                ? "bg-slate-800 text-white font-medium shadow-sm"
                : "text-slate-300 hover:text-white hover:bg-slate-800/60"
            }`}
          >
            <Icon className="w-4 h-4 flex-shrink-0" />
            <span className="truncate">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

export function AdminLayout({ title, description, children, actions }: AdminLayoutProps) {
  const [location] = useLocation();
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <div className="min-h-screen bg-slate-50">
      <aside className="hidden md:flex fixed top-0 left-0 h-screen w-56 z-20 bg-slate-900 text-white flex-col">
        <SidebarBrand />
        <div className="flex-1 overflow-y-auto py-1">
          <SidebarNav />
        </div>
        <SidebarFooter />
      </aside>

      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent
          side="left"
          className="w-[280px] max-w-[85vw] bg-slate-900 text-white p-0 border-0 flex flex-col gap-0"
        >
          <SidebarBrand />
          <div className="flex-1 overflow-y-auto py-1">
            <SidebarNav onItemClick={() => setDrawerOpen(false)} />
          </div>
          <SidebarFooter onLinkClick={() => setDrawerOpen(false)} />
        </SheetContent>
      </Sheet>

      <div className="md:pl-56 min-h-screen flex flex-col">
        <header className="sticky top-0 z-10 bg-white/85 backdrop-blur supports-[backdrop-filter]:bg-white/70 border-b border-border/40">
          <div className="flex items-center gap-2 px-3 md:px-8 h-14">
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden -ml-1 h-9 w-9"
              onClick={() => setDrawerOpen(true)}
              aria-label="Mở menu admin"
            >
              <Menu className="w-5 h-5" />
            </Button>
            <div className="flex-1 min-w-0">
              <h1 className="text-base md:text-lg font-bold truncate leading-tight">{title}</h1>
              {description && (
                <p className="hidden md:block text-xs text-muted-foreground truncate">
                  {description}
                </p>
              )}
            </div>
            <div className="flex items-center gap-1 sm:gap-2">
              {actions}
              <Link href="/dashboard">
                <Button variant="ghost" size="sm" className="text-muted-foreground gap-1.5 px-2">
                  <ExternalLink className="w-4 h-4" />
                  <span className="hidden sm:inline text-xs">User view</span>
                </Button>
              </Link>
            </div>
          </div>
          {description && (
            <p className="md:hidden text-xs text-muted-foreground px-3 pb-2 -mt-0.5 truncate">
              {description}
            </p>
          )}
        </header>

        <main className="flex-1 px-3 md:px-8 pt-4 pb-24 md:pt-6 md:pb-10">{children}</main>
      </div>

      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-20 bg-white/95 backdrop-blur border-t border-border/50 shadow-[0_-4px_16px_-10px_rgba(0,0,0,0.18)]"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        aria-label="Điều hướng admin"
      >
        <div className="flex items-stretch h-14">
          {MOBILE_BOTTOM_TABS.map(({ href, icon: Icon, label, shortLabel }) => {
            const active = location === href;
            return (
              <Link
                key={href}
                href={href}
                className={`flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors relative ${
                  active ? "text-primary" : "text-muted-foreground active:text-primary"
                }`}
                aria-current={active ? "page" : undefined}
              >
                {active && (
                  <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full bg-primary" />
                )}
                <Icon className={`w-5 h-5 ${active ? "stroke-[2.5]" : ""}`} />
                <span className={`text-[10px] leading-none mt-0.5 ${active ? "font-semibold" : ""}`}>
                  {shortLabel ?? label}
                </span>
              </Link>
            );
          })}
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="flex-1 flex flex-col items-center justify-center gap-0.5 text-muted-foreground active:text-primary"
            aria-label="Mở thêm menu"
          >
            <MoreHorizontal className="w-5 h-5" />
            <span className="text-[10px] leading-none mt-0.5">Khác</span>
          </button>
        </div>
      </nav>
    </div>
  );
}

export const AdminNav = (): null => null;
export const AdminSidebar = (): null => null;
export const AdminHeader = (): null => null;

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

  const STAT_CARDS = stats
    ? [
        {
          label: "Doanh thu",
          value: `${((stats as any).totalRevenue / 1_000_000).toFixed(1)}M`,
          unit: "VND",
          icon: TrendingUp,
          tone: "from-emerald-500/15 to-emerald-500/5 text-emerald-700",
          iconBg: "bg-emerald-100 text-emerald-600",
        },
        {
          label: "Đơn hàng",
          value: (stats as any).totalOrders,
          icon: ShoppingCart,
          tone: "from-blue-500/15 to-blue-500/5 text-blue-700",
          iconBg: "bg-blue-100 text-blue-600",
        },
        {
          label: "Custom request",
          value: (stats as any).pendingCustomRequests,
          icon: FileText,
          tone: "from-orange-500/15 to-orange-500/5 text-orange-700",
          iconBg: "bg-orange-100 text-orange-600",
        },
        {
          label: "Khách mới",
          value: (stats as any).newCustomersThisMonth,
          icon: Users,
          tone: "from-violet-500/15 to-violet-500/5 text-violet-700",
          iconBg: "bg-violet-100 text-violet-600",
        },
      ]
    : [];

  return (
    <AdminLayout title="Dashboard" description="Tổng quan hoạt động">
      {isLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-24 rounded-2xl" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
          {STAT_CARDS.map(({ label, value, unit, icon: Icon, tone, iconBg }) => (
            <div
              key={label}
              className={`rounded-2xl border border-border/40 bg-gradient-to-br ${tone} p-3 sm:p-4 relative overflow-hidden`}
            >
              <div className={`absolute right-2 top-2 w-9 h-9 rounded-xl flex items-center justify-center ${iconBg}`}>
                <Icon className="w-4 h-4" />
              </div>
              <p className="text-[11px] sm:text-xs font-medium opacity-80 pr-10">{label}</p>
              <p className="text-xl sm:text-2xl font-extrabold mt-1 leading-none">
                {value}
                {unit && <span className="text-[10px] sm:text-xs ml-1 font-semibold opacity-70">{unit}</span>}
              </p>
            </div>
          ))}
        </div>
      )}

      <Card className="mb-4 lg:mb-5 border-border/50 rounded-2xl">
        <CardHeader className="pb-2 px-4 sm:px-6 pt-4">
          <CardTitle className="text-sm sm:text-base">Doanh thu 7 ngày qua</CardTitle>
        </CardHeader>
        <CardContent className="px-2 sm:px-4 pb-4">
          {isLoading ? (
            <Skeleton className="w-full h-48" />
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={(stats as any)?.revenueByDay ?? []} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <XAxis dataKey="date" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${(v / 1000000).toFixed(1)}M`} tickLine={false} axisLine={false} />
                <Tooltip
                  formatter={(v: any) => `${Number(v).toLocaleString("vi-VN")} VND`}
                  contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e5e7eb" }}
                />
                <Bar dataKey="revenue" fill="#00B14F" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 lg:gap-5">
        <Card className="border-border/50 rounded-2xl">
          <CardHeader className="pb-2 px-4 sm:px-6 pt-4">
            <CardTitle className="text-sm sm:text-base">Template bán chạy nhất</CardTitle>
          </CardHeader>
          <CardContent className="px-4 sm:px-6 pb-4">
            <div className="space-y-3">
              {((stats as any)?.topTemplates ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground italic">Chưa có dữ liệu</p>
              ) : (
                (stats as any)?.topTemplates?.map((t: any, i: number) => (
                  <div key={t.id} className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-full bg-slate-100 text-xs font-bold text-slate-600 flex items-center justify-center flex-shrink-0">
                      {i + 1}
                    </span>
                    <img
                      src={t.thumbnailUrl}
                      alt=""
                      className="w-12 h-8 object-cover rounded flex-shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium line-clamp-1">{t.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {t.salesCount} bán · {(t.revenue ?? 0).toLocaleString("vi-VN")}đ
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50 rounded-2xl">
          <CardHeader className="pb-2 px-4 sm:px-6 pt-4">
            <CardTitle className="text-sm sm:text-base">Tỷ trọng doanh thu theo template</CardTitle>
          </CardHeader>
          <CardContent className="px-2 sm:px-4 pb-4">
            {isLoading ? (
              <Skeleton className="w-full h-64" />
            ) : ((stats as any)?.topTemplatesByRevenue ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground italic text-center py-12">
                Chưa có giao dịch nào để thống kê
              </p>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie
                    data={(stats as any).topTemplatesByRevenue}
                    dataKey="revenue"
                    nameKey="title"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    innerRadius={36}
                    paddingAngle={2}
                    label={(p: any) => `${(((p.percent ?? 0) as number) * 100).toFixed(0)}%`}
                  >
                    {(stats as any).topTemplatesByRevenue.map((_: any, idx: number) => (
                      <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(v: any) => `${Number(v).toLocaleString("vi-VN")} VND`}
                    contentStyle={{ fontSize: 12, borderRadius: 8 }}
                  />
                  <Legend
                    layout="horizontal"
                    align="center"
                    verticalAlign="bottom"
                    wrapperStyle={{ fontSize: 10, paddingTop: 8 }}
                    formatter={(value: string) => (value.length > 14 ? `${value.slice(0, 14)}…` : value)}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
