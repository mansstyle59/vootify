import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bot, X, Send, Sparkles, Music2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import { supabase } from "@/integrations/supabase/client";

type Msg = { role: "user" | "assistant"; content: string };

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/music-assistant`;

const SUGGESTIONS = [
  "J'aimerais que vous ajoutiez un morceau",
  "Il manque un album sur Vootify",
  "Pouvez-vous ajouter cet artiste ?",
  "Je cherche une chanson introuvable",
];

async function streamChat({
  messages,
  onDelta,
  onDone,
  onError,
}: {
  messages: Msg[];
  onDelta: (text: string) => void;
  onDone: () => void;
  onError: (err: string) => void;
}) {
  try {
    const resp = await fetch(CHAT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
      },
      body: JSON.stringify({ messages }),
    });

    if (!resp.ok) {
      const data = await resp.json().catch(() => ({}));
      onError(data.error || `Erreur ${resp.status}`);
      return;
    }

    if (!resp.body) { onError("Pas de réponse"); return; }

    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let done = false;

    while (!done) {
      const { done: readerDone, value } = await reader.read();
      if (readerDone) break;
      buffer += decoder.decode(value, { stream: true });

      let idx: number;
      while ((idx = buffer.indexOf("\n")) !== -1) {
        let line = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 1);
        if (line.endsWith("\r")) line = line.slice(0, -1);
        if (line.startsWith(":") || line.trim() === "") continue;
        if (!line.startsWith("data: ")) continue;
        const json = line.slice(6).trim();
        if (json === "[DONE]") { done = true; break; }
        try {
          const parsed = JSON.parse(json);
          const content = parsed.choices?.[0]?.delta?.content;
          if (content) onDelta(content);
        } catch {
          buffer = line + "\n" + buffer;
          break;
        }
      }
    }

    if (buffer.trim()) {
      for (let raw of buffer.split("\n")) {
        if (!raw || !raw.startsWith("data: ")) continue;
        const json = raw.slice(6).trim();
        if (json === "[DONE]") continue;
        try {
          const p = JSON.parse(json);
          const c = p.choices?.[0]?.delta?.content;
          if (c) onDelta(c);
        } catch {}
      }
    }
    onDone();
  } catch (e) {
    onError(e instanceof Error ? e.message : "Erreur réseau");
  }
}

/** Extract music_request JSON blocks from assistant text and save to DB */
async function extractAndSaveRequests(text: string) {
  const regex = /```music_request\s*\n([\s\S]*?)\n```/g;
  let match;
  const requests: Array<{ title: string; artist: string; notes?: string }> = [];

  while ((match = regex.exec(text)) !== null) {
    try {
      const parsed = JSON.parse(match[1]);
      if (parsed.title && parsed.artist) {
        requests.push(parsed);
      }
    } catch {}
  }

  if (requests.length === 0) return;

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  for (const req of requests) {
    const { error } = await supabase.from("music_requests").insert({
      user_id: user.id,
      title: req.title,
      artist: req.artist,
      notes: req.notes || null,
    });
    if (error) {
      console.error("Failed to save music request:", error);
      toast.error("Erreur lors de l'envoi de la demande");
    } else {
      toast.success(`Demande envoyée : "${req.title}" de ${req.artist}`);
    }
  }
}

export function MusicAssistantFAB() {
  const [open, setOpen] = useState(false);
  const [visible, setVisible] = useState(true);
  const lastY = useRef(0);

  useEffect(() => {
    if (open) return;
    const onScroll = () => {
      const y = window.scrollY;
      if (y > lastY.current + 8) setVisible(false);
      else if (y < lastY.current - 8) setVisible(true);
      lastY.current = y;
    };
    const scrollEls = document.querySelectorAll(".scrollbar-hide");
    const handlers: Array<() => void> = [];
    scrollEls.forEach((el) => {
      const h = () => {
        const t = (el as HTMLElement).scrollTop;
        if (t > lastY.current + 8) setVisible(false);
        else if (t < lastY.current - 8) setVisible(true);
        lastY.current = t;
      };
      el.addEventListener("scroll", h, { passive: true });
      handlers.push(() => el.removeEventListener("scroll", h));
    });
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      handlers.forEach((h) => h());
    };
  }, [open]);

  return (
    <>
      <AnimatePresence>
        {!open && visible && (
          <motion.button
            initial={{ opacity: 0, y: -10, filter: "blur(4px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: -10, filter: "blur(4px)" }}
            transition={{ duration: 0.35, ease: [0.25, 0.1, 0.25, 1] }}
            onClick={() => setOpen(true)}
            className="fixed z-50 top-0 left-0 right-0 flex items-center justify-center gap-2 active:opacity-80 transition-opacity"
            style={{
              paddingTop: "calc(env(safe-area-inset-top, 0px) + 4px)",
              paddingBottom: "4px",
              height: "calc(env(safe-area-inset-top, 0px) + var(--ai-banner-h, 28px))",
              background: "linear-gradient(90deg, hsl(var(--primary) / 0.15), hsl(var(--primary) / 0.08))",
              backdropFilter: "blur(20px) saturate(1.5)",
              WebkitBackdropFilter: "blur(20px) saturate(1.5)",
              borderBottom: "0.5px solid hsl(var(--primary) / 0.15)",
            }}
          >
            <Sparkles className="w-3.5 h-3.5 text-primary" />
            <span className="text-[11px] font-semibold text-primary tracking-wide">Demander une musique</span>
          </motion.button>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 100, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 100, scale: 0.9 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed inset-0 z-50 flex flex-col"
            style={{ background: "hsl(var(--background))" }}
          >
            <ChatPanel onClose={() => setOpen(false)} />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

function ChatPanel({ onClose }: { onClose: () => void }) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const send = useCallback(async (text: string) => {
    if (!text.trim() || isLoading) return;
    const userMsg: Msg = { role: "user", content: text.trim() };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);

    let assistantSoFar = "";
    const upsert = (chunk: string) => {
      assistantSoFar += chunk;
      setMessages(prev => {
        const last = prev[prev.length - 1];
        if (last?.role === "assistant") {
          return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: assistantSoFar } : m);
        }
        return [...prev, { role: "assistant", content: assistantSoFar }];
      });
    };

    await streamChat({
      messages: [...messages, userMsg],
      onDelta: upsert,
      onDone: async () => {
        setIsLoading(false);
        // Check for music_request blocks and save to DB
        await extractAndSaveRequests(assistantSoFar);
      },
      onError: (err) => {
        setIsLoading(false);
        toast.error(err);
      },
    });
  }, [messages, isLoading]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    send(input);
  };

  /** Render assistant content, hiding the raw JSON blocks */
  const renderAssistantContent = (content: string) => {
    const cleaned = content.replace(/```music_request\s*\n[\s\S]*?\n```/g, "").trim();
    return (
      <div className="prose prose-sm prose-invert max-w-none [&_p]:my-1 [&_ul]:my-1 [&_ol]:my-1 [&_li]:my-0.5 [&_h1]:text-base [&_h2]:text-sm [&_h3]:text-sm [&_a]:text-primary [&_a]:underline [&_strong]:text-foreground [&_code]:text-[12px] [&_code]:bg-foreground/10 [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded">
        <ReactMarkdown>{cleaned}</ReactMarkdown>
      </div>
    );
  };

  return (
    <>
      {/* Header */}
      <div
        className="flex items-center gap-3 px-4 py-3 flex-shrink-0"
        style={{
          paddingTop: "max(0.75rem, env(safe-area-inset-top))",
          borderBottom: "0.5px solid hsl(var(--border) / 0.3)",
          background: "hsl(var(--background) / 0.95)",
          backdropFilter: "blur(20px)",
        }}
      >
        <div
          className="w-10 h-10 rounded-2xl flex items-center justify-center"
          style={{ background: "linear-gradient(135deg, hsl(var(--primary)), hsl(var(--primary) / 0.7))" }}
        >
          <Bot className="w-5 h-5 text-primary-foreground" />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-[15px] font-bold text-foreground">Demander une musique</h2>
          <p className="text-[11px] text-muted-foreground">Dis-moi ce qui manque sur Vootify</p>
        </div>
        {messages.length > 0 && (
          <Button variant="ghost" size="icon" onClick={() => setMessages([])} className="text-muted-foreground">
            <Trash2 className="w-4 h-4" />
          </Button>
        )}
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="w-5 h-5" />
        </Button>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3 scrollbar-hide">
        {true ? (
          <div className="flex flex-col items-center justify-center h-full gap-6 py-12">
            <div
              className="w-20 h-20 rounded-3xl flex items-center justify-center"
              style={{ background: "linear-gradient(135deg, hsl(var(--primary) / 0.15), hsl(var(--primary) / 0.05))" }}
            >
              <Music2 className="w-10 h-10 text-primary" />
            </div>
            <div className="text-center">
              <h3 className="text-lg font-bold text-foreground mb-1">🚧 En construction</h3>
              <p className="text-sm text-muted-foreground max-w-[280px]">
                L'assistant musical arrive bientôt ! Tu pourras demander l'ajout de morceaux manquants directement ici.
              </p>
            </div>
            <div
              className="px-5 py-2.5 rounded-2xl text-[13px] font-semibold"
              style={{
                background: "hsl(var(--primary) / 0.1)",
                color: "hsl(var(--primary))",
              }}
            >
              Prochainement
            </div>
          </div>
        ) : (
          messages.map((msg, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[85%] px-4 py-2.5 rounded-2xl text-[14px] leading-relaxed ${msg.role === "user" ? "whitespace-pre-wrap" : ""}`}
                style={
                  msg.role === "user"
                    ? {
                        background: "hsl(var(--primary))",
                        color: "hsl(var(--primary-foreground))",
                        borderBottomRightRadius: "6px",
                      }
                    : {
                        background: "hsl(var(--foreground) / 0.05)",
                        color: "hsl(var(--foreground))",
                        borderBottomLeftRadius: "6px",
                      }
                }
              >
                {msg.role === "user" ? msg.content : renderAssistantContent(msg.content)}
                {msg.role === "assistant" && i === messages.length - 1 && isLoading && (
                  <span className="inline-block w-1.5 h-4 ml-0.5 rounded-full bg-primary animate-pulse" />
                )}
              </div>
            </motion.div>
          ))
        )}

        {isLoading && messages[messages.length - 1]?.role === "user" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
            <div className="px-4 py-3 rounded-2xl flex gap-1" style={{ background: "hsl(var(--foreground) / 0.05)" }}>
              {[0, 1, 2].map(i => (
                <div key={i} className="w-2 h-2 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
              ))}
            </div>
          </motion.div>
        )}
      </div>

      {/* Input */}
      <form
        onSubmit={handleSubmit}
        className="flex items-center gap-2 px-4 py-3 flex-shrink-0"
        style={{
          paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))",
          borderTop: "0.5px solid hsl(var(--border) / 0.3)",
          background: "hsl(var(--background) / 0.95)",
          backdropFilter: "blur(20px)",
        }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ex: « Bohemian Rhapsody de Queen »"
          disabled={isLoading}
          className="flex-1 h-11 px-4 rounded-2xl text-sm text-foreground placeholder:text-muted-foreground/40 outline-none"
          style={{
            background: "hsl(var(--foreground) / 0.05)",
            border: "0.5px solid hsl(var(--foreground) / 0.06)",
          }}
        />
        <Button type="submit" size="icon" disabled={!input.trim() || isLoading} className="w-11 h-11 rounded-2xl flex-shrink-0">
          <Send className="w-4 h-4" />
        </Button>
      </form>
    </>
  );
}
