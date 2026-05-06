import { Layout } from "@/components/layout";
import { Link } from "wouter";
import { useListBlogPosts } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { CalendarDays, User } from "lucide-react";

export default function BlogList() {
  const { data: posts, isLoading } = useListBlogPosts();

  return (
    <Layout>
      <div className="bg-slate-50 py-16">
        <div className="container mx-auto px-4">
          <div className="max-w-2xl mx-auto text-center mb-12">
            <h1 className="text-4xl font-extrabold mb-4">Blog & Kiến Thức</h1>
            <p className="text-muted-foreground text-lg">
              Mẹo thuyết trình, hướng dẫn thiết kế và cảm hứng từ đội ngũ 2Grils.PPT
            </p>
          </div>
          {isLoading ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1,2,3].map(i => (
                <div key={i} className="space-y-3">
                  <Skeleton className="w-full h-48 rounded-xl" />
                  <Skeleton className="w-3/4 h-6" />
                  <Skeleton className="w-full h-4" />
                </div>
              ))}
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {posts?.map(post => (
                <Link key={post.id} href={`/blog/${post.slug}`}>
                  <article className="bg-white rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow cursor-pointer group border border-border/50">
                    <div className="aspect-[16/9] overflow-hidden">
                      <img
                        src={post.coverImageUrl}
                        alt={post.titleVi}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    </div>
                    <div className="p-5">
                      <div className="flex gap-2 mb-3 flex-wrap">
                        {post.tags?.slice(0, 2).map(tag => (
                          <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>
                        ))}
                      </div>
                      <h2 className="font-bold text-lg line-clamp-2 mb-2 group-hover:text-primary transition-colors">
                        {post.titleVi}
                      </h2>
                      <p className="text-muted-foreground text-sm line-clamp-2 mb-4">{post.excerptVi}</p>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <User className="w-3 h-3" />
                          {post.author}
                        </span>
                        <span className="flex items-center gap-1">
                          <CalendarDays className="w-3 h-3" />
                          {new Date(post.publishedAt).toLocaleDateString("vi-VN")}
                        </span>
                      </div>
                    </div>
                  </article>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
