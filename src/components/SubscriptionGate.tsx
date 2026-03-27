import { useAuth } from "@/hooks/useAuth";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import { useSubscription } from "@/hooks/useSubscription";
import { motion } from "framer-motion";
import { ShieldX, Crown, LogOut } from "lucide-react";

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
  return <NoSubscriptionScreen onSignOut={signOut} />;
}

function NoSubscriptionScreen({ onSignOut }: { onSignOut: () => void }) {
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

        <button
          onClick={onSignOut}
          className="w-full py-3.5 rounded-xl bg-muted text-muted-foreground font-medium text-sm hover:bg-muted/80 transition-colors flex items-center justify-center gap-2.5"
        >
          <LogOut className="w-4 h-4" />
          Se déconnecter
        </button>
      </motion.div>
    </div>
  );
}
