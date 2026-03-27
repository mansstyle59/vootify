import { toast } from "sonner";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppSidebar, MobileNav } from "@/components/AppSidebar";
import { AdminAuthProvider } from "@/hooks/useAdminAuth";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { MiniPlayer, FullScreenPlayer } from "@/components/Player";
import { usePlayerStore } from "@/stores/playerStore";
import { PullToRefresh } from "@/components/PullToRefresh";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState, useCallback, lazy, Suspense, startTransition, memo } from "react";
import { SplashScreen } from "@/components/SplashScreen";
import { ThemeProvider } from "@/hooks/useTheme";
import { PageLoader } from "@/components/PageLoader";
import { NetworkStatus } from "@/components/NetworkStatus";
import { AuthGate } from "@/components/AuthGate";
import { SubscriptionGate } from "@/components/SubscriptionGate";
import { startCacheWarmup } from "@/lib/cacheWarmup";
import { useUsageTracking } from "@/hooks/useUsageTracking";

// Lazy load all pages for faster initial load & smooth transitions
const Home = lazy(() => import("./pages/Home"));
const SearchPage = lazy(() => import("./pages/SearchPage"));
const LibraryPage = lazy(() => import("./pages/LibraryPage"));
const RadioPage = lazy(() => import("./pages/RadioPage"));
const AddContentPage = lazy(() => import("./pages/AddContentPage"));
const PlaylistDetailPage = lazy(() => import("./pages/PlaylistDetailPage"));
const AlbumDetailPage = lazy(() => import("./pages/AlbumDetailPage"));
const ArtistPage = lazy(() => import("./pages/ArtistPage"));
const AuthPage = lazy(() => import("./pages/AuthPage"));
const ProfilePage = lazy(() => import("./pages/ProfilePage"));
const AdminPage = lazy(() => import("./pages/AdminPage"));
const ResetPasswordPage = lazy(() => import("./pages/ResetPasswordPage"));
const RequestAccessPage = lazy(() => import("./pages/RequestAccessPage"));
const NotFound = lazy(() => import("./pages/NotFound"));
const GenrePage = lazy(() => import("./pages/GenrePage"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 10,
      gcTime: 1000 * 60 * 60,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      retry: 1,
      networkMode: "offlineFirst",
      placeholderData: (prev: unknown) => prev, // keep previous data while refetching
    },
  },
});

const AnimatedRoutes = memo(function AnimatedRoutes() {
  const location = useLocation();

  return (
    <Suspense fallback={<PageLoader />}>
      <Routes location={location}>
        <Route path="/" element={<Home />} />
        <Route path="/search" element={<SearchPage />} />
        <Route path="/library" element={<LibraryPage />} />
        <Route path="/radio" element={<RadioPage />} />
        <Route path="/add" element={<AddContentPage />} />
        <Route path="/playlist/:id" element={<PlaylistDetailPage />} />
        <Route path="/album/:id" element={<AlbumDetailPage />} />
        <Route path="/artist/:name" element={<ArtistPage />} />
        <Route path="/auth" element={<AuthPage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/request-access" element={<RequestAccessPage />} />
        <Route path="/genre/:name" element={<GenrePage />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  );
});

function AppContent() {
  const fullScreen = usePlayerStore((s) => s.fullScreen);
  const loadUserData = usePlayerStore((s) => s.loadUserData);
  const setUserId = usePlayerStore((s) => s.setUserId);
  const { user, loading } = useAuth();
  const queryClient = useQueryClient();

  // Track usage time
  useUsageTracking();

  useEffect(() => {
    if (loading) return;
    const userId = user?.id || null;
    setUserId(userId);
    if (userId) {
      loadUserData(userId);
      // Warm up caches in background for instant navigation
      startCacheWarmup(userId);
    }
  }, [user, loading, loadUserData, setUserId]);

  return (
    <div className="min-h-screen flex w-full">
      <AppSidebar />
      <div className="flex-1 scrollbar-hide overflow-y-auto">
        <AnimatedRoutes />
      </div>
      {/* NotificationBell moved into HeroBanner */}
      <MiniPlayer />
      <MobileNav />
      <AnimatePresence>
        {fullScreen && <FullScreenPlayer />}
      </AnimatePresence>
    </div>
  );
}

const App = () => {
  const [showSplash, setShowSplash] = useState(true);
  const handleSplashFinish = useCallback(() => {
    startTransition(() => setShowSplash(false));
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <TooltipProvider>
          <AuthProvider>
            <AdminAuthProvider>
              <Sonner />
              <NetworkStatus />
              {showSplash && <SplashScreen onFinish={handleSplashFinish} />}
              <BrowserRouter>
                <AuthGate>
                  <SubscriptionGate>
                    <AppContent />
                  </SubscriptionGate>
                </AuthGate>
              </BrowserRouter>
            </AdminAuthProvider>
          </AuthProvider>
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
};

export default App;
