import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { customFetch } from "@workspace/api-client-react";
import { useMutation } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

export default function ResetPassword() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [token, setToken] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const t = params.get("token");
    if (!t) {
      toast({ title: "Thiếu token", description: "Link không hợp lệ", variant: "destructive" });
      setLocation("/login");
      return;
    }
    setToken(t);
  }, [setLocation, toast]);

  const resetMutation = useMutation({
    mutationFn: () =>
      customFetch("/api/auth/reset-password", {
        method: "POST",
        body: JSON.stringify({ token, newPassword }),
      }),
    onSuccess: () => {
      setSuccess(true);
      toast({ title: "Đặt lại mật khẩu thành công", description: "Bạn có thể đăng nhập lại" });
    },
    onError: (e: any) =>
      toast({ title: "Lỗi", description: e?.message ?? "Không thể đặt lại mật khẩu", variant: "destructive" }),
  });

  if (!token) return null;

  return (
    <Layout>
      <div className="container mx-auto px-4 py-16 max-w-md">
        <Card>
          <CardContent className="pt-6 space-y-5">
            <h1 className="text-2xl font-extrabold">Đặt lại mật khẩu</h1>

            {success ? (
              <div className="space-y-4">
                <p className="text-sm text-emerald-700">
                  Mật khẩu đã được đặt lại thành công.
                </p>
                <Button className="w-full" onClick={() => setLocation("/login")}>
                  Đăng nhập
                </Button>
              </div>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">
                  Nhập mật khẩu mới (tối thiểu 6 ký tự).
                </p>
                <div>
                  <Label>Mật khẩu mới</Label>
                  <Input
                    type="password"
                    className="mt-1.5"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                  />
                </div>
                <div>
                  <Label>Xác nhận mật khẩu</Label>
                  <Input
                    type="password"
                    className="mt-1.5"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                  />
                  {confirm && confirm !== newPassword && (
                    <p className="text-xs text-red-600 mt-1">Mật khẩu xác nhận không khớp</p>
                  )}
                </div>
                <Button
                  className="w-full"
                  disabled={
                    resetMutation.isPending ||
                    newPassword.length < 6 ||
                    newPassword !== confirm
                  }
                  onClick={() => resetMutation.mutate()}
                >
                  {resetMutation.isPending ? "Đang xử lý..." : "Đặt lại mật khẩu"}
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
