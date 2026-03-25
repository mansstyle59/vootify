import { useState, useCallback } from "react";
import { motion, AnimatePresence, Reorder } from "framer-motion";
import { X, GripVertical, Eye, EyeOff, RotateCcw } from "lucide-react";

export interface HomeSection {
  id: string;
  label: string;
  emoji: string;
  visible: boolean;
}

export const DEFAULT_SECTIONS: HomeSection[] = [
  { id: "pourVous", label: "Pour vous", emoji: "💫", visible: true },
  { id: "coupsDeCœur", label: "Coups de cœur", emoji: "❤️", visible: true },
  { id: "titresDuMoment", label: "Titres du moment", emoji: "🔥", visible: true },
  { id: "popHits", label: "Pop Hits", emoji: "🎤", visible: true },
  { id: "rapstars", label: "Rapstars", emoji: "⭐", visible: true },
  { id: "chillVibes", label: "Chill & Détente", emoji: "🌙", visible: true },
  { id: "afrobeats", label: "Afrobeats", emoji: "🌍", visible: true },
  { id: "top10", label: "Top 10", emoji: "🏆", visible: true },
];

const STORAGE_KEY = "home-sections-config";

export function loadSections(): HomeSection[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SECTIONS;
    const saved: HomeSection[] = JSON.parse(raw);
    // Merge with defaults (in case new sections are added)
    const savedIds = new Set(saved.map((s) => s.id));
    const merged = [
      ...saved,
      ...DEFAULT_SECTIONS.filter((d) => !savedIds.has(d.id)),
    ];
    return merged;
  } catch {
    return DEFAULT_SECTIONS;
  }
}

export function saveSections(sections: HomeSection[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sections));
}

interface Props {
  open: boolean;
  onClose: () => void;
  onSave: (sections: HomeSection[]) => void;
  current: HomeSection[];
}

export function HomeCustomizer({ open, onClose, onSave, current }: Props) {
  const [sections, setSections] = useState<HomeSection[]>(current);

  const toggleVisibility = useCallback((id: string) => {
    setSections((prev) =>
      prev.map((s) => (s.id === id ? { ...s, visible: !s.visible } : s))
    );
  }, []);

  const handleSave = () => {
    saveSections(sections);
    onSave(sections);
    onClose();
  };

  const handleReset = () => {
    setSections(DEFAULT_SECTIONS);
  };


  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[200] flex flex-col"
          style={{ background: "hsl(var(--background))" }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border/50">
            <button
              onClick={onClose}
              className="text-sm font-medium text-primary"
            >
              Annuler
            </button>
            <h2 className="text-base font-bold text-foreground">Personnaliser</h2>
            <button
              onClick={handleSave}
              className="text-sm font-bold text-primary"
            >
              Terminer
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto px-4 py-4 scrollbar-hide">
            <p className="text-sm text-muted-foreground mb-5">
              Réorganise ta page d'accueil
            </p>

            {/* Preview mode label */}
            <div className="flex flex-col items-center gap-2 mb-4">
              <div className="flex gap-1">
                <div className="w-8 h-6 rounded bg-muted/60" />
                <div className="w-8 h-6 rounded bg-muted/60" />
                <div className="w-8 h-6 rounded bg-muted/60" />
              </div>
              <p className="text-xs text-muted-foreground">
                Sections avec aperçu en cartes
              </p>
            </div>

            {/* Reorderable list */}
            <Reorder.Group
              axis="y"
              values={sections}
              onReorder={setSections}
              className="rounded-xl bg-secondary/30 border border-border/50 overflow-hidden divide-y divide-border/30"
            >
              {sections.map((section) => (
                <Reorder.Item
                  key={section.id}
                  value={section}
                  className="flex items-center gap-3 px-4 py-3.5 bg-background cursor-grab active:cursor-grabbing"
                  whileDrag={{
                    scale: 1.02,
                    boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
                    zIndex: 50,
                  }}
                >
                  <span className="text-base">{section.emoji}</span>
                  <span
                    className={`flex-1 text-sm font-medium ${
                      section.visible ? "text-foreground" : "text-muted-foreground line-through"
                    }`}
                  >
                    {section.label}
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleVisibility(section.id);
                    }}
                    className="p-1.5 rounded-lg transition-colors"
                  >
                    {section.visible ? (
                      <Eye className="w-4 h-4 text-primary" />
                    ) : (
                      <EyeOff className="w-4 h-4 text-muted-foreground" />
                    )}
                  </button>
                  <GripVertical className="w-4 h-4 text-muted-foreground/50 flex-shrink-0" />
                </Reorder.Item>
              ))}
            </Reorder.Group>

            {/* Reset button */}
            <button
              onClick={handleReset}
              className="w-full mt-6 flex items-center justify-center gap-2 text-sm text-primary font-medium py-3"
            >
              <RotateCcw className="w-4 h-4" />
              Réinitialiser les réglages
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
