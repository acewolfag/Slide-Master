import { useState, useRef } from "react";
import { Layout } from "@/components/layout";
import { Link, useLocation } from "wouter";
import { useCreateCustomRequest } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, ArrowRight, CheckCircle, Upload, X, FileText, ImageIcon, File, Loader2 } from "lucide-react";

const STEPS = ["Thông tin cá nhân", "Chủ đề & Mục đích", "Yêu cầu thiết kế", "Tài liệu đính kèm", "Nội dung & Deadline", "Xác nhận"];

type Attachment = { name: string; url: string; type: string; size?: number };

function fileIcon(type: string) {
  if (type.startsWith("image/")) return <ImageIcon className="w-4 h-4 text-blue-500" />;
  if (type === "application/pdf") return <FileText className="w-4 h-4 text-red-500" />;
  if (type.includes("spreadsheet") || type.includes("excel")) return <FileText className="w-4 h-4 text-green-600" />;
  return <File className="w-4 h-4 text-slate-500" />;
}

function formatSize(bytes?: number) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function CustomDesignRequest() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const createRequest = useCreateCustomRequest();
  const [step, setStep] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const [form, setForm] = useState({
    customerName: "", customerEmail: "", customerPhone: "", company: "",
    slideType: "", targetAudience: "", objective: "",
    slideCount: "20", style: "", colorPalette: "", aspectRatio: "16:9", language: "vi",
    deadline: "", budget: "", notes: "",
  });

  const set = (k: keyof typeof form, v: string) => setForm(f => ({ ...f, [k]: v }));

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    if (attachments.length + files.length > 10) {
      toast({ title: "Tối đa 10 file", variant: "destructive" });
      return;
    }
    setUploading(true);
    try {
      const formData = new FormData();
      Array.from(files).forEach(f => formData.append("files", f));
      const res = await fetch("/api/upload-attachment", { method: "POST", body: formData });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? `Upload thất bại (HTTP ${res.status})`);
      }
      const data = await res.json();
      setAttachments(prev => [...prev, ...data.files]);
      toast({ title: `Đã tải lên ${data.files.length} file thành công` });
    } catch {
      toast({ title: "Không thể tải file lên, vui lòng thử lại", variant: "destructive" });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const removeAttachment = (url: string) => {
    setAttachments(prev => prev.filter(a => a.url !== url));
  };

  const handleSubmit = () => {
    createRequest.mutate({ data: { ...form, slideCount: Number(form.slideCount), attachments } as any }, {
      onSuccess: (data: any) => {
        toast({ title: `Đã gửi yêu cầu! Mã: ${data.requestId}` });
        setLocation("/dashboard");
      },
      onError: () => toast({ title: "Có lỗi xảy ra, vui lòng thử lại", variant: "destructive" }),
    });
  };

  return (
    <Layout>
      <div className="min-h-screen bg-slate-50 py-16">
        <div className="container mx-auto px-4 max-w-2xl">
          <div className="mb-8">
            <Link href="/custom-design">
              <Button variant="ghost" size="sm" className="-ml-2 mb-4">
                <ArrowLeft className="w-4 h-4 mr-2" /> Quay lại
              </Button>
            </Link>
            <h1 className="text-3xl font-extrabold mb-2">Đặt thiết kế riêng</h1>
            <p className="text-muted-foreground">Điền thông tin để chúng tôi tư vấn và báo giá cho bạn</p>
          </div>

          {/* Progress */}
          <div className="flex items-center justify-between mb-8 overflow-x-auto pb-1">
            {STEPS.map((s, i) => (
              <div key={i} className="flex items-center flex-shrink-0">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all
                  ${i < step ? "brand-gradient text-white" : i === step ? "brand-gradient text-white shadow-lg" : "bg-slate-200 text-slate-500"}`}>
                  {i < step ? <CheckCircle className="w-3.5 h-3.5" /> : i + 1}
                </div>
                {i < STEPS.length - 1 && (
                  <div className={`h-0.5 w-6 md:w-10 mx-0.5 transition-all ${i < step ? "bg-primary" : "bg-slate-200"}`} />
                )}
              </div>
            ))}
          </div>

          <div className="bg-white rounded-2xl p-8 shadow-sm border border-border/50">
            <h2 className="text-xl font-bold mb-6">{STEPS[step]}</h2>

            {/* Step 0: Thông tin cá nhân */}
            {step === 0 && (
              <div className="space-y-4">
                <div><Label>Họ và tên *</Label>
                  <Input placeholder="Nguyễn Văn A" value={form.customerName} onChange={e => set("customerName", e.target.value)} className="mt-1.5" /></div>
                <div><Label>Email *</Label>
                  <Input type="email" placeholder="ban@email.com" value={form.customerEmail} onChange={e => set("customerEmail", e.target.value)} className="mt-1.5" /></div>
                <div><Label>Số điện thoại</Label>
                  <Input placeholder="0901234567" value={form.customerPhone} onChange={e => set("customerPhone", e.target.value)} className="mt-1.5" /></div>
                <div><Label>Công ty / Tổ chức</Label>
                  <Input placeholder="Công ty ABC" value={form.company} onChange={e => set("company", e.target.value)} className="mt-1.5" /></div>
              </div>
            )}

            {/* Step 1: Chủ đề & Mục đích */}
            {step === 1 && (
              <div className="space-y-4">
                <div><Label>Loại slide *</Label>
                  <Select value={form.slideType} onValueChange={v => set("slideType", v)}>
                    <SelectTrigger className="mt-1.5"><SelectValue placeholder="Chọn loại slide" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pitch-deck">Pitch Deck</SelectItem>
                      <SelectItem value="bao-cao">Báo cáo doanh nghiệp</SelectItem>
                      <SelectItem value="giao-duc">Bài giảng / Giáo dục</SelectItem>
                      <SelectItem value="marketing">Marketing / Quảng cáo</SelectItem>
                      <SelectItem value="su-kien">Sự kiện / Hội nghị</SelectItem>
                      <SelectItem value="khac">Khác</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Đối tượng nghe</Label>
                  <Input placeholder="Nhà đầu tư, khách hàng, sinh viên..." value={form.targetAudience} onChange={e => set("targetAudience", e.target.value)} className="mt-1.5" /></div>
                <div><Label>Mục tiêu bài thuyết trình</Label>
                  <Textarea placeholder="Gây ấn tượng với nhà đầu tư, giới thiệu sản phẩm, báo cáo KPI..." value={form.objective} onChange={e => set("objective", e.target.value)} className="mt-1.5" rows={3} /></div>
              </div>
            )}

            {/* Step 2: Yêu cầu thiết kế */}
            {step === 2 && (
              <div className="space-y-4">
                <div><Label>Số lượng slide *</Label>
                  <Select value={form.slideCount} onValueChange={v => set("slideCount", v)}>
                    <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="10">10 slides</SelectItem>
                      <SelectItem value="15">15 slides</SelectItem>
                      <SelectItem value="20">20 slides</SelectItem>
                      <SelectItem value="30">30 slides</SelectItem>
                      <SelectItem value="40">40 slides</SelectItem>
                      <SelectItem value="50">50+ slides</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Phong cách thiết kế</Label>
                  <Select value={form.style} onValueChange={v => set("style", v)}>
                    <SelectTrigger className="mt-1.5"><SelectValue placeholder="Chọn phong cách" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Corporate">Corporate (Doanh nghiệp)</SelectItem>
                      <SelectItem value="Creative">Creative (Sáng tạo)</SelectItem>
                      <SelectItem value="Minimal">Minimal (Tối giản)</SelectItem>
                      <SelectItem value="Bold">Bold (Đậm chất)</SelectItem>
                      <SelectItem value="Dark">Dark Mode</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Bảng màu / Màu thương hiệu</Label>
                  <Input placeholder="#00B14F, #1E5FAF hoặc mô tả màu sắc" value={form.colorPalette} onChange={e => set("colorPalette", e.target.value)} className="mt-1.5" /></div>
                <div><Label>Tỷ lệ slide</Label>
                  <Select value={form.aspectRatio} onValueChange={v => set("aspectRatio", v)}>
                    <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="16:9">16:9 (Widescreen)</SelectItem>
                      <SelectItem value="4:3">4:3 (Standard)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Ngôn ngữ</Label>
                  <Select value={form.language} onValueChange={v => set("language", v)}>
                    <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="vi">Tiếng Việt</SelectItem>
                      <SelectItem value="en">English</SelectItem>
                      <SelectItem value="vi-en">Song ngữ Việt - Anh</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {/* Step 3: Tài liệu đính kèm */}
            {step === 3 && (
              <div className="space-y-5">
                <div className="rounded-xl bg-blue-50 border border-blue-100 p-4 text-sm text-blue-700">
                  Bạn có thể đính kèm: <strong>logo thương hiệu, nội dung slide, bảng giá tham khảo, tài liệu mô tả</strong> hoặc bất kỳ file nào giúp chúng tôi hiểu yêu cầu của bạn hơn.
                </div>

                <div
                  className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer ${dragOver ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"}`}
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={e => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files); }}
                >
                  {uploading ? (
                    <div className="flex flex-col items-center gap-3">
                      <Loader2 className="w-8 h-8 text-primary animate-spin" />
                      <p className="text-sm text-muted-foreground">Đang tải file lên...</p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-12 h-12 rounded-xl brand-gradient flex items-center justify-center">
                        <Upload className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <p className="font-semibold text-sm">Kéo thả file vào đây hoặc click để chọn</p>
                        <p className="text-xs text-muted-foreground mt-1">PNG, JPG, PDF, DOCX, XLSX, PPTX — Tối đa 20MB mỗi file, tối đa 10 file</p>
                      </div>
                      <Button type="button" variant="outline" size="sm">Chọn file</Button>
                    </div>
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    className="hidden"
                    accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt"
                    onChange={e => handleFiles(e.target.files)}
                  />
                </div>

                {attachments.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-muted-foreground">{attachments.length} file đã tải lên:</p>
                    {attachments.map(att => (
                      <div key={att.url} className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 border border-border/50 group">
                        <div className="flex-shrink-0">{fileIcon(att.type)}</div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{att.name}</p>
                          {att.size && <p className="text-xs text-muted-foreground">{formatSize(att.size)}</p>}
                        </div>
                        <button
                          type="button"
                          onClick={() => removeAttachment(att.url)}
                          className="text-muted-foreground hover:text-destructive transition-colors opacity-0 group-hover:opacity-100"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {attachments.length === 0 && (
                  <p className="text-center text-sm text-muted-foreground">
                    Không bắt buộc — bạn có thể bỏ qua bước này
                  </p>
                )}
              </div>
            )}

            {/* Step 4: Nội dung & Deadline */}
            {step === 4 && (
              <div className="space-y-4">
                <div><Label>Deadline mong muốn *</Label>
                  <Input type="date" value={form.deadline} onChange={e => set("deadline", e.target.value)} className="mt-1.5"
                    min={new Date(Date.now() + 3 * 86400000).toISOString().split("T")[0]} /></div>
                <div><Label>Ngân sách dự kiến</Label>
                  <Select value={form.budget} onValueChange={v => set("budget", v)}>
                    <SelectTrigger className="mt-1.5"><SelectValue placeholder="Chọn khoảng ngân sách" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="< 2 triệu">Dưới 2 triệu VND</SelectItem>
                      <SelectItem value="2-5 triệu">2 - 5 triệu VND</SelectItem>
                      <SelectItem value="5-10 triệu">5 - 10 triệu VND</SelectItem>
                      <SelectItem value="> 10 triệu">Trên 10 triệu VND</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Ghi chú thêm</Label>
                  <Textarea placeholder="Bất kỳ yêu cầu đặc biệt nào, màu sắc ưa thích, tông giọng nội dung..." value={form.notes} onChange={e => set("notes", e.target.value)} className="mt-1.5" rows={4} /></div>
              </div>
            )}

            {/* Step 5: Xác nhận */}
            {step === 5 && (
              <div className="space-y-3 text-sm">
                <div className="rounded-xl bg-slate-50 p-4 space-y-2">
                  {[
                    ["Họ tên", form.customerName], ["Email", form.customerEmail],
                    ["Điện thoại", form.customerPhone], ["Công ty", form.company],
                    ["Loại slide", form.slideType], ["Số slide", form.slideCount],
                    ["Phong cách", form.style], ["Ngôn ngữ", form.language],
                    ["Deadline", form.deadline], ["Ngân sách", form.budget],
                  ].map(([k, v]) => v ? (
                    <div key={k} className="flex justify-between">
                      <span className="text-muted-foreground">{k}:</span>
                      <span className="font-medium">{v}</span>
                    </div>
                  ) : null)}
                </div>
                {attachments.length > 0 && (
                  <div className="rounded-xl bg-slate-50 p-4">
                    <p className="font-medium mb-2">Tài liệu đính kèm ({attachments.length} file):</p>
                    {attachments.map(a => (
                      <div key={a.url} className="flex items-center gap-2 text-muted-foreground">
                        {fileIcon(a.type)}
                        <span className="truncate">{a.name}</span>
                      </div>
                    ))}
                  </div>
                )}
                <p className="text-muted-foreground text-xs">
                  Sau khi gửi, đội ngũ chúng tôi sẽ liên hệ với bạn qua email trong vòng 2 giờ làm việc.
                </p>
              </div>
            )}

            <div className="flex justify-between mt-8">
              <Button variant="outline" onClick={() => setStep(s => s - 1)} disabled={step === 0}>
                <ArrowLeft className="w-4 h-4 mr-2" /> Quay lại
              </Button>
              {step < STEPS.length - 1 ? (
                <Button className="brand-gradient border-none" onClick={() => setStep(s => s + 1)}
                  disabled={step === 0 && (!form.customerName || !form.customerEmail)}>
                  Tiếp theo <ArrowRight className="ml-2 w-4 h-4" />
                </Button>
              ) : (
                <Button className="brand-gradient border-none" onClick={handleSubmit} disabled={createRequest.isPending}>
                  {createRequest.isPending ? "Đang gửi..." : "Gửi yêu cầu"}
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
