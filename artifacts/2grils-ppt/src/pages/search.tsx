import { Layout } from "@/components/layout";
import { useSearch } from "wouter";
import { useListTemplates, getListTemplatesQueryKey } from "@workspace/api-client-react";
import { TemplateCard } from "@/components/template-card";
import { Skeleton } from "@/components/ui/skeleton";
import { Search } from "lucide-react";

export default function SearchPage() {
  const search = useSearch();
  const params = new URLSearchParams(search);
  const q = params.get("q") ?? "";

  const { data, isLoading } = useListTemplates(
    { search: q },
    { query: { enabled: !!q, queryKey: getListTemplatesQueryKey({ search: q }) } }
  );

  return (
    <Layout>
      <div className="bg-slate-50 min-h-screen py-12">
        <div className="container mx-auto px-4">
          <div className="mb-8">
            <h1 className="text-2xl font-bold mb-1">
              {q ? `Kết quả tìm kiếm cho "${q}"` : "Tìm kiếm template"}
            </h1>
            {data && <p className="text-muted-foreground text-sm">Tìm thấy {(data as any).total ?? 0} kết quả</p>}
          </div>

          {!q && (
            <div className="text-center py-20 text-muted-foreground">
              <Search className="w-16 h-16 mx-auto mb-4 opacity-20" />
              <p className="text-lg">Nhập từ khóa để tìm kiếm template</p>
            </div>
          )}

          {isLoading && q && (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {[1,2,3,4].map(i => (
                <div key={i} className="space-y-3">
                  <Skeleton className="w-full aspect-[16/9] rounded-xl" />
                  <Skeleton className="w-2/3 h-5" />
                  <Skeleton className="w-1/3 h-4" />
                </div>
              ))}
            </div>
          )}

          {!isLoading && q && (data as any)?.items?.length === 0 && (
            <div className="text-center py-20 text-muted-foreground">
              <Search className="w-16 h-16 mx-auto mb-4 opacity-20" />
              <p className="text-lg">Không tìm thấy kết quả nào cho "{q}"</p>
              <p className="text-sm mt-2">Thử tìm với từ khóa khác</p>
            </div>
          )}

          {!isLoading && q && (data as any)?.items?.length > 0 && (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {(data as any).items.map((t: any) => <TemplateCard key={t.id} template={t} />)}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
