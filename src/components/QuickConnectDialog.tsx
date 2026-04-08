import { useState, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, CheckCircle2, XCircle, Smartphone } from "lucide-react";
import { toast } from "sonner";

const JELLYFIN_BASE = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/jellyfin-server`;

interface QuickConnectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type Status = "idle" | "loading" | "success" | "error";

export function QuickConnectDialog({ open, onOpenChange }: QuickConnectDialogProps) {
  const [code, setCode] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const handleAuthorize = useCallback(async () => {
    const trimmed = code.trim();
    if (!trimmed || trimmed.length < 4) {
      setErrorMsg("Entrez un code valide");
      setStatus("error");
      return;
    }

    setStatus("loading");
    setErrorMsg("");

    try {
      const res = await fetch(`${JELLYFIN_BASE}/QuickConnect/Authorize?Code=${encodeURIComponent(trimmed)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Code invalide ou expiré");
      }

      setStatus("success");
      toast.success("Appareil autorisé avec succès !");
      setTimeout(() => {
        onOpenChange(false);
        setCode("");
        setStatus("idle");
      }, 1500);
    } catch (e: any) {
      setErrorMsg(e.message || "Erreur de connexion");
      setStatus("error");
    }
  }, [code, onOpenChange]);

  const handleClose = (v: boolean) => {
    if (!v) {
      setCode("");
      setStatus("idle");
      setErrorMsg("");
    }
    onOpenChange(v);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[360px] p-0 overflow-hidden border-0"
        style={{
          background: "linear-gradient(145deg, hsl(var(--card) / 0.95), hsl(var(--card) / 0.85))",
          backdropFilter: "blur(80px) saturate(2)",
          WebkitBackdropFilter: "blur(80px) saturate(2)",
        }}
      >
        <div className="p-6 space-y-5">
          <DialogHeader className="space-y-2">
            <div className="mx-auto w-12 h-12 rounded-2xl flex items-center justify-center"
              style={{ background: "hsl(var(--primary) / 0.1)" }}
            >
              <Smartphone className="w-6 h-6 text-primary" />
            </div>
            <DialogTitle className="text-center text-base font-bold text-foreground">
              QuickConnect
            </DialogTitle>
            <DialogDescription className="text-center text-xs text-muted-foreground leading-relaxed">
              Entrez le code affiché sur votre appareil Jellyfin pour l'autoriser à se connecter.
            </DialogDescription>
          </DialogHeader>

          {/* Code input */}
          <div className="space-y-3">
            <input
              type="text"
              inputMode="numeric"
              maxLength={8}
              placeholder="000000"
              value={code}
              onChange={(e) => {
                setCode(e.target.value.replace(/[^0-9]/g, ""));
                if (status === "error") setStatus("idle");
              }}
              disabled={status === "loading" || status === "success"}
              className="w-full text-center text-2xl font-mono font-bold tracking-[0.5em] py-3 rounded-xl border-0 outline-none transition-colors"
              style={{
                background: "hsl(var(--muted) / 0.3)",
                color: "hsl(var(--foreground))",
                caretColor: "hsl(var(--primary))",
              }}
              autoFocus
            />

            <AnimatePresence mode="wait">
              {status === "error" && errorMsg && (
                <motion.p
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="text-xs text-destructive text-center flex items-center justify-center gap-1"
                >
                  <XCircle className="w-3 h-3" />
                  {errorMsg}
                </motion.p>
              )}
              {status === "success" && (
                <motion.p
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="text-xs text-green-500 text-center flex items-center justify-center gap-1"
                >
                  <CheckCircle2 className="w-3 h-3" />
                  Appareil autorisé !
                </motion.p>
              )}
            </AnimatePresence>
          </div>

          {/* Authorize button */}
          <button
            onClick={handleAuthorize}
            disabled={status === "loading" || status === "success" || code.length < 4}
            className="w-full py-3 rounded-xl font-semibold text-sm transition-all active:scale-[0.97] disabled:opacity-40"
            style={{
              background: "linear-gradient(135deg, hsl(var(--primary)), hsl(var(--primary) / 0.8))",
              color: "hsl(var(--primary-foreground))",
            }}
          >
            {status === "loading" ? (
              <Loader2 className="w-4 h-4 animate-spin mx-auto" />
            ) : status === "success" ? (
              <CheckCircle2 className="w-4 h-4 mx-auto" />
            ) : (
              "Autoriser l'appareil"
            )}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
