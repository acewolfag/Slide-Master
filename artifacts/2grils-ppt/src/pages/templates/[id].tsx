import { Layout } from "@/components/layout";
import { useParams, Link } from "wouter";
import { useState, useRef } from "react";
import {
  useGetTemplate,
  getGetTemplateQueryKey,
  useAddToCart,
  getGetCartQueryKey,
  useListTemplateReviews,
  getListTemplateReviewsQueryKey,
  useGetRelatedTemplates,
  customFetch,
} from "@workspace/api-client-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Star, ShoppingCart, Download, Check, MonitorPlay, Layers, ChevronRight, ChevronLeft, ImageIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { TemplateCard } from "@/components/template-card";
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb";

interface PublicCriteria {
  id: number;
  slug: string;
  labelVi: string;
  labelEn: string | null;
}

function PreviewGallery({
  thumbnailUrl,
  previewImages,
  alt,
}: {
  thumbnailUrl: string;
  previewImages: string[];
  alt: string;
}) {
  // Dedupe — backend đôi khi vẫn để slide 1 trùng với thumbnail.
  const items = Array.from(
    new Set([thumbnailUrl, ...previewImages].filter((u): u is string => !!u)),
  );

  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const stripRef = useRef<HTMLDivElement>(null);

  const heroIdx = hoveredIdx ?? 0;
  const heroSrc = items[heroIdx];

  const scroll = (dir: -1 | 1) => {
    stripRef.current?.scrollBy({ left: dir * 280, behavior: "smooth" });
  };

  // Hero placeholder khi template chưa có ảnh nào.
  if (items.length === 0) {
    return (
      <div className="space-y-4">
        <div className="aspect-[16/9] rounded-xl bg-slate-100 border border-dashed border-border/50 flex flex-col items-center justify-center text-slate-400 gap-2">
          <ImageIcon className="w-12 h-12" />
          <span className="text-sm">Chưa có hình preview</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Hero: đổi theo tile đang hover, mouse-leave trả về thumbnail gốc (index 0). */}
      <div className="aspect-[16/9] rounded-xl overflow-hidden bg-slate-100 border border-border/50">
        <img
          key={heroSrc}
          src={heroSrc}
          alt={alt}
          className="w-full h-full object-cover transition-opacity duration-200 animate-in fade-in"
        />
      </div>

      {/* Strip + nav buttons */}
      <div className="relative group">
        {items.length > 4 && (
          <>
            <button
              type="button"
              onClick={() => scroll(-1)}
              aria-label="Cuộn trái"
              className="absolute left-1 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full bg-white/90 backdrop-blur shadow-md border border-border/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => scroll(1)}
              aria-label="Cuộn phải"
              className="absolute right-1 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full bg-white/90 backdrop-blur shadow-md border border-border/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </>
        )}

        <div
          ref={stripRef}
          className="flex gap-3 overflow-x-auto scroll-smooth pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {items.map((img, idx) => {
            const isActive = idx === heroIdx;
            return (
              <button
                key={`${img}-${idx}`}
                type="button"
                onMouseEnter={() => setHoveredIdx(idx)}
                onMouseLeave={() => setHoveredIdx(null)}
                onFocus={() => setHoveredIdx(idx)}
                onBlur={() => setHoveredIdx(null)}
                aria-label={idx === 0 ? "Ảnh đại diện" : `Xem preview ${idx}`}
                className={`flex-shrink-0 w-32 sm:w-36 aspect-[16/9] rounded-lg overflow-hidden bg-slate-100 border-2 transition-all ${
                  isActive
                    ? "border-primary ring-2 ring-primary/20"
                    : "border-border/50 hover:border-primary/50"
                }`}
              >
                <img
                  src={img}
                  alt={idx === 0 ? "Thumbnail" : `Preview ${idx}`}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function ReviewForm({ templateId }: { templateId: number }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [tags, setTags] = useState<Set<string>>(new Set());

  const { data: criteria } = useQuery<PublicCriteria[]>({
    queryKey: ["public", "review-criteria"],
    queryFn: () => customFetch<PublicCriteria[]>("/api/review-criteria"),
  });

  const submit = useMutation({
    mutationFn: () =>
      customFetch(`/api/templates/${templateId}/reviews`, {
        method: "POST",
        body: JSON.stringify({ rating, comment, criteriaTags: Array.from(tags) }),
      }),
    onSuccess: () => {
      toast({ title: "Cảm ơn bạn đã đánh giá!" });
      setComment("");
      setRating(5);
      setTags(new Set());
      queryClient.invalidateQueries({ queryKey: getListTemplateReviewsQueryKey(templateId) });
    },
    onError: (e: any) => toast({ title: "Lỗi", description: e?.message, variant: "destructive" }),
  });

  // Tags are independent from the comment — clicking just toggles selection.
  // The comment textarea is fully user-controlled and never modified here.
  const toggleTag = (slug: string) => {
    setTags((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
  };

  return (
    <div className="mb-8 bg-slate-50 rounded-xl p-5 space-y-4">
      <h3 className="font-semibold text-lg">Viết đánh giá của bạn</h3>
      <div>
        <div className="text-sm mb-1.5 text-slate-600">Số sao</div>
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setRating(n)}
              className="text-amber-500 hover:scale-110 transition-transform"
              aria-label={`${n} sao`}
            >
              <Star className={`w-7 h-7 ${n <= rating ? "fill-current" : "text-slate-300"}`} />
            </button>
          ))}
        </div>
      </div>

      <Textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="Chia sẻ cảm nhận của bạn về template này..."
        className="bg-white"
        rows={4}
      />

      {criteria && criteria.length > 0 && (
        <div>
          <div className="text-sm mb-2 text-slate-600">
            Tiêu chí <span className="text-xs text-slate-400">— chọn các điểm bạn ấn tượng (không bắt buộc)</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {criteria.map((c) => (
              <button
                key={c.slug}
                type="button"
                onClick={() => toggleTag(c.slug)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                  tags.has(c.slug)
                    ? "bg-primary text-white border-primary"
                    : "bg-white text-slate-700 border-slate-300 hover:border-primary"
                }`}
              >
                {tags.has(c.slug) && <Check className="w-3 h-3 inline mr-1" />}
                {c.labelVi}
              </button>
            ))}
          </div>
        </div>
      )}

      <Button
        onClick={() => submit.mutate()}
        disabled={!comment.trim() || submit.isPending}
        className="brand-gradient border-none"
      >
        {submit.isPending ? "Đang gửi..." : "Gửi đánh giá"}
      </Button>
    </div>
  );
}

export default function TemplateDetail() {
  const params = useParams();
  const id = Number(params.id);
  
  const { data: template, isLoading } = useGetTemplate(id, {
    query: { enabled: !!id, queryKey: getGetTemplateQueryKey(id) }
  });

  const { data: reviews } = useListTemplateReviews(id, {
    query: { enabled: !!id } as any
  });

  const { data: publicCriteria } = useQuery<PublicCriteria[]>({
    queryKey: ["public", "review-criteria"],
    queryFn: () => customFetch<PublicCriteria[]>("/api/review-criteria"),
  });
  const criteriaLabel = (slug: string) =>
    publicCriteria?.find((c) => c.slug === slug)?.labelVi ?? slug;

  const { data: related } = useGetRelatedTemplates(id, {
    query: { enabled: !!id } as any
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
          <div className="lg:col-span-2">
            <PreviewGallery
              thumbnailUrl={template.thumbnailUrl}
              previewImages={template.previewImages ?? []}
              alt={template.titleVi}
            />
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
              <div className="max-w-4xl">
                <ReviewForm templateId={id} />
                {reviews?.items.length === 0 ? (
                  <p className="text-muted-foreground py-8">Chưa có đánh giá nào cho template này.</p>
                ) : (
                  <div className="space-y-8">
                    {reviews?.items.map((review) => {
                      const tags = (review as any).criteriaTags as string[] | undefined;
                      return (
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
                          {tags && tags.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 mt-3">
                              {tags.map((t) => (
                                <span key={t} className="text-xs bg-green-100 text-green-700 rounded-full px-2.5 py-1">
                                  ✓ {criteriaLabel(t)}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
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
