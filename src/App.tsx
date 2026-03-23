import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppSidebar, MobileNav } from "@/components/AppSidebar";
import { MiniPlayer, FullScreenPlayer } from "@/components/Player";
import { usePlayerStore } from "@/stores/playerStore";
import { AnimatePresence } from "framer-motion";
import Home from "./pages/Home";
import SearchPage from "./pages/SearchPage";
import LibraryPage from "./pages/LibraryPage";
import RadioPage from "./pages/RadioPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function AppContent() {
  const fullScreen = usePlayerStore((s) => s.fullScreen);

  return (
    <div className="min-h-screen flex w-full">
      <AppSidebar />
      <main className="flex-1 overflow-y-auto scrollbar-hide">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/search" element={<SearchPage />} />
          <Route path="/library" element={<LibraryPage />} />
          <Route path="/radio" element={<RadioPage />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
      <MiniPlayer />
      <MobileNav />
      <AnimatePresence>
        {fullScreen && <FullScreenPlayer />}
      </AnimatePresence>
    </div>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Sonner />
      <BrowserRouter>
        <AppContent />
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
