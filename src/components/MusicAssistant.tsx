import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageCircle, X, Send, Sparkles, Music2, Trash2, Clock, CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface MusicRequest {
  id: string;
  title: string;
  artist: string;
  notes: string | null;
  status: string;
  admin_response: string | null;
  created_at: string;
}

const SUGGESTIONS = [
  "Ajouter un morceau 🎵",
  "Ajouter un album complet",
  "Ajouter un artiste",
  "Suggestion de radio 📻",
];

export function MusicAssistantFAB() {
  const [open, setOpen] = useState(false);
  const [visible, setVisible] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const lastY = useRef(0);

  // Check for unread admin responses
  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || cancelled) return;
      const lastSeen = localStorage.getItem("vootify_requests_last_seen") || "1970-01-01";
      const { count } = await supabase
        .from("music_requests")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .not("admin_response", "is", null)
        .gt("resolved_at", lastSeen);
      if (!cancelled) setUnreadCount(count || 0);
    };
    check();
    return () => { cancelled = true; };
  }, [open]);

  const markSeen = () => {
    localStorage.setItem("vootify_requests_last_seen", new Date().toISOString());
    setUnreadCount(0);
  };

  useEffect(() => {
    if (open) return;
    const onScroll = () => {
      const y = window.scrollY;
      if (y > lastY.current + 8) setVisible(false);
      else if (y < lastY.current - 8) setVisible(true);
      lastY.current = y;
    };
    const scrollEls = document.querySelectorAll(".scrollbar-hide");
    const handlers: Array<() => void> = [];
    scrollEls.forEach((el) => {
      const h = () => {
        const t = (el as HTMLElement).scrollTop;
        if (t > lastY.current + 8) setVisible(false);
        else if (t < lastY.current - 8) setVisible(true);
        lastY.current = t;
      };
      el.addEventListener("scroll", h, { passive: true });
      handlers.push(() => el.removeEventListener("scroll", h));
    });
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      handlers.forEach((h) => h());
    };
  }, [open]);

  return (
    <>
      <AnimatePresence>
        {!open && visible && (
          <motion.button
            initial={{ opacity: 0, y: -10, filter: "blur(4px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: -10, filter: "blur(4px)" }}
            transition={{ duration: 0.35, ease: [0.25, 0.1, 0.25, 1] }}
            onClick={() => setOpen(true)}
            className="fixed z-50 top-0 left-0 right-0 flex items-center justify-center gap-2 active:opacity-80 transition-opacity"
            style={{
              paddingTop: "calc(env(safe-area-inset-top, 0px) + 4px)",
              paddingBottom: "4px",
              height: "calc(env(safe-area-inset-top, 0px) + var(--ai-banner-h, 28px))",
              background: "linear-gradient(90deg, hsl(var(--primary) / 0.15), hsl(var(--primary) / 0.08))",
              backdropFilter: "blur(20px) saturate(1.5)",
              WebkitBackdropFilter: "blur(20px) saturate(1.5)",
              borderBottom: "0.5px solid hsl(var(--primary) / 0.15)",
            }}
          >
            <Sparkles className="w-3.5 h-3.5 text-primary" />
            <span className="text-[11px] font-semibold text-primary tracking-wide">Demander du contenu</span>
          </motion.button>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 100, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 100, scale: 0.9 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed inset-0 z-50 flex flex-col"
            style={{ background: "hsl(var(--background))" }}
          >
            <RequestPanel onClose={() => setOpen(false)} />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

function StatusBadge({ status }: { status: string }) {
  const config = {
    pending: { icon: Clock, label: "En attente", color: "hsl(var(--muted-foreground))" },
    added: { icon: CheckCircle2, label: "Ajouté ✅", color: "hsl(142 71% 45%)" },
    rejected: { icon: XCircle, label: "Refusé", color: "hsl(0 84% 60%)" },
  }[status] || { icon: Clock, label: status, color: "hsl(var(--muted-foreground))" };

  const Icon = config.icon;
  return (
    <span className="inline-flex items-center gap-1 text-[11px] font-medium" style={{ color: config.color }}>
      <Icon className="w-3 h-3" />
      {config.label}
    </span>
  );
}

function RequestPanel({ onClose }: { onClose: () => void }) {
  const [requests, setRequests] = useState<MusicRequest[]>([]);
  const [title, setTitle] = useState("");
  const [artist, setArtist] = useState("");
  const [notes, setNotes] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const loadRequests = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from("music_requests")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50);
    if (data) setRequests(data);
  }, []);

  useEffect(() => { loadRequests(); }, [loadRequests]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  }, [requests.length]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !artist.trim()) {
      toast.error("Titre et artiste requis");
      return;
    }
    setIsLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error("Connecte-toi d'abord");
      setIsLoading(false);
      return;
    }
    const { error } = await supabase.from("music_requests").insert({
      user_id: user.id,
      title: title.trim(),
      artist: artist.trim(),
      notes: notes.trim() || null,
    });
    setIsLoading(false);
    if (error) {
      toast.error("Erreur lors de l'envoi");
    } else {
      toast.success("Demande envoyée !");
      setTitle("");
      setArtist("");
      setNotes("");
      setShowForm(false);
      loadRequests();
    }
  };

  const prefill = (type: string) => {
    setShowForm(true);
    if (type.includes("radio")) setNotes("Type: Radio");
    else if (type.includes("album")) setNotes("Type: Album complet");
    else setNotes("");
  };

  return (
    <>
      {/* Header */}
      <div
        className="flex items-center gap-3 px-4 py-3 flex-shrink-0"
        style={{
          paddingTop: "max(0.75rem, env(safe-area-inset-top))",
          borderBottom: "0.5px solid hsl(var(--border) / 0.3)",
          background: "hsl(var(--background) / 0.95)",
          backdropFilter: "blur(20px)",
        }}
      >
        <div
          className="w-10 h-10 rounded-2xl flex items-center justify-center"
          style={{ background: "linear-gradient(135deg, hsl(var(--primary)), hsl(var(--primary) / 0.7))" }}
        >
          <MessageCircle className="w-5 h-5 text-primary-foreground" />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-[15px] font-bold text-foreground">Demandes de contenu</h2>
          <p className="text-[11px] text-muted-foreground">Demande l'ajout de musiques ou radios</p>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="w-5 h-5" />
        </Button>
      </div>

      {/* Content */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4 scrollbar-hide">
        {!showForm && requests.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-6 py-12">
            <div
              className="w-20 h-20 rounded-3xl flex items-center justify-center"
              style={{ background: "linear-gradient(135deg, hsl(var(--primary) / 0.15), hsl(var(--primary) / 0.05))" }}
            >
              <Music2 className="w-10 h-10 text-primary" />
            </div>
            <div className="text-center">
              <h3 className="text-lg font-bold text-foreground mb-1">Demande du contenu 🎵</h3>
              <p className="text-sm text-muted-foreground max-w-[280px]">
                Il manque un morceau, un album ou une radio ? Fais ta demande et l'admin s'en occupe !
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-2 px-4">
              {SUGGESTIONS.map((s, i) => (
                <button
                  key={i}
                  onClick={() => prefill(s)}
                  className="px-3 py-1.5 rounded-full text-[12px] font-medium transition-colors active:scale-95"
                  style={{
                    background: "hsl(var(--primary) / 0.1)",
                    color: "hsl(var(--primary))",
                  }}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Form */}
        {showForm && (
          <motion.form
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            onSubmit={handleSubmit}
            className="rounded-2xl p-4 space-y-3"
            style={{ background: "hsl(var(--foreground) / 0.03)", border: "0.5px solid hsl(var(--border) / 0.2)" }}
          >
            <h3 className="text-[14px] font-bold text-foreground">Nouvelle demande</h3>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Titre du morceau / album"
              className="w-full bg-transparent text-[14px] text-foreground placeholder:text-muted-foreground outline-none px-3 py-2.5 rounded-xl"
              style={{ background: "hsl(var(--foreground) / 0.05)" }}
            />
            <input
              type="text"
              value={artist}
              onChange={(e) => setArtist(e.target.value)}
              placeholder="Artiste"
              className="w-full bg-transparent text-[14px] text-foreground placeholder:text-muted-foreground outline-none px-3 py-2.5 rounded-xl"
              style={{ background: "hsl(var(--foreground) / 0.05)" }}
            />
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Notes (album, année, genre...)"
              className="w-full bg-transparent text-[14px] text-foreground placeholder:text-muted-foreground outline-none px-3 py-2.5 rounded-xl"
              style={{ background: "hsl(var(--foreground) / 0.05)" }}
            />
            <div className="flex gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setShowForm(false)}
                className="flex-1 rounded-xl text-[13px]"
              >
                Annuler
              </Button>
              <Button
                type="submit"
                disabled={!title.trim() || !artist.trim() || isLoading}
                className="flex-1 rounded-xl text-[13px]"
                style={{ background: "hsl(var(--primary))" }}
              >
                <Send className="w-4 h-4 mr-1.5" />
                Envoyer
              </Button>
            </div>
          </motion.form>
        )}

        {/* Requests list */}
        {requests.length > 0 && (
          <>
            {!showForm && (
              <Button
                onClick={() => setShowForm(true)}
                className="w-full rounded-xl text-[13px] font-semibold"
                style={{ background: "hsl(var(--primary))" }}
              >
                <Send className="w-4 h-4 mr-1.5" />
                Nouvelle demande
              </Button>
            )}
            <div className="space-y-2">
              <h3 className="text-[13px] font-semibold text-muted-foreground">Mes demandes</h3>
              {requests.map((req) => (
                <motion.div
                  key={req.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-2xl p-3 space-y-1.5"
                  style={{ background: "hsl(var(--foreground) / 0.03)", border: "0.5px solid hsl(var(--border) / 0.15)" }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-[14px] font-semibold text-foreground truncate">{req.title}</p>
                      <p className="text-[12px] text-muted-foreground truncate">{req.artist}</p>
                    </div>
                    <StatusBadge status={req.status} />
                  </div>
                  {req.notes && (
                    <p className="text-[12px] text-muted-foreground/70">{req.notes}</p>
                  )}
                  {req.admin_response && (
                    <div
                      className="rounded-xl px-3 py-2 mt-1"
                      style={{ background: "hsl(var(--primary) / 0.08)" }}
                    >
                      <p className="text-[11px] font-semibold text-primary mb-0.5">Réponse admin</p>
                      <p className="text-[13px] text-foreground">{req.admin_response}</p>
                    </div>
                  )}
                  <p className="text-[10px] text-muted-foreground/50">
                    {new Date(req.created_at).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })}
                  </p>
                </motion.div>
              ))}
            </div>
          </>
        )}
      </div>
    </>
  );
}
