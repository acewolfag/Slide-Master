import { lazy, Suspense } from "react";
import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Skeleton } from "@/components/ui/skeleton";

import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import Templates from "@/pages/templates/index";
import TemplateDetail from "@/pages/templates/[id]";
import Cart from "@/pages/cart";
import Checkout from "@/pages/checkout";
import OrderSuccess from "@/pages/order-success/[id]";
import CustomDesign from "@/pages/custom-design/index";
import CustomDesignRequest from "@/pages/custom-design/request";
import CustomRequestDetail from "@/pages/custom-design/detail";
import ResetPassword from "@/pages/auth/reset-password";
import BlogList from "@/pages/blog/index";
import BlogPost from "@/pages/blog/[slug]";
import Login from "@/pages/auth/login";
import Register from "@/pages/auth/register";
import Dashboard from "@/pages/dashboard/index";
import SearchPage from "@/pages/search";

const AdminDashboard = lazy(() => import("@/pages/admin/index"));
const AdminOrders = lazy(() => import("@/pages/admin/orders"));
const AdminCustomRequests = lazy(() => import("@/pages/admin/custom-requests"));
const AdminUsers = lazy(() => import("@/pages/admin/users"));
const AdminVouchers = lazy(() => import("@/pages/admin/vouchers"));
const AdminTemplates = lazy(() => import("@/pages/admin/templates"));
const AdminPricing = lazy(() => import("@/pages/admin/pricing"));
const AdminBanner = lazy(() => import("@/pages/admin/banner"));
const AdminReviews = lazy(() => import("@/pages/admin/reviews"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
    },
  },
});

function AdminFallback() {
  return (
    <div className="flex min-h-screen bg-slate-50">
      <div className="w-56 bg-slate-900" />
      <div className="flex-1 p-8 space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    </div>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/templates" component={Templates} />
      <Route path="/templates/:id" component={TemplateDetail} />
      <Route path="/cart" component={Cart} />
      <Route path="/checkout" component={Checkout} />
      <Route path="/order-success/:id" component={OrderSuccess} />
      <Route path="/custom-design" component={CustomDesign} />
      <Route path="/custom-design/request" component={CustomDesignRequest} />
      <Route path="/custom-requests/:id" component={CustomRequestDetail} />
      <Route path="/blog" component={BlogList} />
      <Route path="/blog/:slug" component={BlogPost} />
      <Route path="/login" component={Login} />
      <Route path="/register" component={Register} />
      <Route path="/reset-password" component={ResetPassword} />
      <Route path="/dashboard" component={Dashboard} />
      <Route path="/search" component={SearchPage} />
      <Route path="/admin">
        <Suspense fallback={<AdminFallback />}>
          <AdminDashboard />
        </Suspense>
      </Route>
      <Route path="/admin/templates">
        <Suspense fallback={<AdminFallback />}>
          <AdminTemplates />
        </Suspense>
      </Route>
      <Route path="/admin/orders">
        <Suspense fallback={<AdminFallback />}>
          <AdminOrders />
        </Suspense>
      </Route>
      <Route path="/admin/custom-requests">
        <Suspense fallback={<AdminFallback />}>
          <AdminCustomRequests />
        </Suspense>
      </Route>
      <Route path="/admin/users">
        <Suspense fallback={<AdminFallback />}>
          <AdminUsers />
        </Suspense>
      </Route>
      <Route path="/admin/vouchers">
        <Suspense fallback={<AdminFallback />}>
          <AdminVouchers />
        </Suspense>
      </Route>
      <Route path="/admin/pricing">
        <Suspense fallback={<AdminFallback />}>
          <AdminPricing />
        </Suspense>
      </Route>
      <Route path="/admin/banner">
        <Suspense fallback={<AdminFallback />}>
          <AdminBanner />
        </Suspense>
      </Route>
      <Route path="/admin/reviews">
        <Suspense fallback={<AdminFallback />}>
          <AdminReviews />
        </Suspense>
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
