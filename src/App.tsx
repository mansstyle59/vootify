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
import { PageFade } from "@/components/PageFade";
import { NetworkStatus } from "@/components/NetworkStatus";
import { UpdateNotification } from "@/components/UpdateNotification";
import IosPwaInstallBanner from "@/components/IosPwaInstallBanner";
import { AuthGate } from "@/components/AuthGate";
import { PushNotificationPrompt } from "@/components/PushNotificationPrompt";
import { SubscriptionGate } from "@/components/SubscriptionGate";
import { RouteGuard } from "@/components/RouteGuard";
import { InitialCacheLoader } from "@/components/InitialCacheLoader";
import { silentCacheRefresh, isCacheReady } from "@/lib/appCache";
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
const AudioSettingsPage = lazy(() => import("./pages/AudioSettingsPage"));
const RequestAccessPage = lazy(() => import("./pages/RequestAccessPage"));
const NotFound = lazy(() => import("./pages/NotFound"));
const GenrePage = lazy(() => import("./pages/GenrePage"));
const SharedPlaylistDetailPage = lazy(() => import("./pages/SharedPlaylistDetailPage"));

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
  return (
    <Suspense fallback={<PageLoader />}>
      <PageFade>
        <RouteGuard>
          <Routes>
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
            <Route path="/audio-settings" element={<AudioSettingsPage />} />
            <Route path="/request-access" element={<RequestAccessPage />} />
            <Route path="/genre/:name" element={<GenrePage />} />
            <Route path="/shared-playlist/:id" element={<SharedPlaylistDetailPage />} />
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

  // Track usage time
  useUsageTracking();

  useEffect(() => {
    if (loading) return;
    const userId = user?.id || null;
    setUserId(userId);
    if (userId) {
      loadUserData(userId);
      if (isCacheReady()) {
        silentCacheRefresh(userId);
      }
      startCacheWarmup(userId);
    }
  }, [user, loading, loadUserData, setUserId]);

  // Refresh all data when PWA returns to foreground (reopen, tab switch)
  useEffect(() => {
    const userId = user?.id;
    if (!userId) return;

    let lastHidden = 0;

    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        lastHidden = Date.now();
        return;
      }
      // Only refresh if app was hidden for more than 5 seconds
      const away = Date.now() - lastHidden;
      if (away < 5000) return;

      // Invalidate all react-query caches → triggers refetch of visible queries
      queryClient.invalidateQueries();

      // Also refresh Supabase caches & player data
      silentCacheRefresh(userId);
      loadUserData(userId);
    };

    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [user, queryClient, loadUserData]);

  const handlePullRefresh = useCallback(async () => {
    await queryClient.invalidateQueries();
    const userId = user?.id;
    if (userId) {
      silentCacheRefresh(userId);
      loadUserData(userId);
    }
    toast.success("Contenu actualisé");
  }, [queryClient, user, loadUserData]);

  return (
    <div className="min-h-screen flex w-full">
      <AppSidebar />
      <PullToRefresh onRefresh={handlePullRefresh} className="flex-1 scrollbar-hide" style={{ paddingBottom: currentSong ? "calc(5.5rem + env(safe-area-inset-bottom, 0px))" : undefined }}>
        <AnimatedRoutes />
      </PullToRefresh>
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
              <UpdateNotification />
              <IosPwaInstallBanner />
              <PushNotificationPrompt />
              {showSplash && <SplashScreen onFinish={handleSplashFinish} />}
              <BrowserRouter>
                <AuthGate>
                  <InitialCacheLoader>
                    <SubscriptionGate>
                      <AppContent />
                    </SubscriptionGate>
                  </InitialCacheLoader>
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
