import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useGetCurrentUser, customFetch } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { AdminLayout } from "./index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Switch } from "@/components/ui/switch";
import {
  Star,
  Search,
  EyeOff,
  Eye,
  Trash2,
  Tag as TagIcon,
  Plus,
  Pencil,
  X,
  ShieldAlert,
} from "lucide-react";

interface ReviewRow {
  id: number;
  templateId: number;
  templateTitle: string | null;
  userId: number | null;
  authorName: string;
  rating: number;
  comment: string;
  imageUrl: string | null;
  isVerifiedPurchase: boolean;
  isHidden: boolean;
  criteriaTags: string[];
  moderationTags: string[];
  createdAt: string;
}

interface ReviewListResponse {
  items: ReviewRow[];
  total: number;
  page: number;
  limit: number;
}

interface Criteria {
  id: number;
  slug: string;
  labelVi: string;
  labelEn: string | null;
  sortOrder: number;
  isActive: boolean;
}

interface ModerationTag {
  id: number;
  slug: string;
  labelVi: string;
  color: string;
  sortOrder: number;
  isActive: boolean;
}

const REVIEWS_KEY = ["admin", "reviews"] as const;
const CRITERIA_KEY = ["admin", "review-criteria"] as const;
const MOD_TAGS_KEY = ["admin", "moderation-tags"] as const;

const COLOR_CLASSES: Record<string, string> = {
  red: "bg-red-100 text-red-700 border-red-200",
  amber: "bg-amber-100 text-amber-700 border-amber-200",
  orange: "bg-orange-100 text-orange-700 border-orange-200",
  blue: "bg-blue-100 text-blue-700 border-blue-200",
  slate: "bg-slate-100 text-slate-700 border-slate-200",
  purple: "bg-purple-100 text-purple-700 border-purple-200",
  green: "bg-green-100 text-green-700 border-green-200",
};

function modTagColor(slug: string, tags: ModerationTag[]): string {
  const t = tags.find((m) => m.slug === slug);
  return COLOR_CLASSES[t?.color ?? "red"] ?? COLOR_CLASSES.red;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("vi-VN", { dateStyle: "short", timeStyle: "short" });
}

function Stars({ value }: { value: number }) {
  return (
    <span className="inline-flex items-center gap-0.5 text-amber-500">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          className={`w-3.5 h-3.5 ${n <= value ? "fill-current" : "text-slate-300"}`}
          strokeWidth={1.5}
        />
      ))}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Reviews tab
// ---------------------------------------------------------------------------

interface ReviewsFilters {
  rating: string;
  templateId: string;
  hidden: string;
  q: string;
  criteria: string;
  modTag: string;
}

