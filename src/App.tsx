import { toast } from "sonner";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, useLocation } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AdminAuthProvider } from "@/hooks/useAdminAuth";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { MiniPlayer, FullScreenPlayer } from "@/components/Player";
import { usePlayerStore } from "@/stores/playerStore";
import { PullToRefresh } from "@/components/PullToRefresh";
import { AnimatePresence } from "framer-motion";
import { useEffect, useCallback, lazy, Suspense, startTransition, memo, useState } from "react";
import { SplashScreen } from "@/components/SplashScreen";
import { ThemeProvider } from "@/hooks/useTheme";
import { PageLoader } from "@/components/PageLoader";
import { PageFade } from "@/components/PageFade";
import { AuthGate } from "@/components/AuthGate";
import { SubscriptionGate } from "@/components/SubscriptionGate";
import { RouteGuard } from "@/components/RouteGuard";
import { AppSidebar, MobileNav } from "@/components/AppSidebar";

// Lazy load all pages
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
const GenrePage = lazy(() => import("./pages/GenrePage"));
const SharedPlaylistDetailPage = lazy(() => import("./pages/SharedPlaylistDetailPage"));
const NotFound = lazy(() => import("./pages/NotFound"));
const Index = lazy(() => import("./pages/Index"));
const InstallPage = lazy(() => import("./pages/InstallPage"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 10,
      gcTime: 1000 * 60 * 60,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      retry: 1,
      networkMode: "offlineFirst",
      placeholderData: (prev: unknown) => prev,
    },
  },
});

const AnimatedRoutes = memo(function AnimatedRoutes() {
  return (
    <Suspense fallback={<PageLoader />}>
      <PageFade>
        <RouteGuard>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/index" element={<Index />} />
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
            <Route path="/genre/:name" element={<GenrePage />} />
            <Route path="/shared-playlist/:id" element={<SharedPlaylistDetailPage />} />
            <Route path="/install" element={<InstallPage />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </RouteGuard>
      </PageFade>
    </Suspense>
  );
});

function AppContent() {
  const fullScreen = usePlayerStore((s) => s.fullScreen);
  const currentSong = usePlayerStore((s) => s.currentSong);
  const loadUserData = usePlayerStore((s) => s.loadUserData);
  const setUserId = usePlayerStore((s) => s.setUserId);
  const { user, loading } = useAuth();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (loading) return;
    const userId = user?.id || null;
    setUserId(userId);
    if (userId) {
      loadUserData(userId);
    }
  }, [user, loading, loadUserData, setUserId]);

  // Refresh data when app returns to foreground
  useEffect(() => {
    const userId = user?.id;
    if (!userId) return;
    let lastHidden = 0;
    const onVisibility = () => {
      if (document.visibilityState === "hidden") { lastHidden = Date.now(); return; }
      if (Date.now() - lastHidden < 5000) return;
      queryClient.invalidateQueries();
      loadUserData(userId);
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [user, queryClient, loadUserData]);

  const handlePullRefresh = useCallback(async () => {
    await queryClient.refetchQueries({ type: "active" });
    const userId = user?.id;
    if (userId) loadUserData(userId);
    toast.success("Contenu actualisé");
  }, [queryClient, user, loadUserData]);

  return (
    <div className="min-h-screen flex w-full">
      <AppSidebar />
      <PullToRefresh onRefresh={handlePullRefresh} className="flex-1 scrollbar-hide" style={{ paddingBottom: currentSong ? "calc(5.5rem + env(safe-area-inset-bottom, 0px))" : undefined }}>
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
