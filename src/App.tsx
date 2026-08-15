import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { FavoritesProvider } from "@/contexts/FavoritesContext";
import { PageSkeleton } from "@/components/skeletons/PageSkeleton";
import { CreatorLocationAutoUpdate } from "@/components/creator/CreatorLocationAutoUpdate";
import { CreatorProfileLink } from "@/components/creator/CreatorProfileLink";

// Lazy-loaded page components — heavy deps (leaflet, recharts, WebRTC) are
// only fetched when the user navigates to the corresponding route.
const Index = lazy(() => import("./pages/Index"));
const Creators = lazy(() => import("./pages/Creators"));
const Discover = lazy(() => import("./pages/Discover"));
const MapView = lazy(() => import("./pages/MapView"));
const LiveCalendar = lazy(() => import("./pages/LiveCalendar"));
const ImageSearch = lazy(() => import("./pages/ImageSearch"));
const StartupDetail = lazy(() => import("./pages/StartupDetail"));
const ProductDetail = lazy(() => import("./pages/ProductDetail"));
const Apply = lazy(() => import("./pages/Apply"));
const Products = lazy(() => import("./pages/Products"));
const MyAccount = lazy(() => import("./pages/MyAccount"));
const Messages = lazy(() => import("./pages/Messages"));
const Login = lazy(() => import("./pages/auth/Login"));
const Signup = lazy(() => import("./pages/auth/Signup"));
const ForgotPassword = lazy(() => import("./pages/auth/ForgotPassword"));
const ResetPassword = lazy(() => import("./pages/auth/ResetPassword"));
const ClientDashboard = lazy(() => import("./pages/dashboard/ClientDashboard"));
const CreatorDashboard = lazy(() => import("./pages/dashboard/CreatorDashboard"));
const AdminDashboard = lazy(() => import("./pages/dashboard/AdminDashboard"));
const NotFound = lazy(() => import("./pages/NotFound"));
const AppPreview = lazy(() => import("./pages/AppPreview"));
const Notifications = lazy(() => import("./pages/Notifications"));
const OAuthConsent = lazy(() => import("./pages/OAuthConsent"));
const AIAssistant = lazy(() => import("./components/AIAssistant").then(m => ({ default: m.AIAssistant })));

const queryClient = new QueryClient();

const CreatorArea = () => (
  <>
    <CreatorProfileLink />
    <CreatorDashboard />
  </>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <FavoritesProvider>
            <CreatorLocationAutoUpdate />
            <Suspense fallback={<PageSkeleton />}>
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/creators" element={<Creators />} />
                <Route path="/discover" element={<Discover />} />
                <Route path="/map" element={<MapView />} />
                <Route path="/lives" element={<LiveCalendar />} />
                <Route path="/image-search" element={<ImageSearch />} />
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
                <Route path="/favorites" element={<ClientDashboard />} />
                <Route path="/creator" element={<CreatorArea />} />
                <Route path="/admin" element={<AdminDashboard />} />
                <Route path="/app-preview" element={<AppPreview />} />
                <Route path="/notifications" element={<Notifications />} />
                <Route path="/.lovable/oauth/consent" element={<OAuthConsent />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
            <Suspense fallback={null}>
              <AIAssistant />
            </Suspense>
          </FavoritesProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
