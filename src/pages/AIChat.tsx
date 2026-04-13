import { useState, useRef, useEffect } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Bot, Send, User, Sparkles, AlertTriangle, Loader2 } from "lucide-react";

interface ChatMessage {
  id: number;
  role: "user" | "assistant";
  content: string;
  risk_level?: string;
  suggested_actions?: string[];
}

const motivationalGreetings = [
  "You're doing something brave by showing up today. 💛",
  "Every step forward counts, no matter how small. 🌱",
  "Your feelings are valid, and you deserve support. ✨",
];

export default function AIChat() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 0,
      role: "assistant",
      content: `Hi ${user?.name?.split(" ")[0] || "there"}! 👋 I'm your AfyaMind wellness companion. ${motivationalGreetings[Math.floor(Math.random() * motivationalGreetings.length)]}\n\nHow can I support you today?`,
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    const prompt = input.trim();
    if (!prompt || loading) return;

    const userMsg: ChatMessage = { id: Date.now(), role: "user", content: prompt };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const res = await api.askAI({ prompt, language: user?.language || "en" });
      const assistantMsg: ChatMessage = {
        id: Date.now() + 1,
        role: "assistant",
        content: res.reply,
        risk_level: res.risk_level,
        suggested_actions: res.suggested_actions,
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: any) {
      toast({ title: "AI Error", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  const quickPrompts = [
    "I'm feeling anxious today",
    "Help me with a breathing exercise",
    "I need motivation",
    "How can I sleep better?",
  ];

  return (
    <div className="animate-fade-in flex flex-col h-[calc(100vh-7rem)]">
      <header className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center">
          <Sparkles className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl tracking-tight">Wellness Companion</h1>
          <p className="text-sm text-muted-foreground">Your motivational AI assistant</p>
        </div>
      </header>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-4 pb-4 pr-2">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            {msg.role === "assistant" && (
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-1">
                <Bot className="h-4 w-4 text-primary" />
              </div>
            )}
            <div className={`max-w-[75%] flex flex-col gap-2`}>
              <div
                className={`px-4 py-3 rounded-2xl text-sm whitespace-pre-wrap leading-relaxed ${
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground rounded-br-md"
                    : "bg-card border border-border rounded-bl-md"
                }`}
              >
                {msg.content}
              </div>

              {/* Risk warning */}
              {msg.risk_level && msg.risk_level !== "low" && (
                <div className={`flex items-center gap-2 text-xs px-3 py-2 rounded-xl ${
                  msg.risk_level === "high"
                    ? "bg-destructive/10 text-destructive"
                    : "bg-sun/30 text-foreground"
                }`}>
                  <AlertTriangle className="h-3.5 w-3.5" />
                  <span>
                    {msg.risk_level === "high"
                      ? "It sounds like you may need immediate support. Please reach out to a helpline."
                      : "Consider connecting with your care provider."}
                  </span>
                </div>
              )}

              {/* Suggested actions */}
              {msg.suggested_actions && msg.suggested_actions.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {msg.suggested_actions.map((action, i) => (
                    <span key={i} className="text-xs bg-secondary text-secondary-foreground px-2.5 py-1 rounded-full">
                      {action}
                    </span>
                  ))}
                </div>
              )}
            </div>
            {msg.role === "user" && (
              <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center shrink-0 mt-1">
                <User className="h-4 w-4 text-foreground" />
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div className="flex gap-3 items-start">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <Bot className="h-4 w-4 text-primary" />
            </div>
            <div className="bg-card border border-border px-4 py-3 rounded-2xl rounded-bl-md">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          </div>
        )}
      </div>

      {/* Quick prompts (only show when few messages) */}
      {messages.length <= 1 && (
        <div className="flex flex-wrap gap-2 mb-3">
          {quickPrompts.map((qp) => (
            <button
              key={qp}
              onClick={() => { setInput(qp); inputRef.current?.focus(); }}
              className="text-xs px-3 py-2 rounded-2xl border border-border bg-card text-muted-foreground hover:border-primary/30 hover:text-foreground transition-all"
            >
              {qp}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="flex gap-3 pt-2 border-t border-border/50">
        <Input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
          placeholder="Share what's on your mind..."
          className="rounded-2xl h-12 flex-1"
          disabled={loading}
        />
        <Button
          onClick={handleSend}
          disabled={loading || !input.trim()}
          className="rounded-2xl h-12 px-5"
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
