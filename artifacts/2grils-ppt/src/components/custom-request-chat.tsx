import { useEffect, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Paperclip, Send, FileArchive, X, Download } from "lucide-react";

interface CustomRequestFile {
  name: string;
  url: string;
  type: string;
  size?: number;
}

interface Message {
  id: number;
  requestId: number;
  authorId: number | null;
  authorRole: "customer" | "admin" | "staff";
  authorName: string;
  body: string;
  attachments: CustomRequestFile[];
  createdAt: string;
}

interface Props {
  /** Public requestId string (e.g. "CUSTOM-2025-ABCD1234"). */
  requestId: string;
  /** Status from the parent — chat is disabled when not in the active window. */
  status: string;
  /** Role of the viewer — controls bubble alignment and "you" framing. */
  viewerRole: "customer" | "admin" | "staff";
  /** Compact mode shrinks paddings and uses smaller font, for admin sidepanels. */
  compact?: boolean;
}

const MESSAGEABLE_STATUSES = new Set([
  "in-progress",
  "review",
  "finalizing",
  "final-payment",
  "delivered",
]);

const ROLE_LABEL: Record<Message["authorRole"], string> = {
  customer: "Khách hàng",
  admin: "Admin",
  staff: "Nhân viên",
};

function formatBytes(bytes?: number): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isArchive(type: string, name: string): boolean {
  return /zip|rar|compressed|octet-stream/i.test(type) || /\.(zip|rar|7z)$/i.test(name);
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const sameDay =
    d.getFullYear() === today.getFullYear() &&
    d.getMonth() === today.getMonth() &&
    d.getDate() === today.getDate();
  return d.toLocaleString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    ...(sameDay ? {} : { day: "2-digit", month: "2-digit" }),
  });
}

async function uploadAttachments(files: File[]): Promise<CustomRequestFile[]> {
  if (files.length === 0) return [];
  const fd = new FormData();
  for (const f of files) fd.append("files", f);
  const res = await fetch("/api/upload", {
    method: "POST",
    body: fd,
    headers: { Authorization: `Bearer ${localStorage.getItem("auth_token") ?? ""}` },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? `Upload thất bại (HTTP ${res.status})`);
  }
  const data = (await res.json()) as { files: CustomRequestFile[] };
  return data.files;
}

