import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import Index from "./pages/Index.tsx";
import Creators from "./pages/Creators.tsx";
import Discover from "./pages/Discover.tsx";
import StartupDetail from "./pages/StartupDetail.tsx";
import ProductDetail from "./pages/ProductDetail.tsx";
import Apply from "./pages/Apply.tsx";
import Products from "./pages/Products.tsx";
import MyAccount from "./pages/MyAccount.tsx";
import Messages from "./pages/Messages.tsx";
import Login from "./pages/auth/Login.tsx";
import Signup from "./pages/auth/Signup.tsx";
import ForgotPassword from "./pages/auth/ForgotPassword.tsx";
import ResetPassword from "./pages/auth/ResetPassword.tsx";
import ClientDashboard from "./pages/dashboard/ClientDashboard.tsx";
import CreatorDashboard from "./pages/dashboard/CreatorDashboard.tsx";
import AdminDashboard from "./pages/dashboard/AdminDashboard.tsx";
import NotFound from "./pages/NotFound.tsx";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/creators" element={<Creators />} />
            <Route path="/discover" element={<Discover />} />
            <Route path="/startup/:slug" element={<StartupDetail />} />
            <Route path="/product/:id" element={<ProductDetail />} />
            <Route path="/apply" element={<Apply />} />
            <Route path="/products" element={<Products />} />
            <Route path="/my-account" element={<MyAccount />} />
            <Route path="/messages" element={<Messages />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/dashboard" element={<ClientDashboard />} />
            <Route path="/dashboard/favorites" element={<ClientDashboard />} />
            <Route path="/creator" element={<CreatorDashboard />} />
            <Route path="/admin" element={<AdminDashboard />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
