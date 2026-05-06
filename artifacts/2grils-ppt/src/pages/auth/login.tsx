import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useLogin, getGetCurrentUserQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export default function Login() {
  const [, setLocation] = useLocation();
  const login = useLogin();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    login.mutate({ data: { email, password } }, {
      onSuccess: (data: any) => {
        localStorage.setItem("auth_token", data.token);
        queryClient.invalidateQueries({ queryKey: getGetCurrentUserQueryKey() });
        toast({ title: "Đăng nhập thành công!" });
        setLocation("/dashboard");
      },
      onError: () => {
        toast({ title: "Email hoặc mật khẩu không đúng", variant: "destructive" });
      },
    });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/">
            <span className="text-2xl font-extrabold brand-gradient-text cursor-pointer">2Grils.PPT</span>
          </Link>
        </div>
        <Card className="shadow-lg border-0">
          <CardHeader className="pb-4">
            <CardTitle className="text-2xl font-bold text-center">Đăng nhập</CardTitle>
            <CardDescription className="text-center">Chào mừng bạn trở lại!</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="ban@email.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  data-testid="input-email"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Mật khẩu</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  data-testid="input-password"
                />
              </div>
              <Button
                type="submit"
                className="w-full brand-gradient border-none h-11"
                disabled={login.isPending}
                data-testid="button-login"
              >
                {login.isPending ? "Đang đăng nhập..." : "Đăng nhập"}
              </Button>
            </form>
            <div className="mt-4 text-center text-sm text-muted-foreground">
              <p className="mt-2">
                Chưa có tài khoản?{" "}
                <Link href="/register" className="text-primary font-medium hover:underline">
                  Đăng ký ngay
                </Link>
              </p>
            </div>
            <div className="mt-4 p-3 rounded-lg bg-slate-50 text-xs text-muted-foreground">
              <p className="font-medium mb-1">Tài khoản demo:</p>
              <p>Admin: admin@2grils.com / admin123</p>
              <p>User: demo@example.com / demo123</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
