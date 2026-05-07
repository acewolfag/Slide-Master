import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";

import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import Templates from "@/pages/templates/index";
import TemplateDetail from "@/pages/templates/[id]";
import Cart from "@/pages/cart";
import Checkout from "@/pages/checkout";
import OrderSuccess from "@/pages/order-success/[id]";
import CustomDesign from "@/pages/custom-design/index";
import CustomDesignRequest from "@/pages/custom-design/request";
import BlogList from "@/pages/blog/index";
import BlogPost from "@/pages/blog/[slug]";
import Login from "@/pages/auth/login";
import Register from "@/pages/auth/register";
import Dashboard from "@/pages/dashboard/index";
import SearchPage from "@/pages/search";
import AdminDashboard from "@/pages/admin/index";
import AdminOrders from "@/pages/admin/orders";
import AdminCustomRequests from "@/pages/admin/custom-requests";
import AdminUsers from "@/pages/admin/users";
import AdminVouchers from "@/pages/admin/vouchers";
import AdminTemplates from "@/pages/admin/templates";
import AdminPricing from "@/pages/admin/pricing";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
    },
  },
});

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
      <Route path="/blog" component={BlogList} />
      <Route path="/blog/:slug" component={BlogPost} />
      <Route path="/login" component={Login} />
      <Route path="/register" component={Register} />
      <Route path="/dashboard" component={Dashboard} />
      <Route path="/search" component={SearchPage} />
      <Route path="/admin" component={AdminDashboard} />
      <Route path="/admin/templates" component={AdminTemplates} />
      <Route path="/admin/orders" component={AdminOrders} />
      <Route path="/admin/custom-requests" component={AdminCustomRequests} />
      <Route path="/admin/users" component={AdminUsers} />
      <Route path="/admin/vouchers" component={AdminVouchers} />
      <Route path="/admin/pricing" component={AdminPricing} />
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
