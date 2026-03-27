import { toast } from "sonner";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, useLocation } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppSidebar, MobileNav } from "@/components/AppSidebar";
import { AdminAuthProvider } from "@/hooks/useAdminAuth";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { MiniPlayer, FullScreenPlayer } from "@/components/Player";
import { usePlayerStore } from "@/stores/playerStore";
import { PullToRefresh } from "@/components/PullToRefresh";
import { AnimatePresence, motion } from "framer-motion"; // force refresh
import { useEffect, useState, useCallback, lazy, Suspense, startTransition } from "react";
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
const AuthPage = lazy(() => import("./pages/AuthPage"));
const ProfilePage = lazy(() => import("./pages/ProfilePage"));
const AdminPage = lazy(() => import("./pages/AdminPage"));
const ResetPasswordPage = lazy(() => import("./pages/ResetPasswordPage"));
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 10,
      gcTime: 1000 * 60 * 60,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      retry: 1,
      networkMode: "offlineFirst",
    },
  },
});

function AnimatedRoutes() {
  const location = useLocation();

  return (
    <Suspense fallback={<PageLoader />}>
      <AnimatePresence mode="wait">
        <motion.div
          key={location.pathname}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.12, ease: "easeOut" }}
          className="min-h-screen will-change-[opacity]"
        >
          <Routes location={location}>
            <Route path="/" element={<Home />} />
            <Route path="/search" element={<SearchPage />} />
            <Route path="/library" element={<LibraryPage />} />
            <Route path="/radio" element={<RadioPage />} />
            <Route path="/add" element={<AddContentPage />} />
            <Route path="/playlist/:id" element={<PlaylistDetailPage />} />
            <Route path="/album/:id" element={<AlbumDetailPage />} />
            <Route path="/auth" element={<AuthPage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/admin" element={<AdminPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </motion.div>
      </AnimatePresence>
    </Suspense>
  );
}

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

  const handleRefresh = useCallback(async () => {
    await queryClient.invalidateQueries();
    toast.success("Contenu mis à jour ✨");
  }, [queryClient]);

  return (
    <div className="min-h-screen flex w-full">
      <AppSidebar />
      <PullToRefresh onRefresh={handleRefresh} className="flex-1 scrollbar-hide">
        <AnimatedRoutes />
      </PullToRefresh>
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
                  <AppContent />
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
