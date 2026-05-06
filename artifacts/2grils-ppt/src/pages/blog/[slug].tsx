import { Layout } from "@/components/layout";
import { Link, useParams } from "wouter";
import { useGetBlogPost, getGetBlogPostQueryKey } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, CalendarDays, User } from "lucide-react";

export default function BlogPost() {
  const { slug } = useParams<{ slug: string }>();
  const { data: post, isLoading } = useGetBlogPost(slug, {
    query: { enabled: !!slug, queryKey: getGetBlogPostQueryKey(slug) },
  });

  if (isLoading) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-16 max-w-3xl">
          <Skeleton className="w-full h-64 rounded-xl mb-8" />
          <Skeleton className="w-3/4 h-10 mb-4" />
          <Skeleton className="w-full h-4 mb-2" />
          <Skeleton className="w-full h-4 mb-2" />
          <Skeleton className="w-2/3 h-4" />
        </div>
      </Layout>
    );
  }

  if (!post) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-32 text-center">
          <p className="text-muted-foreground mb-4">Bài viết không tồn tại.</p>
          <Link href="/blog">
            <Button variant="outline">Quay lại Blog</Button>
          </Link>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <article className="py-16">
        <div className="container mx-auto px-4 max-w-3xl">
          <Link href="/blog">
            <Button variant="ghost" size="sm" className="mb-6 -ml-2">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Quay lại Blog
            </Button>
          </Link>

          <div className="flex gap-2 mb-4 flex-wrap">
            {post.tags?.map(tag => (
              <Badge key={tag} variant="secondary">{tag}</Badge>
            ))}
          </div>

          <h1 className="text-3xl md:text-4xl font-extrabold mb-6 leading-tight">{post.titleVi}</h1>

          <div className="flex items-center gap-6 text-sm text-muted-foreground mb-8 pb-8 border-b">
            <span className="flex items-center gap-2">
              <User className="w-4 h-4" />
              {post.author}
            </span>
            <span className="flex items-center gap-2">
              <CalendarDays className="w-4 h-4" />
              {new Date(post.publishedAt).toLocaleDateString("vi-VN", { year: "numeric", month: "long", day: "numeric" })}
            </span>
          </div>

          {post.coverImageUrl && (
            <img
              src={post.coverImageUrl}
              alt={post.titleVi}
              className="w-full rounded-xl mb-8 aspect-[16/9] object-cover"
            />
          )}

          <div className="prose prose-slate max-w-none">
            {post.contentVi.split("\n").map((line, i) => {
              if (line.startsWith("## ")) return <h2 key={i} className="text-xl font-bold mt-6 mb-3">{line.slice(3)}</h2>;
              if (line.startsWith("# ")) return <h1 key={i} className="text-2xl font-bold mt-8 mb-4">{line.slice(2)}</h1>;
              if (line.trim() === "") return <br key={i} />;
              return <p key={i} className="text-slate-700 leading-relaxed mb-3">{line}</p>;
            })}
          </div>
        </div>
      </article>
    </Layout>
  );
}
