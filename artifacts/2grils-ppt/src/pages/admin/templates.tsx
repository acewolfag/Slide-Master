import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import {
  useListAdminTemplates, useDeleteTemplate, useCreateTemplate, useUpdateTemplate,
  getListAdminTemplatesQueryKey, useGetCurrentUser, useListCategories,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { AdminLayout } from "./index";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Trash2, Pencil, Plus, Upload, X, ImageIcon, Loader2 } from "lucide-react";

type TemplateForm = {
  titleVi: string; titleEn: string; slug: string;
  price: number; isFree: boolean;
  thumbnailUrl: string; previewImages: string[];
  /** File PPTX gốc khách sẽ tải sau khi paid. */
  fileUrl: string;
  slideCount: number; aspectRatio: string;
  categoryId: number; style: string;
  descriptionVi: string; descriptionEn: string;
  features: string[]; tags: string;
  isFeatured: boolean; isBestSeller: boolean;
  status: "active" | "draft";
};

const EMPTY: TemplateForm = {
  titleVi: "", titleEn: "", slug: "",
  price: 99000, isFree: false,
  thumbnailUrl: "", previewImages: [],
  fileUrl: "",
  slideCount: 20, aspectRatio: "16:9",
  categoryId: 1, style: "Corporate",
  descriptionVi: "", descriptionEn: "",
  features: [], tags: "",
  isFeatured: false, isBestSeller: false,
  status: "active",
};