function ReviewsTab({ criteria, modTags }: { criteria: Criteria[]; modTags: ModerationTag[] }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [filters, setFilters] = useState<ReviewsFilters>({
    rating: "all",
    templateId: "",
    hidden: "all",
    q: "",
    criteria: "all",
    modTag: "all",
  });
  const [debouncedQ, setDebouncedQ] = useState("");
  const [page, setPage] = useState(1);
  const [confirmDelete, setConfirmDelete] = useState<ReviewRow | null>(null);
  const [tagDialog, setTagDialog] = useState<ReviewRow | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(filters.q.trim()), 300);
    return () => clearTimeout(t);
  }, [filters.q]);

  useEffect(() => setPage(1), [filters.rating, filters.templateId, filters.hidden, debouncedQ, filters.criteria, filters.modTag]);

  const qs = useMemo(() => {
    const p = new URLSearchParams();
    if (filters.rating !== "all") p.set("rating", filters.rating);
    if (filters.templateId.trim()) p.set("templateId", filters.templateId.trim());
    if (filters.hidden !== "all") p.set("hidden", filters.hidden);
    if (debouncedQ) p.set("q", debouncedQ);
    if (filters.criteria !== "all") p.set("criteria", filters.criteria);
    if (filters.modTag !== "all") p.set("modTag", filters.modTag);
    p.set("page", String(page));
    p.set("limit", "20");
    return p.toString();
  }, [filters, debouncedQ, page]);

  const { data, isLoading } = useQuery<ReviewListResponse>({
    queryKey: [...REVIEWS_KEY, qs],
    queryFn: () => customFetch<ReviewListResponse>(`/api/admin/reviews?${qs}`),
  });

  const refetch = () => queryClient.invalidateQueries({ queryKey: REVIEWS_KEY });

  const hideMutation = useMutation({
    mutationFn: (id: number) =>
      customFetch(`/api/admin/reviews/${id}/hide`, { method: "PATCH" }),
    onSuccess: () => {
      refetch();
      toast({ title: "Đã ẩn review" });
    },
    onError: (e: any) => toast({ title: "Lỗi", description: e?.message, variant: "destructive" }),
  });

  const unhideMutation = useMutation({
    mutationFn: (id: number) =>
      customFetch(`/api/admin/reviews/${id}/unhide`, { method: "PATCH" }),
    onSuccess: () => {
      refetch();
      toast({ title: "Đã khôi phục review" });
    },
    onError: (e: any) => toast({ title: "Lỗi", description: e?.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) =>
      customFetch(`/api/admin/reviews/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      refetch();
      setConfirmDelete(null);
      toast({ title: "Đã xóa vĩnh viễn" });
    },
    onError: (e: any) => toast({ title: "Lỗi", description: e?.message, variant: "destructive" }),
  });

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / 20));

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-slate-200/70 p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-3">
        <div className="lg:col-span-2">
          <Label className="text-xs text-slate-500">Tìm kiếm</Label>
          <div className="relative mt-1">
            <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input
              value={filters.q}
              onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))}
              placeholder="Tìm trong comment hoặc tên..."
              className="pl-8"
            />
          </div>
        </div>
        <div>
          <Label className="text-xs text-slate-500">Số sao</Label>
          <Select
            value={filters.rating}
            onValueChange={(v) => setFilters((f) => ({ ...f, rating: v }))}
          >
            <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tất cả</SelectItem>
              {[5, 4, 3, 2, 1].map((s) => (
                <SelectItem key={s} value={String(s)}>{s} sao</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs text-slate-500">Trạng thái</Label>
          <Select value={filters.hidden} onValueChange={(v) => setFilters((f) => ({ ...f, hidden: v }))}>
            <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tất cả</SelectItem>
              <SelectItem value="false">Đang hiện</SelectItem>
              <SelectItem value="true">Đã ẩn</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs text-slate-500">Tiêu chí</Label>
          <Select value={filters.criteria} onValueChange={(v) => setFilters((f) => ({ ...f, criteria: v }))}>
            <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tất cả</SelectItem>
              {criteria.map((c) => (
                <SelectItem key={c.slug} value={c.slug}>{c.labelVi}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs text-slate-500">Tag moderation</Label>
          <Select value={filters.modTag} onValueChange={(v) => setFilters((f) => ({ ...f, modTag: v }))}>
            <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tất cả</SelectItem>
              {modTags.map((t) => (
                <SelectItem key={t.slug} value={t.slug}>{t.labelVi}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex items-center justify-between text-sm text-slate-600">
        <span>{isLoading ? "Đang tải..." : `${total} review`}</span>
        {totalPages > 1 && (
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              ←
            </Button>
            <span className="text-xs">Trang {page}/{totalPages}</span>
            <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
              →
            </Button>
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-32 w-full rounded-xl" />)}
        </div>
      ) : items.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200/70 p-12 text-center text-slate-500">
          Không có review nào khớp bộ lọc.
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((r) => (
            <ReviewCard
              key={r.id}
              row={r}
              criteria={criteria}
              modTags={modTags}
              onHide={() => hideMutation.mutate(r.id)}
              onUnhide={() => unhideMutation.mutate(r.id)}
              onAskDelete={() => setConfirmDelete(r)}
              onEditTags={() => setTagDialog(r)}
              busy={hideMutation.isPending || unhideMutation.isPending}
            />
          ))}
        </div>
      )}

      <AlertDialog open={confirmDelete !== null} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xóa vĩnh viễn review này?</AlertDialogTitle>
            <AlertDialogDescription>
              Hành động không thể hoàn tác. Review của <b>{confirmDelete?.authorName}</b> sẽ bị xóa khỏi DB.
              Nếu bạn chỉ muốn ẩn tạm thời, hãy dùng nút "Ẩn" thay vì xóa.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Hủy</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => confirmDelete && deleteMutation.mutate(confirmDelete.id)}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleteMutation.isPending ? "Đang xóa..." : "Xóa vĩnh viễn"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {tagDialog && (
        <ModTagDialog
          review={tagDialog}
          modTags={modTags}
          onClose={() => setTagDialog(null)}
          onSaved={refetch}
        />
      )}
    </div>
  );
}

function ReviewCard({
  row,
  criteria,
  modTags,
  onHide,
  onUnhide,
  onAskDelete,
  onEditTags,
  busy,
}: {
  row: ReviewRow;
  criteria: Criteria[];
  modTags: ModerationTag[];
  onHide: () => void;
  onUnhide: () => void;
  onAskDelete: () => void;
  onEditTags: () => void;
  busy: boolean;
}) {
  const criteriaLabel = (slug: string) =>
    criteria.find((c) => c.slug === slug)?.labelVi ?? slug;
  const modTagLabel = (slug: string) =>
    modTags.find((m) => m.slug === slug)?.labelVi ?? slug;

  return (
    <div
      className={`bg-white rounded-xl border p-4 ${
        row.isHidden ? "border-slate-300 opacity-70" : "border-slate-200/70"
      }`}
    >
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap text-sm">
            <Stars value={row.rating} />
            <span className="font-medium text-slate-900">{row.authorName}</span>
            {row.isVerifiedPurchase && (
              <Badge variant="secondary" className="text-[10px]">Đã mua</Badge>
            )}
            {row.isHidden && (
              <Badge className="bg-slate-200 text-slate-700 text-[10px]">Đã ẩn</Badge>
            )}
            <span className="text-xs text-slate-500">· {formatDate(row.createdAt)}</span>
          </div>
          {row.templateTitle && (
            <p className="text-xs text-slate-500 mt-1">Template: {row.templateTitle} (#{row.templateId})</p>
          )}
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <Button size="sm" variant="outline" onClick={onEditTags} className="gap-1.5">
            <TagIcon className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Tag mod</span>
          </Button>
          {row.isHidden ? (
            <Button size="sm" variant="outline" onClick={onUnhide} disabled={busy} className="gap-1.5">
              <Eye className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Hiện</span>
            </Button>
          ) : (
            <Button size="sm" variant="outline" onClick={onHide} disabled={busy} className="gap-1.5">
              <EyeOff className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Ẩn</span>
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={onAskDelete}
            className="gap-1.5 text-red-600 border-red-200 hover:bg-red-50"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Xóa</span>
          </Button>
        </div>
      </div>

      <p className="mt-3 text-sm text-slate-700 whitespace-pre-wrap">{row.comment}</p>

      {row.imageUrl && (
        <img
          src={row.imageUrl}
          alt=""
          className="mt-3 rounded-lg max-h-48 border border-slate-200"
        />
      )}

      {(row.criteriaTags.length > 0 || row.moderationTags.length > 0) && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {row.criteriaTags.map((slug) => (
            <Badge key={`c-${slug}`} className="bg-green-100 text-green-700 border-green-200 border">
              ✓ {criteriaLabel(slug)}
            </Badge>
          ))}
          {row.moderationTags.map((slug) => (
            <Badge key={`m-${slug}`} className={`border ${modTagColor(slug, modTags)}`}>
              <ShieldAlert className="w-3 h-3 mr-1" />
              {modTagLabel(slug)}
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}

function ModTagDialog({
  review,
  modTags,
  onClose,
  onSaved,
}: {
  review: ReviewRow;
  modTags: ModerationTag[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const [selected, setSelected] = useState<Set<string>>(new Set(review.moderationTags));

  const toggle = (slug: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
  };

  const saveMutation = useMutation({
    mutationFn: () =>
      customFetch(`/api/admin/reviews/${review.id}/moderation-tags`, {
        method: "PATCH",
        body: JSON.stringify({ tags: Array.from(selected) }),
      }),
    onSuccess: () => {
      toast({ title: "Đã cập nhật tag" });
      onSaved();
      onClose();
    },
    onError: (e: any) => toast({ title: "Lỗi", description: e?.message, variant: "destructive" }),
  });

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Gắn tag moderation</DialogTitle>
        </DialogHeader>
        <div className="space-y-2 py-2">
          {modTags.filter((t) => t.isActive).length === 0 ? (
            <p className="text-sm text-slate-500">
              Chưa có tag moderation nào. Tạo ở tab "Tag moderation".
            </p>
          ) : (
            modTags
              .filter((t) => t.isActive)
              .map((t) => (
                <label
                  key={t.slug}
                  className="flex items-center gap-3 p-2.5 rounded-lg border border-slate-200 cursor-pointer hover:bg-slate-50"
                >
                  <input
                    type="checkbox"
                    checked={selected.has(t.slug)}
                    onChange={() => toggle(t.slug)}
                    className="w-4 h-4 rounded accent-primary"
                  />
                  <Badge className={`border ${COLOR_CLASSES[t.color] ?? COLOR_CLASSES.red}`}>
                    {t.labelVi}
                  </Badge>
                  <span className="text-xs text-slate-400 ml-auto">{t.slug}</span>
                </label>
              ))
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Hủy</Button>
          <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
            {saveMutation.isPending ? "Đang lưu..." : "Lưu"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Criteria management tab
// ---------------------------------------------------------------------------

function CriteriaTab({ items, refetch }: { items: Criteria[]; refetch: () => void }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Criteria | null>(null);
  const [form, setForm] = useState({ slug: "", labelVi: "", labelEn: "", sortOrder: "0", isActive: true });

  const resetForm = () => setForm({ slug: "", labelVi: "", labelEn: "", sortOrder: "0", isActive: true });

  const openCreate = () => {
    setEditing(null);
    resetForm();
    setOpen(true);
  };

  const openEdit = (c: Criteria) => {
    setEditing(c);
    setForm({
      slug: c.slug,
      labelVi: c.labelVi,
      labelEn: c.labelEn ?? "",
      sortOrder: String(c.sortOrder),
      isActive: c.isActive,
    });
    setOpen(true);
  };

  const createMutation = useMutation({
    mutationFn: () =>
      customFetch(`/api/admin/review-criteria`, {
        method: "POST",
        body: JSON.stringify({
          slug: form.slug,
          labelVi: form.labelVi,
          labelEn: form.labelEn || null,
          sortOrder: Number(form.sortOrder) || 0,
          isActive: form.isActive,
        }),
      }),
    onSuccess: () => {
      toast({ title: "Đã tạo tiêu chí" });
      setOpen(false);
      refetch();
    },
    onError: (e: any) => toast({ title: "Lỗi", description: e?.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: () =>
      customFetch(`/api/admin/review-criteria/${editing!.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          labelVi: form.labelVi,
          labelEn: form.labelEn || null,
          sortOrder: Number(form.sortOrder) || 0,
          isActive: form.isActive,
        }),
      }),
    onSuccess: () => {
      toast({ title: "Đã cập nhật tiêu chí" });
      setOpen(false);
      refetch();
    },
    onError: (e: any) => toast({ title: "Lỗi", description: e?.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) =>
      customFetch(`/api/admin/review-criteria/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast({ title: "Đã xóa" });
      refetch();
    },
    onError: (e: any) => toast({ title: "Lỗi", description: e?.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-600">
          User chọn các tiêu chí này khi viết review. Chỉ tiêu chí <b>Hoạt động</b> mới hiển thị cho user.
        </p>
        <Button onClick={openCreate} className="gap-1.5">
          <Plus className="w-4 h-4" /> Thêm
        </Button>
      </div>

      {items.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200/70 p-10 text-center text-slate-500">
          Chưa có tiêu chí nào. Bấm "Thêm" để tạo.
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200/70 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="text-left p-3 font-medium text-slate-600">Nhãn (VN)</th>
                <th className="text-left p-3 font-medium text-slate-600 hidden md:table-cell">Nhãn (EN)</th>
                <th className="text-left p-3 font-medium text-slate-600">Slug</th>
                <th className="text-left p-3 font-medium text-slate-600 hidden sm:table-cell">Thứ tự</th>
                <th className="text-left p-3 font-medium text-slate-600">Trạng thái</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {items.map((c) => (
                <tr key={c.id} className="border-t border-slate-100">
                  <td className="p-3 font-medium">{c.labelVi}</td>
                  <td className="p-3 text-slate-500 hidden md:table-cell">{c.labelEn ?? "—"}</td>
                  <td className="p-3"><code className="text-xs text-slate-500">{c.slug}</code></td>
                  <td className="p-3 hidden sm:table-cell">{c.sortOrder}</td>
                  <td className="p-3">
                    {c.isActive ? (
                      <Badge className="bg-green-100 text-green-700">Hoạt động</Badge>
                    ) : (
                      <Badge className="bg-slate-200 text-slate-600">Tắt</Badge>
                    )}
                  </td>
                  <td className="p-3 text-right">
                    <div className="inline-flex gap-1.5">
                      <Button size="sm" variant="ghost" onClick={() => openEdit(c)}>
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        onClick={() => {
                          if (confirm(`Xóa tiêu chí "${c.labelVi}"?`)) deleteMutation.mutate(c.id);
                        }}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Sửa tiêu chí" : "Thêm tiêu chí mới"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label>Slug (định danh)</Label>
              <Input
                value={form.slug}
                onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
                placeholder="design-quality"
                disabled={!!editing}
                className="mt-1 font-mono text-sm"
              />
              {editing && <p className="text-xs text-slate-500 mt-1">Slug không sửa được sau khi tạo.</p>}
            </div>
            <div>
              <Label>Nhãn (Tiếng Việt) *</Label>
              <Input
                value={form.labelVi}
                onChange={(e) => setForm((f) => ({ ...f, labelVi: e.target.value }))}
                placeholder="Thiết kế đẹp"
                className="mt-1"
              />
            </div>
            <div>
              <Label>Nhãn (Tiếng Anh)</Label>
              <Input
                value={form.labelEn}
                onChange={(e) => setForm((f) => ({ ...f, labelEn: e.target.value }))}
                placeholder="Good design"
                className="mt-1"
              />
            </div>
            <div>
              <Label>Thứ tự hiển thị</Label>
              <Input
                type="number"
                value={form.sortOrder}
                onChange={(e) => setForm((f) => ({ ...f, sortOrder: e.target.value }))}
                className="mt-1"
              />
            </div>
            <div className="flex items-center justify-between bg-slate-50 rounded-lg p-3">
              <Label htmlFor="crit-active">Hoạt động</Label>
              <Switch
                id="crit-active"
                checked={form.isActive}
                onCheckedChange={(v) => setForm((f) => ({ ...f, isActive: v }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Hủy</Button>
            <Button
              onClick={() => (editing ? updateMutation.mutate() : createMutation.mutate())}
              disabled={
                !form.labelVi.trim() ||
                (!editing && !form.slug.trim()) ||
                createMutation.isPending ||
                updateMutation.isPending
              }
            >
              {createMutation.isPending || updateMutation.isPending ? "Đang lưu..." : "Lưu"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Moderation tags tab
// ---------------------------------------------------------------------------

const COLOR_OPTIONS = ["red", "amber", "orange", "blue", "slate", "purple", "green"];

function ModTagsTab({ items, refetch }: { items: ModerationTag[]; refetch: () => void }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ModerationTag | null>(null);
  const [form, setForm] = useState({ slug: "", labelVi: "", color: "red", sortOrder: "0", isActive: true });

  const resetForm = () => setForm({ slug: "", labelVi: "", color: "red", sortOrder: "0", isActive: true });

  const openCreate = () => {
    setEditing(null);
    resetForm();
    setOpen(true);
  };

  const openEdit = (t: ModerationTag) => {
    setEditing(t);
    setForm({
      slug: t.slug,
      labelVi: t.labelVi,
      color: t.color,
      sortOrder: String(t.sortOrder),
      isActive: t.isActive,
    });
    setOpen(true);
  };

  const createMutation = useMutation({
    mutationFn: () =>
      customFetch(`/api/admin/moderation-tags`, {
        method: "POST",
        body: JSON.stringify({
          slug: form.slug,
          labelVi: form.labelVi,
          color: form.color,
          sortOrder: Number(form.sortOrder) || 0,
          isActive: form.isActive,
        }),
      }),
    onSuccess: () => {
      toast({ title: "Đã tạo tag" });
      setOpen(false);
      refetch();
    },
    onError: (e: any) => toast({ title: "Lỗi", description: e?.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: () =>
      customFetch(`/api/admin/moderation-tags/${editing!.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          labelVi: form.labelVi,
          color: form.color,
          sortOrder: Number(form.sortOrder) || 0,
          isActive: form.isActive,
        }),
      }),
    onSuccess: () => {
      toast({ title: "Đã cập nhật tag" });
      setOpen(false);
      refetch();
    },
    onError: (e: any) => toast({ title: "Lỗi", description: e?.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) =>
      customFetch(`/api/admin/moderation-tags/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast({ title: "Đã xóa" });
      refetch();
    },
    onError: (e: any) => toast({ title: "Lỗi", description: e?.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-600">
          Admin gắn các tag này lên review để đánh dấu nội dung độc hại (spam, xúc phạm,...). User không thấy.
        </p>
        <Button onClick={openCreate} className="gap-1.5">
          <Plus className="w-4 h-4" /> Thêm
        </Button>
      </div>

      {items.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200/70 p-10 text-center text-slate-500">
          Chưa có tag moderation nào. Bấm "Thêm" để tạo.
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200/70 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="text-left p-3 font-medium text-slate-600">Tag</th>
                <th className="text-left p-3 font-medium text-slate-600">Slug</th>
                <th className="text-left p-3 font-medium text-slate-600 hidden sm:table-cell">Thứ tự</th>
                <th className="text-left p-3 font-medium text-slate-600">Trạng thái</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {items.map((t) => (
                <tr key={t.id} className="border-t border-slate-100">
                  <td className="p-3">
                    <Badge className={`border ${COLOR_CLASSES[t.color] ?? COLOR_CLASSES.red}`}>
                      {t.labelVi}
                    </Badge>
                  </td>
                  <td className="p-3"><code className="text-xs text-slate-500">{t.slug}</code></td>
                  <td className="p-3 hidden sm:table-cell">{t.sortOrder}</td>
                  <td className="p-3">
                    {t.isActive ? (
                      <Badge className="bg-green-100 text-green-700">Hoạt động</Badge>
                    ) : (
                      <Badge className="bg-slate-200 text-slate-600">Tắt</Badge>
                    )}
                  </td>
                  <td className="p-3 text-right">
                    <div className="inline-flex gap-1.5">
                      <Button size="sm" variant="ghost" onClick={() => openEdit(t)}>
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        onClick={() => {
                          if (confirm(`Xóa tag "${t.labelVi}"?`)) deleteMutation.mutate(t.id);
                        }}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Sửa tag" : "Thêm tag mới"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label>Slug *</Label>
              <Input
                value={form.slug}
                onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
                placeholder="spam"
                disabled={!!editing}
                className="mt-1 font-mono text-sm"
              />
            </div>
            <div>
              <Label>Nhãn *</Label>
              <Input
                value={form.labelVi}
                onChange={(e) => setForm((f) => ({ ...f, labelVi: e.target.value }))}
                placeholder="Spam"
                className="mt-1"
              />
            </div>
            <div>
              <Label>Màu</Label>
              <div className="flex flex-wrap gap-2 mt-1.5">
                {COLOR_OPTIONS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, color: c }))}
                    className={`px-3 py-1.5 rounded-lg border text-xs font-medium ${
                      COLOR_CLASSES[c]
                    } ${form.color === c ? "ring-2 ring-offset-1 ring-slate-400" : ""}`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <Label>Thứ tự hiển thị</Label>
              <Input
                type="number"
                value={form.sortOrder}
                onChange={(e) => setForm((f) => ({ ...f, sortOrder: e.target.value }))}
                className="mt-1"
              />
            </div>
            <div className="flex items-center justify-between bg-slate-50 rounded-lg p-3">
              <Label htmlFor="mod-active">Hoạt động</Label>
              <Switch
                id="mod-active"
                checked={form.isActive}
                onCheckedChange={(v) => setForm((f) => ({ ...f, isActive: v }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Hủy</Button>
            <Button
              onClick={() => (editing ? updateMutation.mutate() : createMutation.mutate())}
              disabled={
                !form.labelVi.trim() ||
                (!editing && !form.slug.trim()) ||
                createMutation.isPending ||
                updateMutation.isPending
              }
            >
              {createMutation.isPending || updateMutation.isPending ? "Đang lưu..." : "Lưu"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page entry
// ---------------------------------------------------------------------------

export default function AdminReviews() {
  const [, setLocation] = useLocation();
  const { data: user, isLoading: userLoading } = useGetCurrentUser();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!userLoading && (!user || (user as any).role !== "admin")) setLocation("/login");
  }, [user, userLoading, setLocation]);

  const criteriaQuery = useQuery<Criteria[]>({
    queryKey: CRITERIA_KEY,
    queryFn: () => customFetch<Criteria[]>("/api/admin/review-criteria"),
  });

  const modTagsQuery = useQuery<ModerationTag[]>({
    queryKey: MOD_TAGS_KEY,
    queryFn: () => customFetch<ModerationTag[]>("/api/admin/moderation-tags"),
  });

  if (!userLoading && (!user || (user as any).role !== "admin")) return null;

  const criteria = criteriaQuery.data ?? [];
  const modTags = modTagsQuery.data ?? [];

  return (
    <AdminLayout
      title="Quản lý Đánh giá"
      description="Lọc, ẩn, xóa review độc hại và quản lý tag tiêu chí"
    >
      <Tabs defaultValue="reviews" className="space-y-4">
        <TabsList>
          <TabsTrigger value="reviews">Đánh giá</TabsTrigger>
          <TabsTrigger value="criteria">Tiêu chí</TabsTrigger>
          <TabsTrigger value="mod-tags">Tag moderation</TabsTrigger>
        </TabsList>

        <TabsContent value="reviews">
          <ReviewsTab criteria={criteria} modTags={modTags} />
        </TabsContent>

        <TabsContent value="criteria">
          <CriteriaTab
            items={criteria}
            refetch={() => queryClient.invalidateQueries({ queryKey: CRITERIA_KEY })}
          />
        </TabsContent>

        <TabsContent value="mod-tags">
          <ModTagsTab
            items={modTags}
            refetch={() => queryClient.invalidateQueries({ queryKey: MOD_TAGS_KEY })}
          />
        </TabsContent>
      </Tabs>
    </AdminLayout>
  );
}
