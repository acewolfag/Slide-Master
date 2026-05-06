import { useState } from "react";
import { Layout } from "@/components/layout";
import { Link, useLocation } from "wouter";
import {
  useGetCurrentUser, getGetCurrentUserQueryKey,
  useGetLibrary, useListOrders, useGetWishlist, useListCustomRequests,
  useUpdateProfile,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Download, Heart, Package, User, FileText, ExternalLink } from "lucide-react";
import { TemplateCard } from "@/components/template-card";

const ORDER_STATUS_MAP: Record<string, { label: string; color: string }> = {
  pending: { label: "Chờ thanh toán", color: "bg-yellow-100 text-yellow-700" },
  paid: { label: "Đã thanh toán", color: "bg-green-100 text-green-700" },
  failed: { label: "Thất bại", color: "bg-red-100 text-red-700" },
  refunded: { label: "Đã hoàn tiền", color: "bg-gray-100 text-gray-600" },
};

const CUSTOM_STATUS_MAP: Record<string, string> = {
  pending: "Chờ phản hồi", quoted: "Đã báo giá", "deposit-paid": "Đã đặt cọc",
  "in-progress": "Đang thực hiện", review: "Đang duyệt", "final-payment": "Thanh toán cuối", delivered: "Hoàn thành",
};

