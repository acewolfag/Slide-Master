import { useState } from "react";
import { Layout } from "@/components/layout";
import { TemplateCard } from "@/components/template-card";
import { useListTemplates, useListCategories, useListTags, useAddToCart, getGetCartQueryKey } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useLocation } from "wouter";
import { Filter, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

export default function Templates() {
  const [location] = useLocation();
  const queryParams = new URLSearchParams(window.location.search);
  const initialCategory = queryParams.get("category") || undefined;
  const initialSort = queryParams.get("sort") || "newest";
  const initialSearch = queryParams.get("q") || undefined;

  const [category, setCategory] = useState<string | undefined>(initialCategory);
  const [sort, setSort] = useState<string>(initialSort);
  const [search, setSearch] = useState<string | undefined>(initialSearch);

  const { data: templatesData, isLoading } = useListTemplates({
    category,
    sort: sort as any,
    search
  });

  const { data: categories } = useListCategories();
  const { data: tags } = useListTags();
  
  const addToCart = useAddToCart();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const handleAddToCart = (id: number) => {
    addToCart.mutate({ data: { templateId: id } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetCartQueryKey() });
        toast({ title: "Đã thêm vào giỏ hàng" });
      }
    });
  };

  const SidebarContent = () => (
    <div className="space-y-6">
      <div>
        <h3 className="font-semibold mb-3">Danh mục</h3>
        <div className="space-y-2">
          <Button 
            variant={!category ? "secondary" : "ghost"} 
            className="w-full justify-start"
            onClick={() => setCategory(undefined)}
          >
            Tất cả
          </Button>
          {categories?.map(c => (
            <Button 
              key={c.id}
              variant={category === c.slug ? "secondary" : "ghost"} 
              className="w-full justify-start"
              onClick={() => setCategory(c.slug)}
            >
              {c.nameVi}
              <span className="ml-auto text-xs text-muted-foreground">{c.templateCount}</span>
            </Button>
          ))}
        </div>
      </div>

      <div>
        <h3 className="font-semibold mb-3">Thẻ (Tags)</h3>
        <div className="flex flex-wrap gap-2">
          {tags?.map(t => (
            <Badge key={t.id} variant="outline" className="cursor-pointer hover:bg-secondary">
              {t.name}
            </Badge>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8">
        {search && (
          <div className="mb-8">
            <h1 className="text-3xl font-bold">Kết quả tìm kiếm cho "{search}"</h1>
          </div>
        )}
        {!search && (
          <div className="mb-8 bg-slate-50 p-8 rounded-2xl brand-gradient text-white">
            <h1 className="text-4xl font-bold mb-2">Thư viện Template</h1>
            <p className="text-white/80 max-w-2xl">
              Khám phá bộ sưu tập template PowerPoint chất lượng cao, giúp bài thuyết trình của bạn nổi bật hơn bao giờ hết.
            </p>
          </div>
        )}

        <div className="flex flex-col md:flex-row gap-8">
          {/* Desktop Sidebar */}
          <aside className="hidden md:block w-64 flex-shrink-0">
            <div className="sticky top-24">
              <SidebarContent />
            </div>
          </aside>

          {/* Main Content */}
          <div className="flex-1">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <Sheet>
                  <SheetTrigger asChild>
                    <Button variant="outline" size="sm" className="md:hidden">
                      <Filter className="w-4 h-4 mr-2" />
                      Lọc
                    </Button>
                  </SheetTrigger>
                  <SheetContent side="left">
                    <div className="mt-8">
                      <SidebarContent />
                    </div>
                  </SheetContent>
                </Sheet>
                <span className="text-sm text-muted-foreground">
                  {templatesData?.total || 0} kết quả
                </span>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground hidden sm:inline">Sắp xếp:</span>
                <Select value={sort} onValueChange={setSort}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Sắp xếp theo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="newest">Mới nhất</SelectItem>
                    <SelectItem value="best-seller">Bán chạy nhất</SelectItem>
                    <SelectItem value="price-asc">Giá: Thấp đến cao</SelectItem>
                    <SelectItem value="price-desc">Giá: Cao xuống thấp</SelectItem>
                    <SelectItem value="top-rated">Đánh giá cao</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {isLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {[1, 2, 3, 4, 5, 6].map(i => (
                  <div key={i} className="space-y-3">
                    <Skeleton className="w-full aspect-[16/9] rounded-xl" />
                    <Skeleton className="w-2/3 h-5" />
                    <Skeleton className="w-1/2 h-4" />
                  </div>
                ))}
              </div>
            ) : templatesData?.items.length === 0 ? (
              <div className="text-center py-20">
                <div className="w-16 h-16 mx-auto bg-muted rounded-full flex items-center justify-center mb-4">
                  <Search className="w-8 h-8 text-muted-foreground" />
                </div>
                <h3 className="text-xl font-semibold mb-2">Không tìm thấy template</h3>
                <p className="text-muted-foreground">Thử thay đổi bộ lọc hoặc từ khóa tìm kiếm</p>
                <Button 
                  variant="outline" 
                  className="mt-6"
                  onClick={() => {
                    setCategory(undefined);
                    setSearch(undefined);
                  }}
                >
                  Xóa bộ lọc
                </Button>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {templatesData?.items.map(template => (
                    <TemplateCard 
                      key={template.id} 
                      template={template} 
                      onAddToCart={handleAddToCart}
                    />
                  ))}
                </div>
                
                {/* Pagination (simplified) */}
                {templatesData && templatesData.total > templatesData.limit && (
                  <div className="mt-10 flex justify-center">
                    <Button variant="outline">Tải thêm</Button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
