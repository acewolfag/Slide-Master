import { Link, useLocation } from "wouter";
import { Search, ShoppingCart, User, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { useGetCart, useGetCurrentUser, useLogout, resetSession } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function Header() {
  const [location, setLocation] = useLocation();
  const { data: cart } = useGetCart();
  const { data: user } = useGetCurrentUser();
  const logout = useLogout();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const handleSearch = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const q = formData.get("q");
    if (q) {
      setLocation(`/search?q=${encodeURIComponent(q.toString())}`);
    }
  };

  const handleLogout = () => {
    // Clear local session state IMMEDIATELY so the UI reacts even if the
    // server logout call fails (network down, server restart, etc.)
    resetSession();
    queryClient.clear();
    // Fire-and-forget the server-side logout (no-op currently, but reserved
    // for future session-revocation logic).
    logout.mutate(undefined, {
      onSettled: () => {
        setLocation("/");
        toast({ title: "Đã đăng xuất" });
      },
    });
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-4 flex h-16 items-center justify-between">
        <div className="flex items-center gap-6">
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[300px] sm:w-[400px]">
              <nav className="flex flex-col gap-4 mt-8">
                <Link href="/" className="text-lg font-semibold">Trang chủ</Link>
                <Link href="/templates" className="text-lg font-semibold">Templates</Link>
                <Link href="/custom-design" className="text-lg font-semibold">Thiết kế riêng</Link>
                <Link href="/blog" className="text-lg font-semibold">Blog</Link>
              </nav>
            </SheetContent>
          </Sheet>

          <Link href="/" className="flex items-center gap-2">
            <img src="/logo.jpg" alt="2Grils.PPT" className="h-9 w-9 rounded-full object-cover flex-shrink-0" />
            <span className="text-xl font-black tracking-tight brand-gradient-text hidden sm:block">2Grils.PPT</span>
          </Link>

          <nav className="hidden md:flex items-center gap-6 text-sm font-medium">
            <Link href="/templates" className="transition-colors hover:text-primary">Templates</Link>
            <Link href="/custom-design" className="transition-colors hover:text-primary">Thiết kế riêng</Link>
            <Link href="/blog" className="transition-colors hover:text-primary">Blog</Link>
          </nav>
        </div>

        <div className="flex items-center gap-4">
          <form onSubmit={handleSearch} className="hidden lg:flex relative w-full max-w-sm items-center">
            <Search className="absolute left-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              name="q"
              type="search"
              placeholder="Tìm kiếm template..."
              className="w-full bg-background shadow-none appearance-none pl-8 md:w-[200px] lg:w-[300px] rounded-full border-muted-foreground/20 focus-visible:ring-primary"
            />
          </form>

          <Link href="/cart">
            <Button variant="ghost" size="icon" className="relative">
              <ShoppingCart className="h-5 w-5" />
              {cart?.items && cart.items.length > 0 && (
                <Badge className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 flex items-center justify-center text-[10px]">
                  {cart.items.length}
                </Badge>
              )}
            </Button>
          </Link>

          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="rounded-full">
                  <User className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <div className="flex items-center justify-start gap-2 p-2">
                  <div className="flex flex-col space-y-1 leading-none">
                    <p className="font-medium">{user.name}</p>
                    <p className="text-sm text-muted-foreground">{user.email}</p>
                  </div>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/dashboard">Dashboard</Link>
                </DropdownMenuItem>
                {user.role === 'admin' && (
                  <DropdownMenuItem asChild>
                    <Link href="/admin">Admin Panel</Link>
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout}>
                  Đăng xuất
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <div className="hidden sm:flex items-center gap-2">
              <Link href="/login">
                <Button variant="ghost">Đăng nhập</Button>
              </Link>
              <Link href="/register">
                <Button className="rounded-full brand-gradient border-none">Đăng ký</Button>
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