function slugify(str: string) {
  return str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function TemplateFormSheet({
  editing, onClose, categories, prefill,
}: {
  editing: any | "new"; onClose: () => void; categories: any[];
  prefill?: Partial<TemplateForm>;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const createTemplate = useCreateTemplate();
  const updateTemplate = useUpdateTemplate();
  const isNew = editing === "new";

  const [form, setForm] = useState<TemplateForm>(
    isNew ? { ...EMPTY, ...(prefill ?? {}) } : {
      titleVi: editing.titleVi ?? "", titleEn: editing.titleEn ?? "",
      slug: editing.slug ?? "", price: editing.price ?? 99000,
      isFree: editing.isFree ?? false, thumbnailUrl: editing.thumbnailUrl ?? "",
      previewImages: editing.previewImages ?? [],
      fileUrl: editing.fileUrl ?? "",
      slideCount: editing.slideCount ?? 20,
      aspectRatio: editing.aspectRatio ?? "16:9", categoryId: editing.categoryId ?? 1,
      style: editing.style ?? "Corporate", descriptionVi: editing.descriptionVi ?? "",
      descriptionEn: editing.descriptionEn ?? "", features: editing.features ?? [],
      tags: (editing.tags ?? []).join(", "), isFeatured: editing.isFeatured ?? false,
      isBestSeller: editing.isBestSeller ?? false, status: editing.status ?? "active",
    }
  );
  const [uploadingThumb, setUploadingThumb] = useState(false);
  const [uploadingPreview, setUploadingPreview] = useState(false);
  const [newFeature, setNewFeature] = useState("");
  const thumbRef = useRef<HTMLInputElement>(null);
  const previewRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploadingFile, setUploadingFile] = useState(false);

  const set = <K extends keyof TemplateForm>(k: K, v: TemplateForm[K]) =>
    setForm(f => ({ ...f, [k]: v }));

  const uploadImage = async (file: File): Promise<string> => {
    const formData = new FormData();
    formData.append("files", file);
    const res = await fetch("/api/upload", {
      method: "POST",
      body: formData,
      headers: { Authorization: `Bearer ${localStorage.getItem("auth_token") ?? ""}` },
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error ?? `Upload thất bại (HTTP ${res.status})`);
    }
    const data = await res.json();
    return data.files[0].url as string;
  };

  const handleThumbUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingThumb(true);
    try {
      const url = await uploadImage(file);
      set("thumbnailUrl", url);
      toast({ title: "Đã tải ảnh thumbnail" });
    } catch { toast({ title: "Lỗi upload", variant: "destructive" }); }
    finally { setUploadingThumb(false); if (thumbRef.current) thumbRef.current.value = ""; }
  };

  const handlePreviewUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploadingPreview(true);
    try {
      const urls = await Promise.all(Array.from(files).map(uploadImage));
      set("previewImages", [...form.previewImages, ...urls]);
      toast({ title: `Đã tải ${urls.length} ảnh preview` });
    } catch { toast({ title: "Lỗi upload", variant: "destructive" }); }
    finally { setUploadingPreview(false); if (previewRef.current) previewRef.current.value = ""; }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingFile(true);
    try {
      const url = await uploadImage(file);
      set("fileUrl", url);
      toast({ title: "Đã upload file gốc", description: file.name });

      // For PPTX files, ask the server to render thumbnail + per-slide previews
      // + count slides, then auto-fill the form. Errors here are non-fatal —
      // admin can still fill those fields manually.
      if (/\.pptx?$/i.test(file.name)) {
        try {
          const res = await fetch("/api/admin/templates/process-pptx", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${localStorage.getItem("auth_token") ?? ""}`,
            },
            body: JSON.stringify({ pptxUrl: url }),
          });
          if (res.ok) {
            const data = (await res.json()) as {
              thumbnailUrl: string | null;
              previewImages: string[];
              slideCount: number | null;
              warnings: string[];
            };
            setForm((f) => ({
              ...f,
              thumbnailUrl: data.thumbnailUrl ?? f.thumbnailUrl,
              previewImages: data.previewImages.length > 0 ? data.previewImages : f.previewImages,
              slideCount: data.slideCount ?? f.slideCount,
            }));
            const desc =
              data.warnings.length > 0
                ? data.warnings.join("; ").slice(0, 180)
                : `${data.previewImages.length} slide đã sinh preview`;
            toast({ title: "Đã sinh thumbnail + preview", description: desc });
          } else {
            const err = await res.json().catch(() => ({}));
            toast({
              title: "Không sinh được preview tự động",
              description: err.error ?? `HTTP ${res.status}`,
              variant: "destructive",
            });
          }
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : "Lỗi không xác định";
          toast({ title: "Không sinh được preview tự động", description: msg, variant: "destructive" });
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Lỗi không xác định";
      toast({ title: "Lỗi upload file", description: msg, variant: "destructive" });
    } finally {
      setUploadingFile(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const handleSave = () => {
    const payload = {
      titleVi: form.titleVi, titleEn: form.titleEn,
      slug: form.slug || slugify(form.titleVi),
      price: form.isFree ? 0 : form.price,
      isFree: form.isFree, thumbnailUrl: form.thumbnailUrl,
      previewImages: form.previewImages,
      fileUrl: form.fileUrl || null,
      slideCount: form.slideCount, aspectRatio: form.aspectRatio,
      categoryId: form.categoryId, style: form.style,
      descriptionVi: form.descriptionVi, descriptionEn: form.descriptionEn,
      features: form.features,
      tags: form.tags.split(",").map(t => t.trim()).filter(Boolean),
      isFeatured: form.isFeatured, status: form.status,
    };

    const opts = {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListAdminTemplatesQueryKey() });
        toast({ title: isNew ? "Đã tạo template" : "Đã cập nhật template" });
        onClose();
      },
      onError: () => toast({ title: "Lỗi khi lưu template", variant: "destructive" }),
    };

    if (isNew) {
      createTemplate.mutate({ data: payload } as any, opts);
    } else {
      updateTemplate.mutate({ id: editing.id, data: payload } as any, opts);
    }
  };

  const isPending = createTemplate.isPending || updateTemplate.isPending;

  return (
    <Sheet open onOpenChange={onClose}>
      <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto p-0">
        <SheetHeader className="px-6 py-5 border-b sticky top-0 bg-white z-10">
          <SheetTitle>{isNew ? "Thêm Template mới" : `Chỉnh sửa: ${editing.titleVi}`}</SheetTitle>
        </SheetHeader>

        <div className="p-6 space-y-6">
          {/* Basic Info */}
          <div className="space-y-4">
            <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">Thông tin cơ bản</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label>Tiêu đề (VI) *</Label>
                <Input value={form.titleVi} onChange={e => {
                  set("titleVi", e.target.value);
                  if (isNew) set("slug", slugify(e.target.value));
                }} placeholder="Tên template tiếng Việt" className="mt-1.5" />
              </div>
              <div>
                <Label>Tiêu đề (EN)</Label>
                <Input value={form.titleEn} onChange={e => set("titleEn", e.target.value)} placeholder="Template name in English" className="mt-1.5" />
              </div>
            </div>
            <div>
              <Label>Slug (URL)</Label>
              <Input value={form.slug} onChange={e => set("slug", e.target.value)} placeholder="auto-generated-from-title" className="mt-1.5 font-mono text-sm" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label>Danh mục *</Label>
                <Select value={String(form.categoryId)} onValueChange={v => set("categoryId", Number(v))}>
                  <SelectTrigger className="mt-1.5"><SelectValue placeholder="Chọn danh mục" /></SelectTrigger>
                  <SelectContent>
                    {categories.map((c: any) => (
                      <SelectItem key={c.id} value={String(c.id)}>{c.nameVi}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Phong cách</Label>
                <Select value={form.style} onValueChange={v => set("style", v)}>
                  <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["Corporate", "Creative", "Minimal", "Bold", "Dark", "Nature"].map(s => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Pricing */}
          <div className="space-y-4 border-t pt-5">
            <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">Giá bán</h3>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.isFree} onChange={e => set("isFree", e.target.checked)} className="accent-primary w-4 h-4 rounded" />
              <span className="text-sm font-medium">Miễn phí</span>
            </label>
            {!form.isFree && (
              <div>
                <Label>Giá (VND)</Label>
                <Input type="number" value={form.price} onChange={e => set("price", Number(e.target.value))} min={0} step={1000} className="mt-1.5" />
              </div>
            )}
          </div>

          {/* Specs */}
          <div className="space-y-4 border-t pt-5">
            <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">Thông số kỹ thuật</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label>Số lượng slide</Label>
                <Input type="number" value={form.slideCount} onChange={e => set("slideCount", Number(e.target.value))} className="mt-1.5" min={1} />
              </div>
              <div>
                <Label>Tỷ lệ slide</Label>
                <Select value={form.aspectRatio} onValueChange={v => set("aspectRatio", v)}>
                  <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="16:9">16:9 (Widescreen)</SelectItem>
                    <SelectItem value="4:3">4:3 (Standard)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Thumbnail */}
          <div className="space-y-4 border-t pt-5">
            <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">Hình ảnh Thumbnail</h3>
            <div>
              <Label>URL thumbnail *</Label>
              <Input value={form.thumbnailUrl} onChange={e => set("thumbnailUrl", e.target.value)} placeholder="https://... hoặc /api/uploads/..." className="mt-1.5" />
            </div>
            <div className="flex items-center gap-3">
              <Button type="button" variant="outline" size="sm" disabled={uploadingThumb} onClick={() => thumbRef.current?.click()}>
                {uploadingThumb ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
                {uploadingThumb ? "Đang tải..." : "Upload thumbnail"}
              </Button>
              <input ref={thumbRef} type="file" accept="image/*" className="hidden" onChange={handleThumbUpload} />
            </div>
            {form.thumbnailUrl && (
              <img src={form.thumbnailUrl} alt="Thumbnail" className="w-full aspect-video object-cover rounded-lg border" />
            )}
          </div>

          {/* File gốc — khách paid sẽ download cái này */}
          <div className="space-y-3 border-t pt-5">
            <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">
              File gốc khách tải
            </h3>
            <p className="text-xs text-muted-foreground">
              File PPTX/PDF khách sẽ download sau khi thanh toán thành công.
              <strong> Bắt buộc phải có nếu template KHÔNG miễn phí.</strong>
            </p>
            <div>
              <Label>URL file gốc</Label>
              <Input
                value={form.fileUrl}
                onChange={(e) => set("fileUrl", e.target.value)}
                placeholder="/api/uploads/template.pptx hoặc https://..."
                className="mt-1.5"
              />
            </div>
            <div className="flex items-center gap-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={uploadingFile}
                onClick={() => fileRef.current?.click()}
              >
                {uploadingFile ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
                {uploadingFile ? "Đang tải..." : "Upload file gốc"}
              </Button>
              <span className="text-xs text-muted-foreground">PPTX / PPT / PDF, tối đa 20 MB</span>
              <input
                ref={fileRef}
                type="file"
                accept=".pptx,.ppt,.pdf,.doc,.docx"
                className="hidden"
                onChange={handleFileUpload}
              />
            </div>
            {form.fileUrl && (
              <div className="text-xs bg-emerald-50 border border-emerald-200 rounded-lg p-3 flex items-center justify-between">
                <a href={form.fileUrl} target="_blank" rel="noreferrer" className="text-emerald-700 underline truncate flex-1 mr-2">
                  ✓ {form.fileUrl}
                </a>
                <button
                  type="button"
                  onClick={() => set("fileUrl", "")}
                  className="text-emerald-700 hover:text-red-600"
                  title="Xóa link"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
            {!form.fileUrl && !form.isFree && (
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
                ⚠️ Template có giá nhưng chưa có file gốc — khách paid sẽ KHÔNG tải được.
              </p>
            )}
          </div>

          {/* Preview Images */}
          <div className="space-y-4 border-t pt-5">
            <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">Hình ảnh từng slide (Preview)</h3>
            <p className="text-xs text-muted-foreground">Tải lên ảnh chụp màn hình các slide trong template để người dùng xem trước.</p>
            <Button type="button" variant="outline" size="sm" disabled={uploadingPreview} onClick={() => previewRef.current?.click()}>
              {uploadingPreview ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <ImageIcon className="w-4 h-4 mr-2" />}
              {uploadingPreview ? "Đang tải..." : "Thêm ảnh slide"}
            </Button>
            <input ref={previewRef} type="file" accept="image/*" multiple className="hidden" onChange={handlePreviewUpload} />
            {form.previewImages.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {form.previewImages.map((url, i) => (
                  <div key={i} className="relative group">
                    <img src={url} alt={`Preview ${i + 1}`} className="w-full aspect-video object-cover rounded-lg border" />
                    <button
                      type="button"
                      onClick={() => set("previewImages", form.previewImages.filter((_, j) => j !== i))}
                      className="absolute top-1 right-1 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                    <span className="absolute bottom-1 left-1 bg-black/50 text-white text-[10px] px-1.5 py-0.5 rounded">{i + 1}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Description */}
          <div className="space-y-4 border-t pt-5">
            <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">Nội dung mô tả</h3>
            <div>
              <Label>Mô tả (Tiếng Việt)</Label>
              <Textarea value={form.descriptionVi} onChange={e => set("descriptionVi", e.target.value)} placeholder="Mô tả chi tiết về template..." className="mt-1.5" rows={4} />
            </div>
            <div>
              <Label>Mô tả (English)</Label>
              <Textarea value={form.descriptionEn} onChange={e => set("descriptionEn", e.target.value)} placeholder="Template description in English..." className="mt-1.5" rows={3} />
            </div>
          </div>

          {/* Features */}
          <div className="space-y-4 border-t pt-5">
            <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">Tính năng nổi bật</h3>
            <div className="flex gap-2">
              <Input value={newFeature} onChange={e => setNewFeature(e.target.value)} placeholder="VD: 50+ unique slides" className="flex-1"
                onKeyDown={e => {
                  if (e.key === "Enter" && newFeature.trim()) {
                    set("features", [...form.features, newFeature.trim()]);
                    setNewFeature("");
                    e.preventDefault();
                  }
                }} />
              <Button type="button" variant="outline" size="sm" onClick={() => {
                if (newFeature.trim()) { set("features", [...form.features, newFeature.trim()]); setNewFeature(""); }
              }}>
                <Plus className="w-4 h-4" />
              </Button>
            </div>
            {form.features.length > 0 && (
              <div className="space-y-2">
                {form.features.map((f, i) => (
                  <div key={i} className="flex items-center gap-2 bg-slate-50 rounded-lg px-3 py-2">
                    <span className="flex-1 text-sm">{f}</span>
                    <button type="button" onClick={() => set("features", form.features.filter((_, j) => j !== i))} className="text-muted-foreground hover:text-destructive">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Tags */}
          <div className="space-y-3 border-t pt-5">
            <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">Tags</h3>
            <div>
              <Label>Tags (cách nhau bằng dấu phẩy)</Label>
              <Input value={form.tags} onChange={e => set("tags", e.target.value)} placeholder="business, dark, premium, slides" className="mt-1.5" />
            </div>
          </div>

          {/* Settings */}
          <div className="space-y-4 border-t pt-5">
            <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">Cài đặt</h3>
            <div>
              <Label className="block mb-2">Trạng thái</Label>
              <Select value={form.status} onValueChange={v => set("status", v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Hoạt động</SelectItem>
                  <SelectItem value="draft">Nháp</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-6">
              <label className="flex items-center gap-2 cursor-pointer text-sm">
                <input type="checkbox" checked={form.isFeatured} onChange={e => set("isFeatured", e.target.checked)} className="accent-primary w-4 h-4 rounded" />
                Template nổi bật
              </label>
              <label className="flex items-center gap-2 cursor-pointer text-sm">
                <input type="checkbox" checked={form.isBestSeller} onChange={e => set("isBestSeller", e.target.checked)} className="accent-primary w-4 h-4 rounded" />
                Best Seller
              </label>
            </div>
          </div>
        </div>

        <div className="sticky bottom-0 bg-white border-t px-4 sm:px-6 py-4 flex gap-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <Button variant="outline" onClick={onClose} className="flex-1">Hủy</Button>
          <Button className="brand-gradient border-none flex-1" onClick={handleSave} disabled={isPending || !form.titleVi || !form.thumbnailUrl}>
            {isPending ? "Đang lưu..." : isNew ? "Tạo Template" : "Lưu thay đổi"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

export default function AdminTemplates() {
  const [, setLocation] = useLocation();
  const { data: user, isLoading: userLoading } = useGetCurrentUser();
  const { data: templates, isLoading } = useListAdminTemplates();
  const { data: categories } = useListCategories();
  const deleteTemplate = useDeleteTemplate();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [editing, setEditing] = useState<any | "new" | null>(null);
  const [prefill, setPrefill] = useState<Partial<TemplateForm> | null>(null);
  const [archiveOpen, setArchiveOpen] = useState(false);

  useEffect(() => {
    if (!userLoading && (!user || !["admin", "staff"].includes((user as any).role))) setLocation("/login");
  }, [user, userLoading, setLocation]);

  if (!userLoading && (!user || !["admin", "staff"].includes((user as any).role))) return null;

  const handleDelete = (id: number, title: string) => {
    if (!confirm(`Xóa template "${title}"?`)) return;
    deleteTemplate.mutate({ id } as any, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListAdminTemplatesQueryKey() });
        toast({ title: "Đã xóa template" });
      },
      onError: () => toast({ title: "Lỗi khi xóa", variant: "destructive" }),
    });
  };

const list = (templates as any[]) ?? [];
  const headerActions = (
    <div className="flex gap-1.5 sm:gap-2">
      <Button
        variant="outline"
        size="sm"
        className="gap-1.5 h-9 px-2 sm:px-3"
        onClick={() => setArchiveOpen(true)}
      >
        <Upload className="w-4 h-4" />
        <span className="hidden sm:inline text-xs">Upload archive</span>
      </Button>
      <Button
        size="sm"
        className="brand-gradient border-none gap-1.5 h-9 px-2 sm:px-3"
        onClick={() => { setPrefill(null); setEditing("new"); }}
      >
        <Plus className="w-4 h-4" />
        <span className="hidden sm:inline text-xs">Thêm</span>
      </Button>
    </div>
  );

  return (
    <AdminLayout
      title="Quản lý Templates"
      description="Thêm, chỉnh sửa và quản lý toàn bộ template"
      actions={headerActions}
    >
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 rounded-2xl" />
          ))}
        </div>
      ) : list.length === 0 ? (
        <div className="bg-white rounded-2xl p-10 text-center text-muted-foreground border border-dashed border-border/60">
          Chưa có template nào. Nhấn "Thêm" để bắt đầu.
        </div>
      ) : (
        <>
          <div className="md:hidden space-y-3">
            {list.map((t) => (
              <div
                key={t.id}
                className="bg-white rounded-2xl border border-border/50 p-3 flex items-center gap-3 active:scale-[0.99] transition-transform"
              >
                <img
                  src={t.thumbnailUrl}
                  alt=""
                  className="w-20 h-14 object-cover rounded-lg flex-shrink-0 bg-slate-100"
                />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm line-clamp-1">{t.titleVi}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {t.slideCount} slides · {t.categoryName}
                  </p>
                  <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                    <span className="text-sm font-bold text-primary">
                      {t.isFree ? "Miễn phí" : `${Number(t.price).toLocaleString("vi-VN")}đ`}
                    </span>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                        t.status === "active"
                          ? "bg-green-100 text-green-700"
                          : "bg-yellow-100 text-yellow-700"
                      }`}
                    >
                      {t.status === "active" ? "Hoạt động" : "Nháp"}
                    </span>
                    {t.isBestSeller && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-yellow-500 text-white font-medium">
                        Best
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex flex-col gap-1 flex-shrink-0">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-9 w-9 text-muted-foreground hover:text-primary"
                    onClick={() => setEditing(t)}
                    aria-label="Sửa"
                  >
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-9 w-9 text-muted-foreground hover:text-destructive"
                    onClick={() => handleDelete(t.id, t.titleVi)}
                    aria-label="Xoá"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>

          <div className="hidden md:block bg-white rounded-2xl border border-border/50 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b">
                <tr>
                  {["", "Tiêu đề", "Danh mục", "Giá", "Slides", "Trạng thái", ""].map((h, i) => (
                    <th key={i} className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {list.map((t) => (
                  <tr key={t.id} className="border-b last:border-0 hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <img src={t.thumbnailUrl} alt="" className="w-16 h-10 object-cover rounded" />
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium line-clamp-1 max-w-[200px]">{t.titleVi}</p>
                      <p className="text-xs text-muted-foreground">{t.slideCount} slides · {t.aspectRatio}</p>
                      <div className="flex gap-1 mt-1">
                        {t.isFeatured && <Badge variant="outline" className="text-[10px] px-1 py-0">Nổi bật</Badge>}
                        {t.isBestSeller && <Badge className="text-[10px] px-1 py-0 bg-yellow-500 border-none text-white">Best Seller</Badge>}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{t.categoryName}</td>
                    <td className="px-4 py-3 font-bold text-primary">
                      {t.isFree ? "Miễn phí" : `${Number(t.price).toLocaleString("vi-VN")}đ`}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{t.slideCount}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${t.status === "active" ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"}`}>
                        {t.status === "active" ? "Hoạt động" : "Nháp"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:text-primary" onClick={() => setEditing(t)}>
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => handleDelete(t.id, t.titleVi)}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {editing !== null && (
        <TemplateFormSheet
          editing={editing}
          onClose={() => { setEditing(null); setPrefill(null); }}
          categories={(categories as any[]) ?? []}
          prefill={prefill ?? undefined}
        />
      )}

      {archiveOpen && (
        <ArchiveUploadDialog
          onClose={() => setArchiveOpen(false)}
          onUseExtracted={(prefillData) => {
            setPrefill(prefillData);
            setEditing("new");
            setArchiveOpen(false);
          }}
        />
      )}
    </AdminLayout>
  );
}

interface ExtractedFile {
  name: string;
  suggestedTitle: string;
  pptxUrl: string;
  thumbnailUrl: string | null;
  previewImages: string[];
  pdfUrl: string | null;
  slideCount: number | null;
}

interface ArchiveResult {
  archiveName: string;
  files: ExtractedFile[];
  warnings: string[];
}

function archiveSlugify(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function ArchiveUploadDialog({
  onClose,
  onUseExtracted,
}: {
  onClose: () => void;
  onUseExtracted: (prefill: Partial<TemplateForm>) => void;
}) {
  const { toast } = useToast();
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<ArchiveResult | null>(null);
  const [customThumb, setCustomThumb] = useState<Record<string, string>>({});
  const fileRef = useRef<HTMLInputElement>(null);
  const customRef = useRef<HTMLInputElement>(null);
  const [activeFile, setActiveFile] = useState<string | null>(null);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/admin/templates/upload-archive", {
        method: "POST",
        body: fd,
        headers: { Authorization: `Bearer ${localStorage.getItem("auth_token") ?? ""}` },
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? `HTTP ${res.status}`);
      }
      const data = (await res.json()) as ArchiveResult;
      setResult(data);
      if (data.warnings.length > 0) {
        toast({
          title: "Upload xong (có cảnh báo)",
          description: data.warnings.join("; ").slice(0, 200),
        });
      } else {
        toast({ title: `Đã giải nén ${data.files.length} file PPTX` });
      }
    } catch (err: any) {
      toast({ title: "Lỗi upload", description: err?.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const handleCustomThumbUpload = async (key: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const fd = new FormData();
    fd.append("files", file);
    const res = await fetch("/api/upload", {
      method: "POST",
      body: fd,
      headers: { Authorization: `Bearer ${localStorage.getItem("auth_token") ?? ""}` },
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      toast({
        title: "Lỗi upload thumbnail",
        description: err.error ?? `HTTP ${res.status}`,
        variant: "destructive",
      });
      return;
    }
    const data = await res.json();
    setCustomThumb((prev) => ({ ...prev, [key]: data.files[0].url }));
  };

  const handleUse = (f: ExtractedFile) => {
    const thumb = customThumb[f.name] ?? f.thumbnailUrl ?? "";
    // Backend đã dùng slide 1 làm thumbnail (previewImages[0]). Cắt nó khỏi
    // gallery để không hiển thị trùng với thumbnail.
    const preview = (f.previewImages ?? []).slice(1);
    onUseExtracted({
      titleVi: f.suggestedTitle,
      titleEn: f.suggestedTitle,
      slug: archiveSlugify(f.suggestedTitle),
      thumbnailUrl: thumb,
      previewImages: preview,
      fileUrl: f.pptxUrl,
      slideCount: f.slideCount ?? 20,
    });
  };

  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Upload Template Archive</SheetTitle>
        </SheetHeader>
        <div className="space-y-5 mt-6">
          <div className="bg-slate-50 rounded-xl p-5 border border-dashed border-border">
            <p className="text-sm font-medium mb-2">Chọn file .zip hoặc .rar (tối đa 200 MB)</p>
            <p className="text-xs text-muted-foreground mb-3">
              Hệ thống sẽ giải nén, tìm các file .pptx, gợi ý tên & sinh thumbnail (cần LibreOffice).
            </p>
            <input
              ref={fileRef}
              type="file"
              accept=".zip,.rar"
              onChange={handleFile}
              className="hidden"
            />
            <Button onClick={() => fileRef.current?.click()} disabled={uploading} className="gap-2">
              {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              {uploading ? "Đang xử lý..." : "Chọn file"}
            </Button>
          </div>

          {result && result.warnings.length > 0 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 text-xs text-yellow-800 space-y-1">
              {result.warnings.map((w, i) => (
                <p key={i}>⚠️ {w}</p>
              ))}
            </div>
          )}

          {result && result.files.length === 0 && (
            <div className="bg-white rounded-xl p-6 text-center text-sm text-muted-foreground border">
              Không tìm thấy file .pptx nào trong archive
            </div>
          )}

          {result && result.files.length > 0 && (
            <div className="space-y-3">
              <p className="text-sm font-semibold">Tìm thấy {result.files.length} file PPTX:</p>
              {result.files.map((f) => {
                const displayThumb = customThumb[f.name] ?? f.thumbnailUrl;
                return (
                  <div key={f.name} className="bg-white rounded-xl border border-border/50 p-4 space-y-3">
                    <div className="flex gap-3">
                      <div className="w-32 h-20 bg-slate-100 rounded flex-shrink-0 overflow-hidden flex items-center justify-center">
                        {displayThumb ? (
                          <img src={displayThumb} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <ImageIcon className="w-6 h-6 text-muted-foreground" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-muted-foreground truncate">{f.name}</p>
                        <p className="font-semibold text-sm">{f.suggestedTitle}</p>
                        <p className="text-xs text-muted-foreground">
                          {f.slideCount ? `${f.slideCount} slides` : "Số slides chưa rõ"}
                        </p>
                        <div className="flex gap-2 mt-1.5">
                          {f.pdfUrl && (
                            <a
                              href={f.pdfUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="text-xs text-primary underline"
                            >
                              Xem PDF preview
                            </a>
                          )}
                          <a
                            href={f.pptxUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs text-primary underline"
                          >
                            Tải PPTX
                          </a>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <input
                        ref={activeFile === f.name ? customRef : null}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => handleCustomThumbUpload(f.name, e)}
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setActiveFile(f.name);
                          setTimeout(() => customRef.current?.click(), 50);
                        }}
                      >
                        <ImageIcon className="w-3.5 h-3.5 mr-1" />
                        {customThumb[f.name] ? "Đổi thumbnail" : "Upload thumbnail"}
                      </Button>
                      <Button size="sm" onClick={() => handleUse(f)} className="ml-auto">
                        Tạo template từ file này
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
