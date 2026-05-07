import { Layout } from "@/components/layout";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowRight, CheckCircle, Clock, Palette, Star, MessageSquare, Zap } from "lucide-react";
import { useListServicePricing } from "@workspace/api-client-react";

const STEPS = [
  { icon: MessageSquare, title: "Tư vấn yêu cầu", desc: "Điền form mô tả nhu cầu của bạn. Chúng tôi sẽ phản hồi trong 2 giờ." },
  { icon: Palette, title: "Báo giá & Phác thảo", desc: "Đội ngũ thiết kế gửi báo giá và concept trong 24 giờ." },
  { icon: Zap, title: "Thiết kế & Phản hồi", desc: "Bạn nhận bản thảo và góp ý tối đa 3 lần chỉnh sửa miễn phí." },
  { icon: CheckCircle, title: "Bàn giao file gốc", desc: "Nhận file PPTX gốc, font chữ và tất cả tài nguyên thiết kế." },
];

const FAQ = [
  { q: "Thời gian giao hàng là bao lâu?", a: "Từ 3-7 ngày làm việc tùy gói dịch vụ. Có thể giao nhanh hơn nếu bạn có deadline gấp (phụ phí áp dụng)." },
  { q: "Tôi cần chuẩn bị gì?", a: "Nội dung text, logo, màu sắc thương hiệu (nếu có) và mô tả về đối tượng nghe. Chúng tôi sẽ hướng dẫn bạn qua form đặt hàng." },
  { q: "Có thể chỉnh sửa sau khi nhận file không?", a: "Có! File PPTX gốc hoàn toàn có thể chỉnh sửa. Chúng tôi cũng cung cấp hỗ trợ 30 ngày sau bàn giao." },
  { q: "Tôi có thể xem portfolio không?", a: "Tất nhiên! Liên hệ qua fanpage để xem thêm các dự án đã thực hiện." },
];

export default function CustomDesign() {
  const { data: plans, isLoading } = useListServicePricing();

  return (
    <Layout>
      {/* Hero */}
      <section className="relative overflow-hidden py-24 bg-slate-900 text-white">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-secondary/20" />
        <div className="container mx-auto px-4 relative z-10">
          <div className="max-w-3xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 bg-white/10 rounded-full px-4 py-1.5 text-sm mb-6 backdrop-blur-sm">
              <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
              Tin tưởng bởi 500+ doanh nghiệp Việt Nam
            </div>
            <h1 className="text-4xl md:text-6xl font-extrabold mb-6 leading-tight">
              Thiết kế PPT <span className="brand-gradient-text">riêng của bạn</span>
            </h1>
            <p className="text-xl text-slate-300 mb-10">
              Đội ngũ designer chuyên nghiệp tạo ra slide thuyết trình độc đáo, phản ánh chính xác thương hiệu và thông điệp của bạn.
            </p>
            <Link href="/custom-design/request">
              <Button size="lg" className="brand-gradient border-none h-14 px-10 text-base rounded-full shadow-lg">
                Đặt thiết kế ngay
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Process */}
      <section className="py-20 bg-white">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-4">Quy trình làm việc</h2>
          <p className="text-muted-foreground text-center mb-12">Đơn giản, minh bạch và chuyên nghiệp</p>
          <div className="grid md:grid-cols-4 gap-8 relative">
            {STEPS.map((step, i) => (
              <div key={i} className="text-center relative">
                <div className="w-16 h-16 rounded-2xl brand-gradient flex items-center justify-center mx-auto mb-4 shadow-lg shadow-primary/20">
                  <step.icon className="w-8 h-8 text-white" />
                </div>
                <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-7 h-7 rounded-full bg-primary text-white text-xs font-bold flex items-center justify-center shadow">
                  {i + 1}
                </div>
                <h3 className="font-bold text-lg mb-2">{step.title}</h3>
                <p className="text-muted-foreground text-sm">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="py-20 bg-slate-50">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-4">Bảng giá tham khảo</h2>
          <p className="text-muted-foreground text-center mb-12">Giá cuối cùng sẽ được báo sau khi tư vấn chi tiết</p>
          <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {isLoading ? (
              [1, 2, 3].map(i => <Skeleton key={i} className="h-96 rounded-xl" />)
            ) : (
              (plans as any[] | undefined)?.map((plan: any, i: number) => (
                <Card key={plan.id} className={`relative overflow-hidden ${plan.isHighlight ? "border-primary shadow-lg shadow-primary/10 scale-105" : "border-border/50"}`}>
                  {plan.isHighlight && (
                    <div className="brand-gradient text-white text-xs font-bold text-center py-1.5">
                      PHỔ BIẾN NHẤT
                    </div>
                  )}
                  <CardContent className="p-6">
                    <h3 className="text-xl font-bold mb-1">{plan.name}</h3>
                    <p className="text-muted-foreground text-sm mb-4">{plan.slides}</p>
                    <div className="mb-4">
                      <span className="text-3xl font-extrabold text-primary">{Number(plan.price).toLocaleString("vi-VN")}</span>
                      <span className="text-sm text-muted-foreground ml-1">VND</span>
                    </div>
                    <div className="space-y-2 mb-4 text-sm text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-primary" />
                        Giao trong {plan.deliveryDays} ngày
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-primary" />
                        Chỉnh sửa {plan.revisions}
                      </div>
                    </div>
                    <ul className="space-y-2 mb-6">
                      {(plan.features as string[]).map((f: string) => (
                        <li key={f} className="flex items-center gap-2 text-sm">
                          <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                          {f}
                        </li>
                      ))}
                    </ul>
                    <Link href="/custom-design/request">
                      <Button className={`w-full ${plan.isHighlight ? "brand-gradient border-none" : ""}`} variant={plan.isHighlight ? "default" : "outline"}>
                        Chọn gói này
                      </Button>
                    </Link>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-20 bg-white">
        <div className="container mx-auto px-4 max-w-3xl">
          <h2 className="text-3xl font-bold text-center mb-12">Câu hỏi thường gặp</h2>
          <div className="space-y-4">
            {FAQ.map((item, i) => (
              <div key={i} className="border border-border rounded-xl p-6">
                <h3 className="font-semibold mb-2">{item.q}</h3>
                <p className="text-muted-foreground text-sm">{item.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 brand-gradient text-white">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl font-extrabold mb-4">Sẵn sàng tạo slide đỉnh cao?</h2>
          <p className="text-white/80 mb-8 text-lg">Điền form trong 5 phút, nhận báo giá trong 2 giờ</p>
          <Link href="/custom-design/request">
            <Button size="lg" variant="secondary" className="h-14 px-10 text-base rounded-full bg-white text-primary hover:bg-white/90">
              Đặt thiết kế ngay
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </Link>
        </div>
      </section>
    </Layout>
  );
}
