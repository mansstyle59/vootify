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
import { AnimatePresence } from "framer-motion";
import { useEffect, useState, useCallback } from "react";
import { SplashScreen } from "@/components/SplashScreen";
import { ANONYMOUS_USER_ID } from "@/lib/constants";
import { hdCache } from "@/lib/hdCache";

// Clear HD cache on app startup
hdCache.clear();
import Home from "./pages/Home";
import SearchPage from "./pages/SearchPage";
import LibraryPage from "./pages/LibraryPage";
import RadioPage from "./pages/RadioPage";
import AddContentPage from "./pages/AddContentPage";
import PlaylistDetailPage from "./pages/PlaylistDetailPage";
import AlbumDetailPage from "./pages/AlbumDetailPage";
import AuthPage from "./pages/AuthPage";
import ProfilePage from "./pages/ProfilePage";
import AdminPage from "./pages/AdminPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function AppContent() {
  const fullScreen = usePlayerStore((s) => s.fullScreen);
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

  const handleRefresh = useCallback(async () => {
    await queryClient.invalidateQueries();
  }, [queryClient]);

  return (
    <div className="min-h-screen flex w-full">
      <AppSidebar />
      <PullToRefresh onRefresh={handleRefresh} className="flex-1 scrollbar-hide">
        <Routes>
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
  const handleSplashFinish = useCallback(() => setShowSplash(false), []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <AdminAuthProvider>
            <Sonner />
            {showSplash && <SplashScreen onFinish={handleSplashFinish} />}
            <BrowserRouter>
              <AppContent />
            </BrowserRouter>
          </AdminAuthProvider>
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
