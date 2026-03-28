import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Crown, Lock, ArrowLeft, Check, X, Home, Search, Library, Radio, Heart, ListMusic, Star, Gem, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useSubscriptionAccess } from "@/hooks/useSubscriptionAccess";
import { supabase } from "@/integrations/supabase/client";
import type { PlanType } from "@/lib/subscriptionPermissions";

interface UpgradePromptProps {
  feature?: string;
  inline?: boolean;
}

/* ── Plan comparison data ── */
interface PlanFeature {
  label: string;
  premium: boolean | string;
  gold: boolean | string;
  vip: boolean | string;
}

const features: PlanFeature[] = [
  { label: "Accueil", premium: true, gold: true, vip: true },
  { label: "Bibliothèque", premium: "Artistes & Albums", gold: true, vip: true },
  { label: "Playlists & Favoris", premium: false, gold: true, vip: true },
  { label: "Recherche", premium: false, gold: true, vip: true },
  { label: "Radio", premium: false, gold: false, vip: true },
  { label: "Accès complet", premium: false, gold: false, vip: true },
];

const plans: {
  key: PlanType;
  label: string;
  icon: typeof Crown;
  gradient: string;
  border: string;
  badge: string;
  desc: string;
}[] = [
  {
    key: "premium",
    label: "Premium",
    icon: Crown,
    gradient: "from-primary/20 to-primary/5",
    border: "border-primary/30",
    badge: "bg-primary/15 text-primary",
    desc: "Accès basique",
  },
  {
    key: "gold",
    label: "Gold",
    icon: Star,
    gradient: "from-yellow-500/20 to-yellow-500/5",
    border: "border-yellow-500/30",
    badge: "bg-yellow-500/15 text-yellow-500",
    desc: "Presque tout",
  },
  {
    key: "vip",
    label: "VIP",
    icon: Gem,
    gradient: "from-red-500/20 to-red-500/5",
    border: "border-red-500/30",
    badge: "bg-red-500/15 text-red-500",
    desc: "Accès total",
  },
];

function FeatureCheck({ value }: { value: boolean | string }) {
  if (value === true) return <Check className="w-4 h-4 text-emerald-400" />;
  if (value === false) return <X className="w-4 h-4 text-muted-foreground/30" />;
  return <span className="text-[10px] text-muted-foreground font-medium leading-tight text-center">{value}</span>;
}

/* ── Plan Card ── */
function PlanCard({
  plan,
  index,
  isCurrent,
  onUpgrade,
  priceData,
}: {
  plan: (typeof plans)[0];
  index: number;
  isCurrent: boolean;
  onUpgrade: () => void;
  priceData?: { price: string; period: string };
}) {
  const Icon = plan.icon;
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 + index * 0.08 }}
      className={`relative rounded-2xl border ${plan.border} bg-gradient-to-b ${plan.gradient} p-4 flex flex-col items-center text-center ${
        isCurrent ? "ring-2 ring-primary/50" : ""
      }`}
    >
      {isCurrent && (
        <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 px-2.5 py-0.5 rounded-full bg-primary text-primary-foreground text-[9px] font-bold uppercase tracking-wider">
          Actuel
        </div>
      )}
      <div className={`w-10 h-10 rounded-xl ${plan.badge} flex items-center justify-center mb-2`}>
        <Icon className="w-5 h-5" />
      </div>
      <h3 className="text-sm font-bold text-foreground">{plan.label}</h3>
      {priceData ? (
        <div className="mt-0.5 mb-1">
          <span className="text-lg font-extrabold text-foreground">{priceData.price}</span>
          <span className="text-[10px] text-muted-foreground">{priceData.period}</span>
        </div>
      ) : (
        <p className="text-[10px] text-muted-foreground mt-0.5 mb-1">{plan.desc}</p>
      )}
      <p className="text-[9px] text-muted-foreground/70 mb-2">{plan.desc}</p>

      {/* Feature list */}
      <div className="w-full space-y-2 mb-3">
        {features.map((f) => (
          <div key={f.label} className="flex items-center justify-between gap-2">
            <span className="text-[11px] text-muted-foreground truncate">{f.label}</span>
            <div className="flex-shrink-0">
              <FeatureCheck value={f[plan.key]} />
            </div>
          </div>
        ))}
      </div>

      {!isCurrent && (
        <button
          onClick={onUpgrade}
          className={`w-full py-2 rounded-xl text-xs font-semibold transition-all ${
            plan.key === "vip"
              ? "bg-red-500 text-white hover:bg-red-500/90"
              : plan.key === "gold"
              ? "bg-yellow-500 text-black hover:bg-yellow-500/90"
              : "bg-primary text-primary-foreground hover:bg-primary/90"
          }`}
        >
          Choisir {plan.label}
        </button>
      )}
    </motion.div>
  );
}

