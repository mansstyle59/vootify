import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { lovable } from "@/integrations/lovable/index";
import { supabase } from "@/integrations/supabase/client";
import { Music, Mail, Lock, User, Loader2, ArrowLeft } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";

type Mode = "login" | "signup" | "forgot";

const AuthPage = () => {
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const { signIn, signUp, user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) navigate("/", { replace: true });
  }, [user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    if (mode === "forgot") {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) {
        setError(error.message);
      } else {
        setResetSent(true);
        toast.success("Email de réinitialisation envoyé !");
      }
      setLoading(false);
      return;
    }

    const result = mode === "login"
      ? await signIn(email, password)
      : await signUp(email, password, displayName);

    if (result.error) {
      setError(result.error.message);
    } else {
      navigate("/");
    }
    setLoading(false);
  };

  const handleGoogleSignIn = async () => {
    setError("");
    setGoogleLoading(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
      });
      if (result.error) {
        setError(result.error.message || "Erreur de connexion Google");
      }
    } catch (e) {
      setError("Erreur de connexion Google");
    }
    setGoogleLoading(false);
  };

  const switchMode = (m: Mode) => {
    setMode(m);
    setError("");
    setResetSent(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-background to-accent/10" />
      <div className="absolute top-1/4 -left-20 w-60 h-60 bg-primary/20 rounded-full blur-3xl" />
      <div className="absolute bottom-1/4 -right-20 w-60 h-60 bg-accent/20 rounded-full blur-3xl" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl p-8 w-full max-w-md relative z-10 bg-card border border-border"
      >
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-4">
            <Music className="w-8 h-8 text-primary" />
            <h1 className="text-3xl font-display font-bold text-foreground">Vootify</h1>
          </div>
          <p className="text-muted-foreground">
            {mode === "login" && "Connectez-vous pour continuer"}
            {mode === "signup" && "Créez votre compte"}
            {mode === "forgot" && "Réinitialiser le mot de passe"}
          </p>
        </div>

        {/* Google Sign-In (login/signup only) */}
        {mode !== "forgot" && (
          <>
            <button
              onClick={handleGoogleSignIn}
              disabled={googleLoading}
              className="w-full py-3 rounded-xl bg-secondary border border-border text-foreground font-medium text-sm hover:bg-secondary/80 transition-colors disabled:opacity-50 flex items-center justify-center gap-3 mb-4"
            >
              {googleLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
              )}
              Continuer avec Google
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="flex-1 h-px bg-border" />
              <span className="text-xs text-muted-foreground">ou</span>
              <div className="flex-1 h-px bg-border" />
            </div>
          </>
        )}

        {/* Forgot password: back button */}
        {mode === "forgot" && (
          <button
            onClick={() => switchMode("login")}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Retour à la connexion
          </button>
        )}

        {resetSent ? (
          <div className="text-center py-6">
            <Mail className="w-12 h-12 text-primary mx-auto mb-3" />
            <p className="text-foreground font-medium">Email envoyé !</p>
            <p className="text-sm text-muted-foreground mt-1">
              Vérifiez votre boîte mail pour réinitialiser votre mot de passe.
            </p>
            <button
              onClick={() => switchMode("login")}
              className="mt-4 text-sm text-primary font-medium hover:underline"
            >
              Retour à la connexion
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === "signup" && (
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Nom d'affichage"
                  className="w-full pl-10 pr-4 py-3 rounded-xl bg-secondary border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm"
                />
              </div>
            )}

            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email"
                required
                className="w-full pl-10 pr-4 py-3 rounded-xl bg-secondary border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm"
              />
            </div>

            {mode !== "forgot" && (
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Mot de passe"
                  required
                  minLength={6}
                  className="w-full pl-10 pr-4 py-3 rounded-xl bg-secondary border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm"
                />
              </div>
            )}

            {error && (
              <p className="text-destructive text-sm text-center">{error}</p>
            )}

            {/* Forgot password link */}
            {mode === "login" && (
              <div className="text-right">
                <button
                  type="button"
                  onClick={() => switchMode("forgot")}
                  className="text-xs text-muted-foreground hover:text-primary transition-colors"
                >
                  Mot de passe oublié ?
                </button>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-medium text-sm hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {mode === "login" && "Se connecter"}
              {mode === "signup" && "Créer un compte"}
              {mode === "forgot" && "Envoyer le lien"}
            </button>
          </form>
        )}

        {mode !== "forgot" && (
          <div className="mt-6 text-center">
            <button
              onClick={() => switchMode(mode === "login" ? "signup" : "login")}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              {mode === "login" ? "Pas de compte ? " : "Déjà un compte ? "}
              <span className="text-primary font-medium">
                {mode === "login" ? "S'inscrire" : "Se connecter"}
              </span>
            </button>
          </div>
        )}
      </motion.div>
    </div>
  );
};

export default AuthPage;
