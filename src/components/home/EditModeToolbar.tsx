import { motion, AnimatePresence } from "framer-motion";
import { Pencil, X, RotateCcw, Eye, EyeOff, GripVertical, ChevronUp, ChevronDown } from "lucide-react";
import type { HomeSection } from "@/hooks/useHomeConfig";

interface EditModeToolbarProps {
  editMode: boolean;
  onToggleEdit: () => void;
  sections: HomeSection[];
  onToggleVisibility: (id: string) => void;
  onMoveUp: (index: number) => void;
  onMoveDown: (index: number) => void;
  onReset: () => void;
  hasCustomLayout: boolean;
}

export function EditModeToggle({ editMode, onToggle }: { editMode: boolean; onToggle: () => void }) {
  return (
    <motion.button
      onClick={onToggle}
      whileTap={{ scale: 0.92 }}
      className={`fixed bottom-24 right-4 z-50 flex items-center gap-2 px-4 py-2.5 rounded-full shadow-lg transition-colors duration-200 ${
        editMode
          ? "bg-primary text-primary-foreground"
          : "bg-card/90 backdrop-blur-md text-foreground border border-border/50"
      }`}
      style={{ boxShadow: editMode ? "0 4px 20px hsl(var(--primary) / 0.35)" : "0 4px 16px hsl(0 0% 0% / 0.15)" }}
    >
      {editMode ? <X className="w-4 h-4" /> : <Pencil className="w-4 h-4" />}
      <span className="text-xs font-semibold">{editMode ? "Fermer" : "Éditer"}</span>
    </motion.button>
  );
}

export function EditModePanel({
  sections,
  onToggleVisibility,
  onMoveUp,
  onMoveDown,
  onReset,
  hasCustomLayout,
  onClose,
}: Omit<EditModeToolbarProps, "editMode" | "onToggleEdit"> & { onClose: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 100 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 100 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      className="fixed bottom-24 left-3 right-3 z-50 max-w-md mx-auto"
    >
      <div className="rounded-2xl border border-border/60 bg-card/95 backdrop-blur-xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border/40">
          <div className="flex items-center gap-2">
            <Pencil className="w-4 h-4 text-primary" />
            <span className="text-sm font-bold text-foreground">Éditer l'accueil</span>
          </div>
          <div className="flex items-center gap-2">
            {hasCustomLayout && (
              <button
                onClick={onReset}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors"
              >
                <RotateCcw className="w-3 h-3" />
                Réinitialiser
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-secondary/60 text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Section list */}
        <div className="max-h-[50vh] overflow-y-auto p-2 space-y-1">
          {sections.map((section, index) => (
            <motion.div
              key={section.id}
              layout
              transition={{ type: "spring", stiffness: 400, damping: 30 }}
              className={`flex items-center gap-2 px-3 py-2.5 rounded-xl transition-colors ${
                section.visible
                  ? "bg-secondary/40"
                  : "bg-secondary/20 opacity-60"
              }`}
            >
              <GripVertical className="w-4 h-4 text-muted-foreground/50 flex-shrink-0" />
              
              <span className={`flex-1 text-sm font-medium truncate ${
                section.visible ? "text-foreground" : "text-muted-foreground line-through"
              }`}>
                {section.title}
              </span>

              {/* Move buttons */}
              <div className="flex flex-col gap-0.5 flex-shrink-0">
                <button
                  onClick={() => onMoveUp(index)}
                  disabled={index === 0}
                  className="p-0.5 rounded hover:bg-secondary/80 text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronUp className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => onMoveDown(index)}
                  disabled={index === sections.length - 1}
                  className="p-0.5 rounded hover:bg-secondary/80 text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronDown className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Visibility toggle */}
              <button
                onClick={() => onToggleVisibility(section.id)}
                className={`p-1.5 rounded-lg transition-colors ${
                  section.visible
                    ? "text-primary hover:bg-primary/10"
                    : "text-muted-foreground hover:bg-secondary/80"
                }`}
              >
                {section.visible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
              </button>
            </motion.div>
          ))}
        </div>

        {/* Footer hint */}
        <div className="px-4 py-2 border-t border-border/40">
          <p className="text-[11px] text-muted-foreground text-center">
            Réorganisez et masquez les sections à votre goût
          </p>
        </div>
      </div>
    </motion.div>
  );
}
