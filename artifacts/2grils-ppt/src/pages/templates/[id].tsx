import { Layout } from "@/components/layout";
import { useParams, Link } from "wouter";
import { 
  useGetTemplate, 
  getGetTemplateQueryKey,
  useAddToCart,
  getGetCartQueryKey,
  useListTemplateReviews,
  useGetRelatedTemplates
} from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Star, ShoppingCart, Download, Check, MonitorPlay, Layers, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { TemplateCard } from "@/components/template-card";
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb";

export default function TemplateDetail() {
  const params = useParams();
  const id = Number(params.id);
  
  const { data: template, isLoading } = useGetTemplate(id, {
    query: { enabled: !!id, queryKey: getGetTemplateQueryKey(id) }
  });

  const { data: reviews } = useListTemplateReviews(id, {
    query: { enabled: !!id }
  });

  const { data: related } = useGetRelatedTemplates(id, {
    query: { enabled: !!id }
  });

  const addToCart = useAddToCart();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const handleAddToCart = () => {
    if (!template) return;
    addToCart.mutate({ data: { templateId: template.id } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetCartQueryKey() });
        toast({ title: "Đã thêm vào giỏ hàng" });
      }
    });
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(price);
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-8">
          <Skeleton className="w-1/3 h-6 mb-8" />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
            <div className="lg:col-span-2 space-y-6">
              <Skeleton className="w-full aspect-[16/9] rounded-xl" />
              <div className="grid grid-cols-4 gap-4">
                <Skeleton className="w-full aspect-[16/9] rounded-lg" />
                <Skeleton className="w-full aspect-[16/9] rounded-lg" />
              </div>
            </div>
            <div className="space-y-6">
              <Skeleton className="w-full h-10" />
              <Skeleton className="w-1/2 h-8" />
              <Skeleton className="w-full h-40" />
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  if (!template) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-20 text-center">
          <h2 className="text-2xl font-bold mb-4">Không tìm thấy Template</h2>
          <Link href="/templates">
            <Button>Quay lại thư viện</Button>
          </Link>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="bg-slate-50 py-4 border-b">
        <div className="container mx-auto px-4">
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink href="/">Trang chủ</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbLink href="/templates">Templates</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>{template.titleVi}</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12 mb-16">
          {/* Left: Images */}
          <div className="lg:col-span-2 space-y-4">
            <div className="aspect-[16/9] rounded-xl overflow-hidden bg-slate-100 border border-border/50">
              <img 
                src={template.thumbnailUrl} 
                alt={template.titleVi}
                className="w-full h-full object-cover"
              />
            </div>
            <div className="grid grid-cols-4 gap-4">
              <div className="aspect-[16/9] rounded-lg overflow-hidden border-2 border-primary">
                <img src={template.thumbnailUrl} alt="Thumbnail" className="w-full h-full object-cover" />
              </div>
              {template.previewImages?.slice(0, 3).map((img, idx) => (
                <div key={idx} className="aspect-[16/9] rounded-lg overflow-hidden border border-border/50 cursor-pointer hover:border-primary/50 transition-colors">
                  <img src={img} alt={`Preview ${idx + 1}`} className="w-full h-full object-cover" />
                </div>
              ))}
            </div>
          </div>

          {/* Right: Info */}
          <div className="space-y-8">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Badge variant="outline" className="text-xs uppercase tracking-wider">{template.categoryName}</Badge>
                {template.isBestSeller && <Badge className="bg-yellow-500 hover:bg-yellow-600 border-none text-white">Best Seller</Badge>}
              </div>
              <h1 className="text-3xl font-bold mb-4 leading-tight">{template.titleVi}</h1>
              
              <div className="flex items-center gap-4 text-sm text-muted-foreground mb-6">
                <div className="flex items-center text-yellow-500 font-medium">
                  <Star className="w-4 h-4 fill-current mr-1" />
                  <span className="text-slate-900">{template.avgRating.toFixed(1)}</span>
                  <span className="text-muted-foreground ml-1">({template.reviewCount} đánh giá)</span>
                </div>
                <span>&bull;</span>
                <span>{template.salesCount} lượt bán</span>
              </div>

              <div className="text-4xl font-extrabold text-primary mb-6">
                {template.isFree ? "Miễn phí" : formatPrice(template.price)}
              </div>

              <div className="space-y-3 mb-8">
                <Button 
                  size="lg" 
                  className="w-full h-14 text-base rounded-xl brand-gradient border-none shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 transition-all"
                  onClick={handleAddToCart}
                >
                  <ShoppingCart className="w-5 h-5 mr-2" />
                  Thêm vào giỏ hàng
                </Button>
                {/* <Link href="/checkout">
                  <Button size="lg" variant="outline" className="w-full h-14 text-base rounded-xl border-2">
                    Mua ngay
                  </Button>
                </Link> */}
              </div>

              <div className="bg-slate-50 rounded-xl p-6 border border-slate-100">
                <h3 className="font-semibold mb-4 text-slate-900">Chi tiết Template</h3>
                <ul className="space-y-3 text-sm">
                  <li className="flex items-center text-slate-600">
                    <Layers className="w-4 h-4 mr-3 text-primary" />
                    <span><strong className="text-slate-900">{template.slideCount}</strong> slides độc đáo</span>
                  </li>
                  <li className="flex items-center text-slate-600">
                    <MonitorPlay className="w-4 h-4 mr-3 text-primary" />
                    <span>Tỷ lệ <strong className="text-slate-900">{template.aspectRatio}</strong> (Widescreen)</span>
                  </li>
                  <li className="flex items-center text-slate-600">
                    <Check className="w-4 h-4 mr-3 text-primary" />
                    <span>Dễ dàng thay đổi màu sắc</span>
                  </li>
                  <li className="flex items-center text-slate-600">
                    <Check className="w-4 h-4 mr-3 text-primary" />
                    <span>Placeholder ảnh sẵn có</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="mb-20">
          <Tabs defaultValue="description" className="w-full">
            <TabsList className="w-full justify-start border-b rounded-none h-auto p-0 bg-transparent mb-8">
              <TabsTrigger 
                value="description" 
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-6 py-3 text-base"
              >
                Mô tả
              </TabsTrigger>
              <TabsTrigger 
                value="reviews" 
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-6 py-3 text-base"
              >
                Đánh giá ({template.reviewCount})
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="description" className="max-w-4xl prose prose-slate">
              <div dangerouslySetInnerHTML={{ __html: template.descriptionVi || "<p>Chưa có mô tả chi tiết.</p>" }} />
              
              {template.features && template.features.length > 0 && (
                <div className="mt-8">
                  <h3>Tính năng nổi bật</h3>
                  <ul>
                    {template.features.map((feature, idx) => (
                      <li key={idx}>{feature}</li>
                    ))}
                  </ul>
                </div>
              )}
            </TabsContent>
            
            <TabsContent value="reviews">
              {reviews?.items.length === 0 ? (
                <p className="text-muted-foreground py-8">Chưa có đánh giá nào cho template này.</p>
              ) : (
                <div className="space-y-8 max-w-4xl">
                  {reviews?.items.map(review => (
                    <div key={review.id} className="border-b pb-6 last:border-0">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-semibold">{review.authorName}</span>
                        <span className="text-sm text-muted-foreground">
                          {new Date(review.createdAt).toLocaleDateString('vi-VN')}
                        </span>
                      </div>
                      <div className="flex items-center text-yellow-500 mb-3">
                        {[1,2,3,4,5].map(star => (
                          <Star key={star} className={`w-4 h-4 ${star <= review.rating ? "fill-current" : "text-slate-300"}`} />
                        ))}
                      </div>
                      <p className="text-slate-700">{review.comment}</p>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>

        {/* Related */}
        {related && related.length > 0 && (
          <section className="pt-16 border-t">
            <h2 className="text-2xl font-bold mb-8">Có thể bạn sẽ thích</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {related.slice(0, 4).map(rel => (
                <TemplateCard key={rel.id} template={rel} onAddToCart={handleAddToCart} />
              ))}
            </div>
          </section>
        )}
      </div>
    </Layout>
  );
}
