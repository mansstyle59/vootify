import { motion } from "framer-motion";

export function PageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.2 }}
        className="flex flex-col items-center gap-4"
      >
        {/* Spinner ring */}
        <div className="relative w-10 h-10">
          <div className="absolute inset-0 rounded-full border-2 border-muted" />
          <motion.div
            className="absolute inset-0 rounded-full border-2 border-transparent border-t-primary"
            animate={{ rotate: 360 }}
            transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
          />
        </div>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.5 }}
          transition={{ delay: 0.5 }}
          className="text-xs text-muted-foreground font-medium"
        >
          Chargement…
        </motion.p>
      </motion.div>
    </div>
  );
}
