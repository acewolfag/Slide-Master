import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useGetCurrentUser, useGetAdminSettings, useUpdateSiteSettings } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { AdminNav } from "./index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Save, Upload, Eye } from "lucide-react";

type BannerSettings = {
  heading?: string;
  subheading?: string;
  badgeText?: string;
  ctaText?: string;
  ctaUrl?: string;
  ctaSecondaryText?: string;
  bgImageUrl?: string;
};

const DEFAULTS: BannerSettings = {
  heading: "Thuyết trình đỉnh cao\nChốt sale hoàn hảo",
  subheading: "Hàng ngàn template PowerPoint cao cấp được thiết kế bởi chuyên gia, giúp bạn tiết kiệm thời gian và tạo ấn tượng mạnh mẽ.",
  badgeText: "Tin tưởng bởi 500+ doanh nghiệp Việt Nam",
  ctaText: "Khám phá Template",
  ctaUrl: "/templates",
  ctaSecondaryText: "Đặt thiết kế riêng",
  bgImageUrl: "",
};

export default function AdminBanner() {
  const [, setLocation] = useLocation();
  const { data: user, isLoading: userLoading } = useGetCurrentUser();
  const { data: settingsData, isLoading } = useGetAdminSettings();
  const updateSettings = useUpdateSiteSettings();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [banner, setBanner] = useState<BannerSettings>(DEFAULTS);
  const [uploading, setUploading] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!userLoading && (!user || !["admin", "staff"].includes((user as any).role))) setLocation("/login");
  }, [user, userLoading, setLocation]);

  useEffect(() => {
    if (settingsData) {
      const b = (settingsData as any).banner;
      if (b) setBanner({ ...DEFAULTS, ...b });
    }
  }, [settingsData]);

  const set = (k: keyof BannerSettings, v: string) => setBanner(prev => ({ ...prev, [k]: v }));

  const handleSave = () => {
    updateSettings.mutate({ data: { banner } as any }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["getAdminSettings"] });
        queryClient.invalidateQueries({ queryKey: ["getSiteSettings"] });
        toast({ title: "Đã lưu cài đặt banner" });
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      },
      onError: () => toast({ title: "Lỗi khi lưu", variant: "destructive" }),
    });
  };

  const handleUploadBg = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("files", file);
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const data = await res.json();
      set("bgImageUrl", data.files[0].url);
      toast({ title: "Đã tải ảnh lên" });
    } catch {
      toast({ title: "Lỗi upload ảnh", variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  if (!userLoading && (!user || !["admin", "staff"].includes((user as any).role))) return null;

  return (
    <div className="flex min-h-screen bg-slate-50">
      <AdminNav />
      <main className="flex-1 p-8 overflow-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-extrabold">Tùy chỉnh Banner trang chủ</h1>
            <p className="text-muted-foreground text-sm mt-1">Thay đổi nội dung hiển thị trên banner hero</p>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => window.open("/", "_blank")}>
              <Eye className="w-4 h-4 mr-2" /> Xem trước
            </Button>
            <Button className="brand-gradient border-none" onClick={handleSave} disabled={updateSettings.isPending}>
              <Save className="w-4 h-4 mr-2" />
              {updateSettings.isPending ? "Đang lưu..." : saved ? "Đã lưu!" : "Lưu thay đổi"}
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-16 rounded-xl" />)}
          </div>
        ) : (
          <div className="grid lg:grid-cols-2 gap-8">
            {/* Form */}
            <div className="space-y-5">
              <div className="bg-white rounded-xl border border-border/50 p-6 space-y-5">
                <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">Nội dung Banner</h2>

                <div>
                  <Label>Badge text (dòng nhỏ trên tiêu đề)</Label>
                  <Input value={banner.badgeText ?? ""} onChange={e => set("badgeText", e.target.value)} placeholder="VD: Tin tưởng bởi 500+ doanh nghiệp..." className="mt-1.5" />
                </div>

                <div>
                  <Label>Tiêu đề chính</Label>
                  <Textarea value={banner.heading ?? ""} onChange={e => set("heading", e.target.value)} placeholder="Thuyết trình đỉnh cao&#10;Chốt sale hoàn hảo" className="mt-1.5 font-semibold" rows={3} />
                  <p className="text-xs text-muted-foreground mt-1">Xuống dòng để tạo line break. Từ cuối dòng 1 sẽ được tô màu gradient.</p>
                </div>

                <div>
                  <Label>Mô tả phụ</Label>
                  <Textarea value={banner.subheading ?? ""} onChange={e => set("subheading", e.target.value)} placeholder="Mô tả ngắn về sản phẩm..." className="mt-1.5" rows={3} />
                </div>
              </div>

              <div className="bg-white rounded-xl border border-border/50 p-6 space-y-5">
                <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">Nút kêu gọi hành động</h2>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Nút chính (text)</Label>
                    <Input value={banner.ctaText ?? ""} onChange={e => set("ctaText", e.target.value)} placeholder="Khám phá Template" className="mt-1.5" />
                  </div>
                  <div>
                    <Label>Nút chính (URL)</Label>
                    <Input value={banner.ctaUrl ?? ""} onChange={e => set("ctaUrl", e.target.value)} placeholder="/templates" className="mt-1.5" />
                  </div>
                </div>

                <div>
                  <Label>Nút phụ (text)</Label>
                  <Input value={banner.ctaSecondaryText ?? ""} onChange={e => set("ctaSecondaryText", e.target.value)} placeholder="Đặt thiết kế riêng" className="mt-1.5" />
                </div>
              </div>

              <div className="bg-white rounded-xl border border-border/50 p-6 space-y-4">
                <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">Hình nền (tùy chọn)</h2>
                <div>
                  <Label>URL hình nền</Label>
                  <Input value={banner.bgImageUrl ?? ""} onChange={e => set("bgImageUrl", e.target.value)} placeholder="https://... hoặc /api/uploads/..." className="mt-1.5" />
                </div>
                <div>
                  <Label className="block mb-1.5">Hoặc tải ảnh lên</Label>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <Button type="button" variant="outline" size="sm" disabled={uploading} onClick={() => document.getElementById("bg-upload")?.click()}>
                      <Upload className="w-4 h-4 mr-2" />
                      {uploading ? "Đang tải..." : "Chọn ảnh"}
                    </Button>
                    <span className="text-xs text-muted-foreground">JPG, PNG, WebP — tối đa 10MB</span>
                    <input id="bg-upload" type="file" accept="image/*" className="hidden" onChange={handleUploadBg} />
                  </label>
                  {banner.bgImageUrl && (
                    <img src={banner.bgImageUrl} alt="Background preview" className="mt-3 w-full aspect-video object-cover rounded-lg border" />
                  )}
                </div>
              </div>
            </div>

            {/* Live Preview */}
            <div className="lg:sticky lg:top-8 h-fit">
              <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider mb-3">Xem trước</h2>
              <div
                className="relative overflow-hidden rounded-2xl bg-slate-900 text-white p-8 min-h-[300px] flex flex-col items-center justify-center text-center"
                style={banner.bgImageUrl ? { backgroundImage: `url(${banner.bgImageUrl})`, backgroundSize: "cover", backgroundPosition: "center" } : {}}
              >
                {banner.bgImageUrl && <div className="absolute inset-0 bg-slate-900/60" />}
                <div className="relative z-10">
                  {banner.badgeText && (
                    <div className="inline-flex items-center gap-2 bg-white/10 rounded-full px-4 py-1.5 text-xs mb-4 backdrop-blur-sm">
                      {banner.badgeText}
                    </div>
                  )}
                  <h2 className="text-2xl font-extrabold leading-tight mb-3">
                    {(banner.heading ?? "").split("\n").map((line, i, arr) => (
                      <span key={i}>
                        {i === arr.length - 1 ? <span className="brand-gradient-text">{line}</span> : line}
                        {i < arr.length - 1 && <br />}
                      </span>
                    ))}
                  </h2>
                  {banner.subheading && (
                    <p className="text-slate-300 text-sm mb-6 max-w-sm mx-auto">{banner.subheading}</p>
                  )}
                  <div className="flex gap-3 justify-center flex-wrap">
                    {banner.ctaText && (
                      <div className="brand-gradient text-white px-5 py-2 rounded-full text-sm font-semibold">
                        {banner.ctaText}
                      </div>
                    )}
                    {banner.ctaSecondaryText && (
                      <div className="border border-white/30 text-white px-5 py-2 rounded-full text-sm">
                        {banner.ctaSecondaryText}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
