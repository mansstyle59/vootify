import { motion } from "framer-motion";
import { Crown, Lock, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useSubscriptionAccess } from "@/hooks/useSubscriptionAccess";

interface UpgradePromptProps {
  feature?: string;
  inline?: boolean;
}

export function UpgradePrompt({ feature = "Cette fonctionnalité", inline = false }: UpgradePromptProps) {
  const navigate = useNavigate();
  const { plan, config } = useSubscriptionAccess();

  const nextPlan = plan === "premium" ? "Gold" : plan === "gold" ? "VIP" : "un abonnement supérieur";

  if (inline) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col items-center justify-center py-16 px-6 text-center"
      >
        <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
          <Lock className="w-7 h-7 text-primary" />
        </div>
        <h3 className="text-base font-bold text-foreground mb-1">Accès restreint</h3>
        <p className="text-xs text-muted-foreground max-w-[260px] leading-relaxed">
          {feature} est réservé aux abonnés <span className="font-semibold text-primary">{nextPlan}</span>.
        </p>
        <button
          onClick={() => navigate("/request-access")}
          className="mt-4 px-5 py-2.5 rounded-full bg-primary text-primary-foreground text-sm font-semibold hover:brightness-110 transition-all flex items-center gap-2"
        >
          <Crown className="w-4 h-4" />
          Demander un upgrade
        </button>
      </motion.div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-background">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center max-w-sm w-full"
      >
        <div className="relative inline-flex mb-6">
          <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center">
            <Lock className="w-10 h-10 text-primary" />
          </div>
          <div className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
            <Crown className="w-4 h-4 text-primary" />
          </div>
        </div>

        <h1 className="text-2xl font-display font-bold text-foreground mb-2">
          Accès restreint
        </h1>
        <p className="text-muted-foreground text-sm mb-6 leading-relaxed">
          {feature} est réservé aux abonnés <span className="font-semibold text-primary">{nextPlan}</span>. Mettez à niveau votre abonnement pour débloquer cette fonctionnalité.
        </p>

        <div className="space-y-3">
          <button
            onClick={() => navigate("/request-access")}
            className="w-full py-3.5 rounded-xl bg-primary text-primary-foreground font-medium text-sm hover:brightness-110 transition-all flex items-center justify-center gap-2"
          >
            <Crown className="w-4 h-4" />
            Demander un upgrade
          </button>
          <button
            onClick={() => navigate(-1)}
            className="w-full py-3.5 rounded-xl bg-muted text-muted-foreground font-medium text-sm hover:bg-muted/80 transition-colors flex items-center justify-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Retour
          </button>
        </div>

        {/* Current plan badge */}
        <div className="mt-6 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-muted border border-border">
          <span className="text-[11px] text-muted-foreground">Votre plan actuel :</span>
          <span className="text-[11px] font-bold text-foreground capitalize">{config.label}</span>
        </div>
      </motion.div>
    </div>
  );
}
