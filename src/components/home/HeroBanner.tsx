import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";
import { Play, Headphones, Music2 } from "lucide-react";

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Bonjour";
  if (h < 18) return "Bon après-midi";
  return "Bonsoir";
}

function getSubGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Commencez la journée en musique";
  if (h < 18) return "La bande-son de votre après-midi";
  return "Détendez-vous avec vos morceaux préférés";
}

export function HeroBanner() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end start"],
  });

  const y = useTransform(scrollYProgress, [0, 1], [0, 80]);
  const opacity = useTransform(scrollYProgress, [0, 0.8], [1, 0]);
  const scale = useTransform(scrollYProgress, [0, 1], [1, 1.1]);

  return (
    <div ref={ref} className="relative overflow-hidden mb-6" style={{ minHeight: "220px" }}>
      {/* Parallax background */}
      <motion.div
        style={{ y, scale }}
        className="absolute inset-0 -z-10"
      >
        {/* Gradient mesh background */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/30 via-accent/20 to-background" />
        <div className="absolute top-0 right-0 w-72 h-72 bg-primary/15 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/4" />
        <div className="absolute bottom-0 left-0 w-56 h-56 bg-accent/15 rounded-full blur-[80px] translate-y-1/3 -translate-x-1/4" />
        
        {/* Floating music icons */}
        <motion.div
          animate={{ y: [0, -12, 0], rotate: [0, 8, 0] }}
          transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-10 right-8 text-primary/20"
        >
          <Music2 className="w-12 h-12" />
        </motion.div>
        <motion.div
          animate={{ y: [0, 10, 0], rotate: [0, -6, 0] }}
          transition={{ duration: 6, repeat: Infinity, ease: "easeInOut", delay: 1 }}
          className="absolute bottom-8 right-24 text-accent/15"
        >
          <Headphones className="w-10 h-10" />
        </motion.div>
        <motion.div
          animate={{ y: [0, -8, 0], x: [0, 6, 0] }}
          transition={{ duration: 7, repeat: Infinity, ease: "easeInOut", delay: 2 }}
          className="absolute top-16 left-[60%] text-primary/10"
        >
          <Play className="w-8 h-8" />
        </motion.div>
      </motion.div>

      {/* Content */}
      <motion.div
        style={{ opacity }}
        className="relative px-4 md:px-8 pt-10 pb-6 flex flex-col justify-end"
      >
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="text-sm font-medium text-primary mb-1 tracking-wide uppercase"
        >
          Vootify Music
        </motion.p>
        <motion.h1
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="text-3xl md:text-4xl font-display font-bold text-foreground mb-2"
        >
          {getGreeting()} 👋
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="text-sm md:text-base text-muted-foreground max-w-md"
        >
          {getSubGreeting()}
        </motion.p>

        {/* Decorative line */}
        <motion.div
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ delay: 0.5, duration: 0.6, ease: "easeOut" }}
          className="mt-4 h-0.5 w-16 rounded-full bg-gradient-to-r from-primary to-accent origin-left"
        />
      </motion.div>
    </div>
  );
}
