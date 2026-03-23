import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { AppSidebar, MobileNav } from "@/components/AppSidebar";
import { MiniPlayer, FullScreenPlayer } from "@/components/Player";
import { usePlayerStore } from "@/stores/playerStore";
import { AnimatePresence } from "framer-motion";
import { useEffect } from "react";
import Home from "./pages/Home";
import SearchPage from "./pages/SearchPage";
import LibraryPage from "./pages/LibraryPage";
import RadioPage from "./pages/RadioPage";
import AddContentPage from "./pages/AddContentPage";
import InfosPage from "./pages/InfosPage";
import AuthPage from "./pages/AuthPage";
import NotFound from "./pages/NotFound";
import { Loader2 } from "lucide-react";

const queryClient = new QueryClient();

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) return <Navigate to="/auth" replace />;
  return <>{children}</>;
}

function AppContent() {
  const { user } = useAuth();
  const fullScreen = usePlayerStore((s) => s.fullScreen);
  const loadUserData = usePlayerStore((s) => s.loadUserData);
  const setUserId = usePlayerStore((s) => s.setUserId);

  useEffect(() => {
    if (user) {
      setUserId(user.id);
      loadUserData(user.id);
    } else {
      setUserId(null);
    }
  }, [user, loadUserData, setUserId]);

  return (
    <Routes>
      <Route path="/auth" element={user ? <Navigate to="/" replace /> : <AuthPage />} />
      <Route
        path="/*"
        element={
          <ProtectedRoute>
            <div className="min-h-screen flex w-full">
              <AppSidebar />
              <main className="flex-1 overflow-y-auto scrollbar-hide">
                <Routes>
                  <Route path="/" element={<Home />} />
                  <Route path="/search" element={<SearchPage />} />
                  <Route path="/library" element={<LibraryPage />} />
                  <Route path="/radio" element={<RadioPage />} />
                  <Route path="/infos" element={<InfosPage />} />
                  <Route path="/add" element={<AddContentPage />} />
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </main>
              <MiniPlayer />
              <MobileNav />
              <AnimatePresence>
                {fullScreen && <FullScreenPlayer />}
              </AnimatePresence>
            </div>
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <AppContent />
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
