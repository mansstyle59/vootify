import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import { useSubscription } from "@/hooks/useSubscription";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";
import { ShieldX, Crown, LogOut, Send, CheckCircle, Loader2 } from "lucide-react";

/**
 * Blocks access to the app if the user has no active subscription.
 * Admins always bypass this gate.
 */
export function SubscriptionGate({ children }: { children: React.ReactNode }) {
  const { user, signOut } = useAuth();
  const { isAdmin, loading: adminLoading } = useAdminAuth();
  const { isActive, loading: subLoading } = useSubscription(user?.id ?? null);

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

  // Check if user already has a pending request
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
    setSending(true);
    try {
      // Get display name from profile
      const { data: profile } = await supabase
        .from("profiles")
        .select("display_name")
        .eq("user_id", user.id)
        .maybeSingle();

      await supabase.from("access_requests").insert({
        user_id: user.id,
        user_email: user.email || "",
        display_name: profile?.display_name || user.email || "",
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
        className="text-center max-w-sm"
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
        <p className="text-muted-foreground text-sm mb-4 leading-relaxed">
          Votre abonnement n'est pas actif ou a expiré. Veuillez contacter votre administrateur pour activer votre accès.
        </p>

        <div className="bg-muted/50 rounded-xl p-4 mb-6 text-left">
          <p className="text-xs text-muted-foreground mb-2 font-medium uppercase tracking-wide">
            Comment obtenir l'accès ?
          </p>
          <ul className="text-sm text-foreground space-y-1.5">
            <li>• Contactez votre administrateur</li>
            <li>• Demandez l'activation de votre abonnement</li>
            <li>• L'accès sera immédiat une fois activé</li>
          </ul>
        </div>

        <div className="space-y-3">
          {!requested ? (
            <button
              type="button"
              onClick={handleRequest}
              disabled={sending}
              className="w-full py-3.5 rounded-xl bg-primary text-primary-foreground font-medium text-sm hover:bg-primary/90 transition-colors flex items-center justify-center gap-2.5 disabled:opacity-50"
            >
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              {sending ? "Envoi…" : "Faire une demande d'accès"}
            </button>
          ) : (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="w-full py-3.5 rounded-xl bg-primary/10 text-primary font-medium text-sm flex items-center justify-center gap-2.5"
            >
              <CheckCircle className="w-4 h-4" />
              Demande envoyée !
            </motion.div>
          )}

          <button
            type="button"
            onClick={handleSignOut}
            disabled={signingOut}
            className="w-full py-3.5 rounded-xl bg-muted text-muted-foreground font-medium text-sm hover:bg-muted/80 transition-colors flex items-center justify-center gap-2.5 disabled:opacity-50"
          >
            <LogOut className="w-4 h-4" />
            {signingOut ? "Déconnexion…" : "Se déconnecter"}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