export default function Dashboard() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: user, isLoading: userLoading } = useGetCurrentUser();
  const { data: library, isLoading: libLoading } = useGetLibrary();
  const { data: orders, isLoading: ordersLoading } = useListOrders();
  const { data: wishlist, isLoading: wishlistLoading } = useGetWishlist();
  const { data: customRequests } = useListCustomRequests();
  const updateProfile = useUpdateProfile();

  const [name, setName] = useState("");
  const [profileSaving, setProfileSaving] = useState(false);

  if (userLoading) {
    return <Layout><div className="container mx-auto px-4 py-16"><Skeleton className="w-full h-96 rounded-xl" /></div></Layout>;
  }

  if (!user) {
    setLocation("/login");
    return null;
  }

  const handleSaveProfile = () => {
    setProfileSaving(true);
    updateProfile.mutate({ data: { name: name || (user as any).name } } as any, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetCurrentUserQueryKey() });
        toast({ title: "Cập nhật thành công!" });
        setProfileSaving(false);
      },
      onError: () => { toast({ title: "Có lỗi xảy ra", variant: "destructive" }); setProfileSaving(false); },
    });
  };

  return (
    <Layout>
      <div className="bg-slate-50 min-h-screen py-12">
        <div className="container mx-auto px-4 max-w-5xl">
          <div className="flex items-center gap-4 mb-8">
            <div className="w-14 h-14 rounded-full brand-gradient flex items-center justify-center text-white text-xl font-bold shadow-lg">
              {(user as any).name?.[0]?.toUpperCase() ?? "U"}
            </div>
            <div>
              <h1 className="text-2xl font-extrabold">{(user as any).name}</h1>
              <p className="text-muted-foreground text-sm">{(user as any).email}</p>
            </div>
            {(user as any).role === "admin" && (
              <Link href="/admin" className="ml-auto">
                <Button variant="outline" size="sm">
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Admin Dashboard
                </Button>
              </Link>
            )}
          </div>

          <Tabs defaultValue="library">
            <TabsList className="mb-6">
              <TabsTrigger value="library" className="gap-2"><Download className="w-4 h-4" /> Tủ của tôi</TabsTrigger>
              <TabsTrigger value="orders" className="gap-2"><Package className="w-4 h-4" /> Đơn hàng</TabsTrigger>
              <TabsTrigger value="custom" className="gap-2"><FileText className="w-4 h-4" /> Custom Request</TabsTrigger>
              <TabsTrigger value="wishlist" className="gap-2"><Heart className="w-4 h-4" /> Yêu thích</TabsTrigger>
              <TabsTrigger value="profile" className="gap-2"><User className="w-4 h-4" /> Tài khoản</TabsTrigger>
            </TabsList>

            <TabsContent value="library">
              {libLoading ? <Skeleton className="w-full h-48 rounded-xl" /> : (
                (library as any[])?.length === 0 ? (
                  <div className="text-center py-16 text-muted-foreground">
                    <Download className="w-12 h-12 mx-auto mb-4 opacity-30" />
                    <p>Chưa có template nào trong tủ của bạn</p>
                    <Link href="/templates"><Button className="mt-4 brand-gradient border-none">Khám phá template</Button></Link>
                  </div>
                ) : (
                  <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {(library as any[])?.map(item => (
                      <Card key={item.templateId} className="overflow-hidden">
                        <img src={item.thumbnailUrl} alt={item.titleVi} className="w-full aspect-[16/9] object-cover" />
                        <CardContent className="p-4">
                          <h3 className="font-semibold text-sm line-clamp-1 mb-2">{item.titleVi}</h3>
                          <Button size="sm" className="w-full brand-gradient border-none" asChild>
                            <a href={item.downloadUrl} download><Download className="w-4 h-4 mr-2" />Tải xuống</a>
                          </Button>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )
              )}
            </TabsContent>

            <TabsContent value="orders">
              {ordersLoading ? <Skeleton className="w-full h-48 rounded-xl" /> : (
                (orders as any[])?.length === 0 ? (
                  <div className="text-center py-16 text-muted-foreground">
                    <Package className="w-12 h-12 mx-auto mb-4 opacity-30" />
                    <p>Chưa có đơn hàng nào</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {(orders as any[])?.map(order => {
                      const st = ORDER_STATUS_MAP[order.status] ?? { label: order.status, color: "bg-gray-100 text-gray-600" };
                      return (
                        <Card key={order.id} className="border-border/50">
                          <CardContent className="p-4 flex items-center justify-between">
                            <div>
                              <p className="font-semibold text-sm">Đơn #{order.id}</p>
                              <p className="text-xs text-muted-foreground">{new Date(order.createdAt).toLocaleDateString("vi-VN")}</p>
                              <p className="text-sm font-bold text-primary mt-1">{order.total.toLocaleString("vi-VN")} VND</p>
                            </div>
                            <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${st.color}`}>{st.label}</span>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )
              )}
            </TabsContent>

            <TabsContent value="custom">
              {(customRequests as any[])?.length === 0 ? (
                <div className="text-center py-16 text-muted-foreground">
                  <FileText className="w-12 h-12 mx-auto mb-4 opacity-30" />
                  <p>Chưa có yêu cầu thiết kế riêng nào</p>
                  <Link href="/custom-design/request"><Button className="mt-4 brand-gradient border-none">Đặt thiết kế ngay</Button></Link>
                </div>
              ) : (
                <div className="space-y-3">
                  {(customRequests as any[])?.map(req => (
                    <Card key={req.id} className="border-border/50">
                      <CardContent className="p-4 flex items-center justify-between">
                        <div>
                          <p className="font-mono text-sm font-semibold">{req.requestId}</p>
                          <p className="text-xs text-muted-foreground">{req.slideType} · {req.slideCount} slides</p>
                          <p className="text-xs text-muted-foreground mt-0.5">Deadline: {req.deadline}</p>
                        </div>
                        <Badge variant="secondary">{CUSTOM_STATUS_MAP[req.status] ?? req.status}</Badge>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="wishlist">
              {wishlistLoading ? <Skeleton className="w-full h-48 rounded-xl" /> : (
                (wishlist as any[])?.length === 0 ? (
                  <div className="text-center py-16 text-muted-foreground">
                    <Heart className="w-12 h-12 mx-auto mb-4 opacity-30" />
                    <p>Danh sách yêu thích trống</p>
                  </div>
                ) : (
                  <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {(wishlist as any[])?.map(t => <TemplateCard key={t.id} template={t} />)}
                  </div>
                )
              )}
            </TabsContent>

            <TabsContent value="profile">
              <Card className="border-border/50 max-w-lg">
                <CardContent className="p-6 space-y-4">
                  <h2 className="font-bold text-lg">Thông tin cá nhân</h2>
                  <div>
                    <Label>Họ và tên</Label>
                    <Input className="mt-1.5" defaultValue={(user as any).name} onChange={e => setName(e.target.value)} />
                  </div>
                  <div>
                    <Label>Email</Label>
                    <Input className="mt-1.5" value={(user as any).email} disabled />
                  </div>
                  <Button className="brand-gradient border-none" onClick={handleSaveProfile} disabled={profileSaving}>
                    {profileSaving ? "Đang lưu..." : "Lưu thay đổi"}
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </Layout>
  );
}
