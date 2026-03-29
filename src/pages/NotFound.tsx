import { useNavigate } from "react-router-dom";
import { Music, ArrowLeft } from "lucide-react";
import { motion } from "framer-motion";

const NotFound = () => {
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen items-center justify-center p-6 bg-background">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center max-w-sm"
      >
        <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-6">
          <Music className="w-10 h-10 text-primary" />
        </div>
        <h1 className="text-5xl font-display font-bold text-foreground mb-2">404</h1>
        <p className="text-base text-muted-foreground mb-8">
          Cette page n'existe pas ou a été déplacée.
        </p>
        <button
          onClick={() => navigate("/")}
          className="inline-flex items-center gap-2 px-6 py-3 rounded-full font-semibold text-sm active:scale-[0.97] transition-all"
          style={{ background: "hsl(var(--primary) / 0.12)", color: "hsl(var(--primary))" }}
        >
          <ArrowLeft className="w-4 h-4" />
          Retour à l'accueil
        </button>
      </motion.div>
    </div>
  );
};

export default NotFound;