export function UpgradePrompt({ feature = "Cette fonctionnalité", inline = false }: UpgradePromptProps) {
  const navigate = useNavigate();
  const { plan, config } = useSubscriptionAccess();
  const [prices, setPrices] = useState<Record<string, { price: string; period: string }>>({});

  useEffect(() => {
    supabase.from("plan_prices").select("*").then(({ data }) => {
      if (data) {
        const map: Record<string, { price: string; period: string }> = {};
        for (const row of data) map[row.plan] = { price: row.price, period: row.period };
        setPrices(map);
      }
    });
  }, []);

  const nextPlan = plan === "premium" ? "Gold" : plan === "gold" ? "VIP" : "un abonnement supérieur";

  if (inline) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col items-center justify-center py-12 px-4 text-center"
      >
        <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
          <Lock className="w-7 h-7 text-primary" />
        </div>
        <h3 className="text-base font-bold text-foreground mb-1">Accès restreint</h3>
        <p className="text-xs text-muted-foreground max-w-[260px] leading-relaxed mb-5">
          {feature} est réservé aux abonnés <span className="font-semibold text-primary">{nextPlan}</span>.
        </p>

        {/* Compact plan cards */}
        <div className="grid grid-cols-3 gap-2 w-full max-w-md mb-4">
          {plans.map((p, i) => (
            <PlanCard
              key={p.key}
              plan={p}
              index={i}
              isCurrent={plan === p.key}
              onUpgrade={() => navigate("/request-access")}
            />
          ))}
        </div>

        <button
          onClick={() => navigate("/request-access")}
          className="px-5 py-2.5 rounded-full bg-primary text-primary-foreground text-sm font-semibold hover:brightness-110 transition-all flex items-center gap-2"
        >
          <Crown className="w-4 h-4" />
          Demander un upgrade
        </button>
      </motion.div>
    );
  }

  return (
    <div className="min-h-screen bg-background overflow-y-auto pb-32">
      {/* Ambient glow */}
      <div className="fixed inset-0 -z-10 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[350px] bg-primary/8 rounded-full blur-[140px]" />
        <div className="absolute bottom-1/4 right-0 w-[250px] h-[250px] bg-red-500/5 rounded-full blur-[100px]" />
        <div className="absolute top-1/3 left-0 w-[200px] h-[200px] bg-yellow-500/5 rounded-full blur-[100px]" />
      </div>

      {/* Header */}
      <div className="px-4 md:px-8" style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 1rem)" }}>
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Retour
        </button>
      </div>

      <div className="px-4 md:px-8 max-w-lg mx-auto">
        {/* Hero */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <div className="relative inline-flex mb-4">
            <motion.div
              animate={{ rotate: [0, 5, -5, 0] }}
              transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
              className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/20 via-yellow-500/15 to-red-500/20 flex items-center justify-center border border-white/10"
            >
              <Sparkles className="w-8 h-8 text-primary" />
            </motion.div>
          </div>
          <h1 className="text-2xl font-display font-bold text-foreground mb-1.5">
            Choisissez votre plan
          </h1>
          <p className="text-sm text-muted-foreground leading-relaxed max-w-[300px] mx-auto">
            {feature !== "Cette fonctionnalité" ? (
              <>
                <span className="text-foreground font-medium">{feature}</span> nécessite un abonnement supérieur.
              </>
            ) : (
              "Débloquez toutes les fonctionnalités de Vootify."
            )}
          </p>

          {/* Current plan indicator */}
          <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-muted/60 border border-border/50">
            <span className="text-[11px] text-muted-foreground">Plan actuel :</span>
            <span className="text-[11px] font-bold text-foreground capitalize">{config.label}</span>
          </div>
        </motion.div>

        {/* Plan cards */}
        <div className="grid grid-cols-3 gap-2.5 mb-6">
          {plans.map((p, i) => (
            <PlanCard
              key={p.key}
              plan={p}
              index={i}
              isCurrent={plan === p.key}
              onUpgrade={() => navigate("/request-access")}
            />
          ))}
        </div>

        {/* Feature comparison table */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="rounded-2xl border border-white/[0.06] bg-white/[0.03] backdrop-blur-2xl overflow-hidden mb-6"
        >
          <div className="px-4 py-3 border-b border-white/[0.06]">
            <h3 className="text-sm font-semibold text-foreground">Comparatif détaillé</h3>
          </div>

          {/* Column headers */}
          <div className="grid grid-cols-[1fr_60px_60px_60px] px-4 py-2.5 border-b border-white/[0.04] bg-white/[0.02]">
            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Fonctionnalité</span>
            {plans.map((p) => (
              <span key={p.key} className={`text-[10px] font-bold text-center uppercase tracking-wider ${
                plan === p.key ? "text-primary" : "text-muted-foreground"
              }`}>
                {p.label}
              </span>
            ))}
          </div>

          {/* Rows */}
          {features.map((f, i) => (
            <motion.div
              key={f.label}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.45 + i * 0.04 }}
              className={`grid grid-cols-[1fr_60px_60px_60px] items-center px-4 py-3 ${
                i < features.length - 1 ? "border-b border-white/[0.04]" : ""
              }`}
            >
              <span className="text-xs text-foreground font-medium">{f.label}</span>
              {(["premium", "gold", "vip"] as PlanType[]).map((pk) => (
                <div key={pk} className="flex justify-center">
                  <FeatureCheck value={f[pk]} />
                </div>
              ))}
            </motion.div>
          ))}
        </motion.div>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="space-y-3"
        >
          <button
            onClick={() => navigate("/request-access")}
            className="w-full py-3.5 rounded-xl bg-primary text-primary-foreground font-medium text-sm hover:brightness-110 transition-all flex items-center justify-center gap-2 shadow-lg shadow-primary/20"
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
        </motion.div>
      </div>
    </div>
  );
}
