import { Link } from "wouter";
import { ArrowRight, Zap, PenTool, Layout as LayoutIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Layout } from "@/components/layout";
import { TemplateCard } from "@/components/template-card";
import { useListFeaturedTemplates, useListBestSellerTemplates } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";

export default function Home() {
  const { data: featured, isLoading: loadingFeatured } = useListFeaturedTemplates();
  const { data: bestSellers, isLoading: loadingBestSellers } = useListBestSellerTemplates();

  return (
    <Layout>
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-slate-50 pt-20 pb-32">
        <div className="absolute inset-0 bg-[url('/noise.png')] opacity-[0.03] pointer-events-none mix-blend-multiply"></div>
        <div className="absolute top-0 right-0 -translate-y-12 translate-x-1/3 w-[800px] h-[800px] bg-primary/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute bottom-0 left-0 translate-y-1/3 -translate-x-1/3 w-[600px] h-[600px] bg-secondary/10 rounded-full blur-3xl pointer-events-none"></div>
        
        <div className="container mx-auto px-4 relative z-10">
          <div className="max-w-3xl mx-auto text-center">
            <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight text-slate-900 mb-6 leading-tight">
              Thuyết trình <span className="brand-gradient-text">đỉnh cao</span><br />
              Chốt sale hoàn hảo
            </h1>
            <p className="text-xl text-slate-600 mb-10 max-w-2xl mx-auto">
              Hàng ngàn template PowerPoint cao cấp được thiết kế bởi chuyên gia, giúp bạn tiết kiệm thời gian và tạo ấn tượng mạnh mẽ.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href="/templates">
                <Button size="lg" className="h-14 px-8 text-base rounded-full brand-gradient border-none w-full sm:w-auto shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 transition-all hover:-translate-y-0.5">
                  Khám phá Template
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
              <Link href="/custom-design">
                <Button size="lg" variant="outline" className="h-14 px-8 text-base rounded-full w-full sm:w-auto border-2 hover:bg-slate-100">
                  Đặt thiết kế riêng
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Featured Section */}
      <section className="py-20 bg-white">
        <div className="container mx-auto px-4">
          <div className="flex items-end justify-between mb-10">
            <div>
              <h2 className="text-3xl font-bold mb-2">Template Nổi Bật</h2>
              <p className="text-muted-foreground">Những thiết kế được yêu thích nhất tuần này</p>
            </div>
            <Link href="/templates?sort=top-rated">
              <Button variant="ghost" className="hidden sm:flex group">
                Xem tất cả <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
              </Button>
            </Link>
          </div>

          {loadingFeatured ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="space-y-3">
                  <Skeleton className="w-full aspect-[16/9] rounded-xl" />
                  <Skeleton className="w-2/3 h-5" />
                  <Skeleton className="w-1/2 h-4" />
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {featured?.slice(0, 4).map(template => (
                <TemplateCard key={template.id} template={template} />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Features */}
      <section className="py-24 bg-slate-50 border-y border-slate-100">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
            <div className="text-center">
              <div className="w-16 h-16 mx-auto bg-primary/10 rounded-2xl flex items-center justify-center mb-6 text-primary">
                <Zap className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-bold mb-3">Sẵn sàng sử dụng</h3>
              <p className="text-muted-foreground">Tải xuống và chỉnh sửa ngay lập tức. Tiết kiệm hàng giờ thiết kế cho bài thuyết trình của bạn.</p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 mx-auto bg-blue-500/10 rounded-2xl flex items-center justify-center mb-6 text-blue-600">
                <PenTool className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-bold mb-3">Dễ dàng tùy chỉnh</h3>
              <p className="text-muted-foreground">Master slide được thiết lập chuẩn, màu sắc và font chữ tự động cập nhật với 1 click.</p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 mx-auto bg-purple-500/10 rounded-2xl flex items-center justify-center mb-6 text-purple-600">
                <LayoutIcon className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-bold mb-3">Đa dạng chủ đề</h3>
              <p className="text-muted-foreground">Từ Marketing, Pitch Deck đến Portfolio. Chúng tôi có mọi thứ bạn cần cho mọi lĩnh vực.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Best Sellers Section */}
      <section className="py-20 bg-white">
        <div className="container mx-auto px-4">
          <div className="flex items-end justify-between mb-10">
            <div>
              <h2 className="text-3xl font-bold mb-2">Bán Chạy Nhất</h2>
              <p className="text-muted-foreground">Top lựa chọn của hàng ngàn khách hàng</p>
            </div>
            <Link href="/templates?sort=best-seller">
              <Button variant="ghost" className="hidden sm:flex group">
                Xem tất cả <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
              </Button>
            </Link>
          </div>

          {loadingBestSellers ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="space-y-3">
                  <Skeleton className="w-full aspect-[16/9] rounded-xl" />
                  <Skeleton className="w-2/3 h-5" />
                  <Skeleton className="w-1/2 h-4" />
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {bestSellers?.slice(0, 4).map(template => (
                <TemplateCard key={template.id} template={template} />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 relative overflow-hidden brand-gradient text-white">
        <div className="absolute inset-0 bg-[url('/noise.png')] opacity-10 pointer-events-none mix-blend-overlay"></div>
        <div className="container mx-auto px-4 relative z-10 text-center">
          <h2 className="text-4xl md:text-5xl font-bold mb-6">Bạn cần một thiết kế độc bản?</h2>
          <p className="text-lg text-white/80 mb-10 max-w-2xl mx-auto">
            Đội ngũ designer chuyên nghiệp của chúng tôi sẵn sàng hiện thực hóa ý tưởng của bạn thành bài thuyết trình đẳng cấp.
          </p>
          <Link href="/custom-design">
            <Button size="lg" variant="secondary" className="h-14 px-8 text-base rounded-full font-semibold text-primary hover:scale-105 transition-transform">
              Nhận báo giá ngay
            </Button>
          </Link>
        </div>
      </section>
    </Layout>
  );
}
