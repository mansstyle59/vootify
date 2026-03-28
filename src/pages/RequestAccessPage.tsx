import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { motion, AnimatePresence } from "framer-motion";
import {
  Crown, Send, CheckCircle, Loader2, Mail, LogIn, User, Star, Gem, Sparkles, Clock,
} from "lucide-react";

const durationOptions = [
  { label: "7 jours", value: 7, unit: "days" as const },
  { label: "1 mois", value: 1, unit: "months" as const },
  { label: "6 mois", value: 6, unit: "months" as const },
  { label: "1 an", value: 12, unit: "months" as const },
  { label: "Illimité", value: 0, unit: "months" as const },
];

const planOptions = [
  { key: "premium", label: "Premium", icon: Crown, desc: "Accès standard", gradient: "from-emerald-500 to-green-600", glow: "shadow-emerald-500/30" },
  { key: "gold", label: "Gold", icon: Star, desc: "Accès étendu", gradient: "from-amber-400 to-yellow-500", glow: "shadow-amber-400/30" },
  { key: "vip", label: "VIP", icon: Gem, desc: "Accès illimité", gradient: "from-rose-500 to-red-600", glow: "shadow-rose-500/30" },
];

const RequestAccessPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialPlan = searchParams.get("plan") || "premium";

  const [requested, setRequested] = useState(false);
  const [sending, setSending] = useState(false);
  const [contactEmail, setContactEmail] = useState(user?.email || "");
  const [pseudo, setPseudo] = useState("");
  const [selectedPlan, setSelectedPlan] = useState(initialPlan);
  const [selectedDuration, setSelectedDuration] = useState<{ value: number; unit: "days" | "months" }>({ value: 30, unit: "days" });
  const [shakeFields, setShakeFields] = useState(false);

  const selectedPlanInfo = planOptions.find((p) => p.key === selectedPlan) || planOptions[0];
  const isFormValid = contactEmail.trim().length > 0 && pseudo.trim().length > 0;

  const handleRequest = async () => {
    if (!isFormValid) {
      setShakeFields(true);
      setTimeout(() => setShakeFields(false), 600);
      return;
    }
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
          requested_plan: selectedPlan,
        });
      } else {
        await supabase.from("access_requests").insert({
          user_id: userId,
          user_email: contactEmail.trim(),
          display_name: displayName,
          requested_duration: selectedDuration.value,
          requested_duration_unit: selectedDuration.unit,
          requested_plan: selectedPlan,
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
    <div className="min-h-screen flex items-center justify-center p-4 bg-background relative overflow-hidden">
      {/* Ambient glow */}
      <div
        className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full opacity-15 blur-[120px] pointer-events-none"
        style={{ background: "linear-gradient(135deg, hsl(var(--primary)), hsl(var(--primary) / 0.2))" }}
      />

      <motion.div
        initial={{ opacity: 0, y: 30, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className="text-center max-w-md w-full relative z-10"
      >
        {/* Header */}
        <div className="mb-5">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 400, damping: 20, delay: 0.15 }}
            className="relative inline-flex mb-3"
          >
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center border border-primary/20 shadow-lg shadow-primary/10">
              <Sparkles className="w-7 h-7 text-primary" />
            </div>
          </motion.div>
          <h1 className="text-2xl font-display font-bold text-foreground mb-1">
            Demande d'abonnement
          </h1>
          <p className="text-muted-foreground text-sm leading-relaxed max-w-xs mx-auto">
            Choisissez votre plan et envoyez votre demande d'accès.
          </p>
        </div>

        {/* Form card */}
        <div
          className="rounded-2xl p-5 space-y-4"
          style={{
            background: "hsl(var(--card) / 0.6)",
            backdropFilter: "blur(40px)",
            WebkitBackdropFilter: "blur(40px)",
            border: "1px solid hsl(var(--border) / 0.5)",
          }}
        >
          <AnimatePresence mode="wait">
            {!requested ? (
              <motion.div key="form" exit={{ opacity: 0, scale: 0.95 }} className="space-y-4">
                {/* Plan selector */}
                <div className="text-left">
                  <label className="text-xs text-muted-foreground font-semibold uppercase tracking-wider mb-2 block">
                    Plan souhaité
                  </label>
                  <div className="grid grid-cols-3 gap-2.5">
                    {planOptions.map((opt) => {
                      const isSelected = selectedPlan === opt.key;
                      const Icon = opt.icon;
                      return (
                        <motion.button
                          whileTap={{ scale: 0.95 }}
                          key={opt.key}
                          type="button"
                          onClick={() => setSelectedPlan(opt.key)}
                          className={`relative py-3 rounded-xl text-sm font-semibold transition-all flex flex-col items-center justify-center gap-1 ${
                            isSelected
                              ? `bg-gradient-to-br ${opt.gradient} text-white shadow-lg ${opt.glow} border-0`
                              : "bg-muted/40 text-foreground border border-border/60 hover:bg-muted/70"
                          }`}
                        >
                          <Icon className="w-4 h-4" />
                          <span>{opt.label}</span>
                          {isSelected && (
                            <motion.div
                              layoutId="plan-dot"
                              className="absolute -bottom-1 w-6 h-1 rounded-full bg-white/80"
                              transition={{ type: "spring", stiffness: 500, damping: 30 }}
                            />
                          )}
                        </motion.button>
                      );
                    })}
                  </div>
                </div>

                {/* Pseudo */}
                <motion.div
                  className="text-left"
                  animate={shakeFields && !pseudo.trim() ? { x: [0, -8, 8, -6, 6, 0] } : {}}
                  transition={{ duration: 0.5 }}
                >
                  <label className="text-xs text-muted-foreground font-semibold uppercase tracking-wider mb-1.5 block">
                    Pseudo
                  </label>
                  <div className="relative">
                    <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/60" />
                    <input
                      type="text"
                      value={pseudo}
                      onChange={(e) => setPseudo(e.target.value)}
                      placeholder="Votre pseudo"
                      className="w-full bg-background/50 border border-border/60 rounded-xl px-3 py-3 pl-10 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition-all"
                    />
                  </div>
                </motion.div>

                {/* Email */}
                <motion.div
                  className="text-left"
                  animate={shakeFields && !contactEmail.trim() ? { x: [0, -8, 8, -6, 6, 0] } : {}}
                  transition={{ duration: 0.5 }}
                >
                  <label className="text-xs text-muted-foreground font-semibold uppercase tracking-wider mb-1.5 block">
                    Adresse email
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/60" />
                    <input
                      type="email"
                      value={contactEmail}
                      onChange={(e) => setContactEmail(e.target.value)}
                      placeholder="votre@email.com"
                      className="w-full bg-background/50 border border-border/60 rounded-xl px-3 py-3 pl-10 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition-all"
                    />
                  </div>
                </motion.div>

                {/* Duration */}
                <div className="text-left">
                  <label className="text-xs text-muted-foreground font-semibold uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <Clock className="w-3 h-3" /> Durée souhaitée
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {durationOptions.map((opt) => {
                      const isSelected = selectedDuration.value === opt.value && selectedDuration.unit === opt.unit;
                      return (
                        <motion.button
                          whileTap={{ scale: 0.93 }}
                          key={opt.label}
                          type="button"
                          onClick={() => setSelectedDuration({ value: opt.value, unit: opt.unit })}
                          className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-all border ${
                            isSelected
                              ? "bg-primary text-primary-foreground border-primary shadow-md shadow-primary/20"
                              : "bg-background/50 text-foreground border-border/60 hover:bg-muted/70"
                          }`}
                        >
                          {opt.label}
                        </motion.button>
                      );
                    })}
                  </div>
                </div>

                {/* Submit */}
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  whileHover={isFormValid ? { scale: 1.01 } : {}}
                  type="button"
                  onClick={handleRequest}
                  disabled={sending}
                  className={`w-full py-3.5 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2.5 mt-1 ${
                    isFormValid
                      ? `bg-gradient-to-r ${selectedPlanInfo.gradient} text-white shadow-lg ${selectedPlanInfo.glow}`
                      : "bg-muted text-muted-foreground"
                  } disabled:opacity-60`}
                >
                  {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  {sending ? "Envoi…" : `Demander ${selectedPlanInfo.label}`}
                </motion.button>
              </motion.div>
            ) : (
              <motion.div
                key="success"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ type: "spring", stiffness: 400, damping: 25 }}
                className="w-full py-8 flex flex-col items-center justify-center gap-3"
              >
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 500, damping: 20, delay: 0.2 }}
                  className="w-14 h-14 rounded-full bg-primary/15 flex items-center justify-center mb-1"
                >
                  <CheckCircle className="w-7 h-7 text-primary" />
                </motion.div>
                <span className="text-lg font-bold text-foreground">Demande envoyée !</span>
                <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-gradient-to-r ${selectedPlanInfo.gradient} text-white`}>
                  {(() => { const I = selectedPlanInfo.icon; return <I className="w-3 h-3" />; })()}
                  {selectedPlanInfo.label}
                </div>
                <span className="text-xs text-muted-foreground font-normal max-w-[250px] leading-relaxed">
                  Vous recevrez vos identifiants par email une fois votre accès approuvé.
                </span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Login */}
        <motion.button
          whileTap={{ scale: 0.97 }}
          type="button"
          onClick={() => navigate("/auth")}
          className="w-full mt-3 py-3 rounded-xl bg-muted/40 text-muted-foreground font-medium text-sm hover:bg-muted/60 transition-all flex items-center justify-center gap-2 border border-border/30"
        >
          <LogIn className="w-4 h-4" />
          Déjà un compte ? Se connecter
        </motion.button>
      </motion.div>
    </div>
  );
};

export default RequestAccessPage;
