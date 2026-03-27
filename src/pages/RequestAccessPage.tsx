import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { motion } from "framer-motion";
import { ShieldX, Crown, Send, CheckCircle, Loader2, Mail, LogIn, User } from "lucide-react";

const durationOptions = [
  { label: "7 jours", value: 7, unit: "days" as const },
  { label: "1 mois", value: 1, unit: "months" as const },
  { label: "6 mois", value: 6, unit: "months" as const },
  { label: "1 an", value: 12, unit: "months" as const },
  { label: "Illimité", value: 0, unit: "months" as const },
];

const RequestAccessPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [requested, setRequested] = useState(false);
  const [sending, setSending] = useState(false);
  const [contactEmail, setContactEmail] = useState(user?.email || "");
  const [pseudo, setPseudo] = useState("");
  const [selectedDuration, setSelectedDuration] = useState<{ value: number; unit: "days" | "months" }>({ value: 30, unit: "days" });

  const handleRequest = async () => {
    if (!contactEmail.trim()) return;
    setSending(true);
    try {
      const userId = user?.id || "00000000-0000-0000-0000-000000000000";
      const displayName = pseudo.trim() || user?.email?.split("@")[0] || contactEmail.split("@")[0];

      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("display_name")
          .eq("user_id", user.id)
          .maybeSingle();
        
        await supabase.from("access_requests").insert({
          user_id: user.id,
          user_email: contactEmail.trim(),
          display_name: profile?.display_name || displayName,
          requested_duration: selectedDuration.value,
          requested_duration_unit: selectedDuration.unit,
        });
      } else {
        // Not logged in — use edge function or anon insert
        await supabase.from("access_requests").insert({
          user_id: userId,
          user_email: contactEmail.trim(),
          display_name: displayName,
          requested_duration: selectedDuration.value,
          requested_duration_unit: selectedDuration.unit,
        });
      }
      setRequested(true);
    } catch {
      // ignore
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-background">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center max-w-sm w-full"
      >
        <div className="relative inline-flex mb-6">
          <div className="w-20 h-20 rounded-2xl bg-destructive/10 flex items-center justify-center">
            <ShieldX className="w-10 h-10 text-destructive" />
          </div>
          <div className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
            <Crown className="w-4 h-4 text-primary" />
          </div>
        </div>

        <h1 className="text-2xl font-display font-bold text-foreground mb-2">
          Demande d'abonnement
        </h1>
        <p className="text-muted-foreground text-sm mb-5 leading-relaxed">
          Remplissez le formulaire ci-dessous pour demander l'activation de votre accès.
        </p>

        <div className="space-y-3">
          {!requested ? (
            <>
              {/* Pseudo */}
              <div className="text-left">
                <label className="text-xs text-muted-foreground font-medium mb-1 block">
                  Pseudo
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    type="text"
                    value={pseudo}
                    onChange={(e) => setPseudo(e.target.value)}
                    placeholder="Votre pseudo"
                    className="w-full bg-muted/50 border border-border rounded-xl px-3 py-3 pl-10 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>

              {/* Email */}
              <div className="text-left">
                <label className="text-xs text-muted-foreground font-medium mb-1 block">
                  Adresse email de contact
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    type="email"
                    value={contactEmail}
                    onChange={(e) => setContactEmail(e.target.value)}
                    placeholder="votre@email.com"
                    className="w-full bg-muted/50 border border-border rounded-xl px-3 py-3 pl-10 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>

              <div className="text-left">
                <label className="text-xs text-muted-foreground font-medium mb-1.5 block">
                  Durée d'abonnement souhaitée
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {durationOptions.map((opt) => {
                    const isSelected = selectedDuration.value === opt.value && selectedDuration.unit === opt.unit;
                    return (
                      <button
                        key={opt.label}
                        type="button"
                        onClick={() => setSelectedDuration({ value: opt.value, unit: opt.unit })}
                        className={`py-2.5 rounded-xl text-sm font-medium transition-colors border ${
                          isSelected
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-muted/50 text-foreground border-border hover:bg-muted"
                        }`}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <button
                type="button"
                onClick={handleRequest}
                disabled={sending || !contactEmail.trim()}
                className="w-full py-3.5 rounded-xl bg-primary text-primary-foreground font-medium text-sm hover:bg-primary/90 transition-colors flex items-center justify-center gap-2.5 disabled:opacity-50 mt-2"
              >
                {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                {sending ? "Envoi…" : "Envoyer la demande"}
              </button>
            </>
          ) : (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="w-full py-4 rounded-xl bg-primary/10 text-primary font-medium text-sm flex flex-col items-center justify-center gap-2"
            >
              <CheckCircle className="w-6 h-6" />
              <span>Demande envoyée !</span>
              <span className="text-xs text-muted-foreground font-normal">
                Vous recevrez vos informations de connexion par email une fois approuvée.
              </span>
            </motion.div>
          )}

          <button
            type="button"
            onClick={() => navigate("/auth")}
            className="w-full py-3.5 rounded-xl bg-muted text-muted-foreground font-medium text-sm hover:bg-muted/80 transition-colors flex items-center justify-center gap-2.5"
          >
            <LogIn className="w-4 h-4" />
            Se connecter
          </button>
        </div>
      </motion.div>
    </div>
  );
};

export default RequestAccessPage;