export function CustomRequestChat({ requestId, status, viewerRole, compact }: Props) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [draft, setDraft] = useState("");
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const listEndRef = useRef<HTMLDivElement | null>(null);

  const enabled = MESSAGEABLE_STATUSES.has(status);
  const queryKey = ["custom-request-messages", requestId] as const;

  const { data, isLoading } = useQuery<{ items: Message[] }>({
    queryKey,
    queryFn: () =>
      customFetch<{ items: Message[] }>(`/api/custom-requests/${requestId}/messages`),
    enabled,
    refetchInterval: enabled ? 10_000 : false,
  });

  const messages = data?.items ?? [];

  useEffect(() => {
    // Scroll to bottom when new messages arrive.
    listEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length]);

  const sendMutation = useMutation({
    mutationFn: async () => {
      setUploading(pendingFiles.length > 0);
      const uploaded = await uploadAttachments(pendingFiles);
      setUploading(false);
      return customFetch<Message>(`/api/custom-requests/${requestId}/messages`, {
        method: "POST",
        body: JSON.stringify({ body: draft, attachments: uploaded }),
      });
    },
    onSuccess: () => {
      setDraft("");
      setPendingFiles([]);
      if (fileInputRef.current) fileInputRef.current.value = "";
      queryClient.invalidateQueries({ queryKey });
    },
    onError: (e: any) => {
      setUploading(false);
      toast({ title: "Không gửi được tin nhắn", description: e?.message, variant: "destructive" });
    },
  });

  const handleFilePick = (ev: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(ev.target.files ?? []);
    if (files.length === 0) return;
    setPendingFiles((prev) => [...prev, ...files].slice(0, 10));
  };

  const removePending = (idx: number) => {
    setPendingFiles((prev) => prev.filter((_, i) => i !== idx));
  };

  if (!enabled) {
    return (
      <div className={`bg-slate-50 rounded-xl border border-slate-200 ${compact ? "p-3" : "p-4"} text-sm text-slate-500`}>
        Trao đổi sẽ mở khi đơn chuyển sang trạng thái "Đang thực hiện".
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-xl border border-slate-200 flex flex-col ${compact ? "h-80" : "h-[28rem]"}`}>
      <div className={`flex-1 overflow-y-auto ${compact ? "p-3" : "p-4"} space-y-3`}>
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-12 w-3/4" />
            <Skeleton className="h-12 w-2/3 ml-auto" />
            <Skeleton className="h-12 w-3/4" />
          </div>
        ) : messages.length === 0 ? (
          <p className="text-center text-sm text-slate-500 py-8">
            Chưa có tin nhắn nào. Bắt đầu trao đổi về bài thiết kế ở đây.
          </p>
        ) : (
          messages.map((m) => {
            const isMine =
              (viewerRole === "customer" && m.authorRole === "customer") ||
              (viewerRole !== "customer" && m.authorRole !== "customer");
            return (
              <div key={m.id} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[78%] rounded-2xl px-3.5 py-2 ${
                    isMine
                      ? "bg-primary text-white rounded-br-md"
                      : "bg-slate-100 text-slate-900 rounded-bl-md"
                  }`}
                >
                  <div
                    className={`text-[11px] font-medium mb-1 flex items-center gap-1.5 ${
                      isMine ? "text-white/80" : "text-slate-500"
                    }`}
                  >
                    <span>{m.authorName}</span>
                    <span className="opacity-70">· {ROLE_LABEL[m.authorRole]}</span>
                  </div>
                  {m.body && (
                    <p className="text-sm whitespace-pre-wrap break-words">{m.body}</p>
                  )}
                  {m.attachments.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {m.attachments.map((f, i) => (
                        <a
                          key={i}
                          href={f.url}
                          target="_blank"
                          rel="noreferrer"
                          download={f.name}
                          className={`flex items-center gap-2 text-xs rounded-lg px-2 py-1.5 ${
                            isMine ? "bg-white/15 hover:bg-white/25" : "bg-white border border-slate-200 hover:border-slate-300"
                          }`}
                        >
                          {isArchive(f.type, f.name) ? (
                            <FileArchive className="w-4 h-4 flex-shrink-0" />
                          ) : (
                            <Paperclip className="w-4 h-4 flex-shrink-0" />
                          )}
                          <span className="truncate flex-1">{f.name}</span>
                          <span className={`text-[10px] ${isMine ? "text-white/70" : "text-slate-500"}`}>
                            {formatBytes(f.size)}
                          </span>
                          <Download className={`w-3.5 h-3.5 flex-shrink-0 ${isMine ? "text-white/70" : "text-slate-500"}`} />
                        </a>
                      ))}
                    </div>
                  )}
                  <div
                    className={`text-[10px] mt-1 ${isMine ? "text-white/70" : "text-slate-500"}`}
                  >
                    {formatTime(m.createdAt)}
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={listEndRef} />
      </div>

      <div className={`border-t border-slate-200 ${compact ? "p-2" : "p-3"} space-y-2`}>
        {pendingFiles.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {pendingFiles.map((f, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1.5 bg-slate-100 rounded-full pl-2.5 pr-1 py-0.5 text-xs"
              >
                {isArchive(f.type, f.name) ? (
                  <FileArchive className="w-3.5 h-3.5 text-slate-500" />
                ) : (
                  <Paperclip className="w-3.5 h-3.5 text-slate-500" />
                )}
                <span className="max-w-[140px] truncate">{f.name}</span>
                <button
                  type="button"
                  onClick={() => removePending(i)}
                  className="text-slate-400 hover:text-slate-700 rounded-full p-0.5"
                  aria-label="Bỏ"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
        )}
        <div className="flex items-end gap-2">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={handleFilePick}
            accept=".zip,.rar,.7z,image/*,application/pdf,application/zip,application/x-zip-compressed,application/x-rar-compressed"
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => fileInputRef.current?.click()}
            className="flex-shrink-0"
            disabled={sendMutation.isPending}
          >
            <Paperclip className="w-4 h-4" />
          </Button>
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Nhập tin nhắn..."
            rows={compact ? 1 : 2}
            className="resize-none flex-1 min-h-[40px]"
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                if (draft.trim() || pendingFiles.length > 0) sendMutation.mutate();
              }
            }}
          />
          <Button
            onClick={() => sendMutation.mutate()}
            disabled={
              sendMutation.isPending ||
              uploading ||
              (!draft.trim() && pendingFiles.length === 0)
            }
            className="flex-shrink-0 gap-1.5"
          >
            <Send className="w-4 h-4" />
            <span className="hidden sm:inline">
              {uploading ? "Đang upload..." : sendMutation.isPending ? "Đang gửi..." : "Gửi"}
            </span>
          </Button>
        </div>
        <p className="text-[11px] text-slate-400">
          Ctrl/Cmd + Enter để gửi · File ZIP/RAR/ảnh tối đa 20MB/file · 10 file/lần
        </p>
      </div>
    </div>
  );
}
