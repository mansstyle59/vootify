import { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import { useSubscription } from "@/hooks/useSubscription";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";
import { ShieldX, Crown, LogOut, Send, CheckCircle, Loader2, Mail, Calendar, LogIn } from "lucide-react";

/**
 * Blocks access to the app if the user has no active subscription.
 * Admins always bypass this gate.
 */
export function SubscriptionGate({ children }: { children: React.ReactNode }) {
  const { user, signOut } = useAuth();
  const { isAdmin, loading: adminLoading } = useAdminAuth();
  const { isActive, loading: subLoading } = useSubscription(user?.id ?? null);
  const location = useLocation();

  // Allow auth-related routes to bypass the gate
  const publicPaths = ["/auth", "/reset-password"];
  if (publicPaths.includes(location.pathname)) return <>{children}</>;

  // Still loading → don't flash
  if (adminLoading || subLoading) return null;

  // Admins always pass
  if (isAdmin) return <>{children}</>;

  // Active subscription → pass
  if (isActive) return <>{children}</>;

  // No active subscription → show block screen
  return <NoSubscriptionScreen onSignOut={signOut} user={user} />;
}

function NoSubscriptionScreen({ onSignOut, user }: { onSignOut: () => void; user: any }) {
  const [requested, setRequested] = useState(false);
  const [sending, setSending] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [alreadyRequested, setAlreadyRequested] = useState(false);
  const [contactEmail, setContactEmail] = useState(user?.email || "");
  const [selectedDuration, setSelectedDuration] = useState<{ value: number; unit: "days" | "months" }>({ value: 30, unit: "days" });

  const durationOptions = [
    { label: "7 jours", value: 7, unit: "days" as const },
    { label: "1 mois", value: 1, unit: "months" as const },
    { label: "6 mois", value: 6, unit: "months" as const },
    { label: "1 an", value: 12, unit: "months" as const },
  ];

  useEffect(() => {
    if (!user) return;
    supabase
      .from("access_requests")
      .select("id")
      .eq("user_id", user.id)
      .eq("status", "pending")
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setRequested(true);
          setAlreadyRequested(true);
        }
      });
  }, [user]);

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await supabase.auth.signOut();
      window.location.href = "/";
    } catch {
      setSigningOut(false);
    }
  };

  const handleRequest = async () => {
    if (!user) return;
    if (!contactEmail.trim()) return;
    setSending(true);
    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("display_name")
        .eq("user_id", user.id)
        .maybeSingle();

      await supabase.from("access_requests").insert({
        user_id: user.id,
        user_email: contactEmail.trim(),
        display_name: profile?.display_name || user.email || "",
        requested_duration: selectedDuration.value,
        requested_duration_unit: selectedDuration.unit,
      });
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
          Abonnement requis
        </h1>
        <p className="text-muted-foreground text-sm mb-5 leading-relaxed">
          Remplissez le formulaire ci-dessous pour demander l'activation de votre accès.
        </p>

        <div className="space-y-3">
          {!requested ? (
            <>
              {/* Email field */}
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

              {/* Duration */}
              <div className="text-left">
                <label className="text-xs text-muted-foreground font-medium mb-1 block">
                  Durée d'abonnement souhaitée
                </label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                      type="number"
                      min={1}
                      max={365}
                      value={duration}
                      onChange={(e) => setDuration(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-full bg-muted/50 border border-border rounded-xl px-3 py-3 pl-10 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                  <select
                    value={durationUnit}
                    onChange={(e) => setDurationUnit(e.target.value as "days" | "months")}
                    className="bg-muted/50 border border-border rounded-xl px-3 py-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="days">Jours</option>
                    <option value="months">Mois</option>
                  </select>
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
            onClick={() => { window.location.href = "/auth"; }}
            className="w-full py-3.5 rounded-xl bg-muted text-muted-foreground font-medium text-sm hover:bg-muted/80 transition-colors flex items-center justify-center gap-2.5"
          >
            <LogIn className="w-4 h-4" />
            Se connecter
          </button>
        </div>
      </motion.div>
    </div>
  );
}
