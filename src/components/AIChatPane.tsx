import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { X, Send, Bot, User, Loader2, Sparkles, Play, AlertTriangle, FlaskConical, LayoutTemplate, HelpCircle } from "lucide-react";
import ReactMarkdown from "react-markdown";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface AIChatPaneProps {
  onClose: () => void;
  sheetContext?: string;
  onExecute?: (command: any) => void;
  selectedCellLabel?: string;
}

function extractCommands(content: string): any[] {
  const commands: any[] = [];
  const regex = /```json\s*\n([\s\S]*?)\n```/g;
  let match;
  while ((match = regex.exec(content)) !== null) {
    try {
      const parsed = JSON.parse(match[1]);
      if (parsed.action) commands.push(parsed);
    } catch { /* not valid JSON */ }
  }
  return commands;
}

const QUICK_ACTIONS = [
  { label: "Explain this cell", icon: HelpCircle, prompt: (cell?: string) => cell ? `Explain cell ${cell} — what formula or value is in it and how it was calculated?` : "Explain the currently selected cell." },
  { label: "Find errors", icon: AlertTriangle, prompt: () => "Scan my spreadsheet for any errors (#REF!, #VALUE!, #DIV/0!, #NAME?, circular references) and explain how to fix them." },
  { label: "Test a scenario", icon: FlaskConical, prompt: () => "I want to test a what-if scenario. Help me change some assumptions and see how it affects the rest of the model." },
  { label: "Build a model", icon: LayoutTemplate, prompt: () => "Help me build a spreadsheet model. What kind of model would you like to create?" },
];

const WELCOME_MESSAGE = `👋 I'm **GridMind**, your spreadsheet expert. Here's how I can help:

• **Explain any cell** — ask about formulas, values, or calculation flows with cell-level citations
• **Test scenarios** — change assumptions and see every affected cell explained
• **Debug errors** — trace #REF!, #VALUE!, circular references to their source
• **Build models** — create financial models or fill templates from scratch

Use the quick actions below or just ask me anything about your spreadsheet!`;

export function AIChatPane({ onClose, sheetContext, onExecute, selectedCellLabel }: AIChatPaneProps) {
  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", content: WELCOME_MESSAGE }
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = async (overrideText?: string) => {
    const text = (overrideText ?? input).trim();
    if (!text || isLoading) return;
    if (!overrideText) setInput("");

    const userMsg: Message = { role: "user", content: text };
    setMessages((prev) => [...prev, userMsg]);
    setIsLoading(true);

    try {
      const chatMessages = [
        ...messages.filter((m) => m.role !== "assistant" || messages.indexOf(m) > 0),
        userMsg,
      ];

      const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/spreadsheet-ai`;
      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ messages: chatMessages, context: sheetContext || "" }),
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        if (resp.status === 429) throw new Error("Rate limit exceeded. Please wait a moment.");
        if (resp.status === 402) throw new Error("Usage credits required. Please add credits.");
        throw new Error(err.error || "Failed to get response");
      }

      if (!resp.body) throw new Error("No response body");

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let assistantContent = "";

      setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = buffer.indexOf("\n")) !== -1) {
          let line = buffer.slice(0, newlineIndex);
          buffer = buffer.slice(newlineIndex + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (!line.startsWith("data: ")) continue;
          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") break;
          try {
            const parsed = JSON.parse(jsonStr);
            const delta = parsed.choices?.[0]?.delta?.content;
            if (delta) {
              assistantContent += delta;
              setMessages((prev) => {
                const updated = [...prev];
                updated[updated.length - 1] = { role: "assistant", content: assistantContent };
                return updated;
              });
            }
          } catch { /* partial JSON */ }
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Something went wrong";
      setMessages((prev) => [...prev, { role: "assistant", content: `⚠️ ${msg}` }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleApply = (command: any) => {
    if (onExecute) {
      onExecute(command);
      setMessages((prev) => [...prev, { role: "assistant", content: `✅ Applied **${command.action}** — ${command.explanation || "Changes applied to your spreadsheet."}` }]);
    }
  };

  const showQuickActions = messages.length <= 1 && !isLoading;

  return (
    <div className="flex flex-col h-full bg-card" style={{ width: 400 }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/50 bg-gradient-to-r from-primary/5 to-[hsl(var(--gradient-end)/0.05)] flex-shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="bg-gradient-to-br from-primary to-[hsl(var(--gradient-end))] p-1.5 rounded-lg shadow-sm">
            <Sparkles className="h-3.5 w-3.5 text-primary-foreground" />
          </div>
          <span className="text-sm font-semibold text-foreground">GridMind AI</span>
        </div>
        <Button variant="ghost" size="icon-sm" onClick={onClose} className="hover:bg-accent">
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg, i) => {
          const commands = msg.role === "assistant" ? extractCommands(msg.content) : [];
          return (
            <div key={i} className={`flex gap-2.5 animate-fade-in ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}>
              <div className={`flex-shrink-0 h-7 w-7 rounded-lg flex items-center justify-center shadow-sm ${
                msg.role === "assistant"
                  ? "bg-gradient-to-br from-primary to-[hsl(var(--gradient-end))] text-primary-foreground"
                  : "bg-accent text-foreground"
              }`}>
                {msg.role === "assistant" ? <Bot className="h-3.5 w-3.5" /> : <User className="h-3 w-3" />}
              </div>
              <div className="max-w-[85%] space-y-2">
                <div className={`rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed shadow-sm ${
                  msg.role === "user"
                    ? "bg-gradient-to-br from-primary to-[hsl(var(--gradient-end))] text-primary-foreground"
                    : "bg-accent/60 text-foreground border border-border/30"
                }`}>
                  {msg.role === "assistant" ? (
                    <div className="prose prose-xs max-w-none prose-code:bg-background prose-code:text-primary prose-code:px-1 prose-code:rounded">
                      <ReactMarkdown>{msg.content || "▊"}</ReactMarkdown>
                    </div>
                  ) : (
                    <span>{msg.content}</span>
                  )}
                </div>
                {/* Apply Changes buttons */}
                {commands.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {commands.map((cmd, ci) => (
                      <Button
                        key={ci}
                        size="sm"
                        className="h-7 text-[10px] gap-1.5 bg-gradient-to-r from-primary to-[hsl(var(--gradient-end))] hover:opacity-90 shadow-sm"
                        onClick={() => handleApply(cmd)}
                      >
                        <Play className="h-3 w-3" />
                        Apply {cmd.action === "SET_CELLS" ? `${cmd.data?.length || 0} cell changes` : cmd.action}
                      </Button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {/* Quick action chips */}
        {showQuickActions && (
          <div className="flex flex-wrap gap-2 pt-2 animate-fade-in">
            {QUICK_ACTIONS.map((action) => (
              <button
                key={action.label}
                onClick={() => send(action.prompt(selectedCellLabel))}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-medium bg-accent/80 hover:bg-accent text-foreground border border-border/40 hover:border-primary/30 transition-all hover:shadow-sm"
              >
                <action.icon className="h-3 w-3 text-primary" />
                {action.label}
              </button>
            ))}
          </div>
        )}

        {isLoading && messages[messages.length - 1]?.role !== "assistant" && (
          <div className="flex gap-2.5 animate-fade-in">
            <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-primary to-[hsl(var(--gradient-end))] flex items-center justify-center flex-shrink-0 shadow-sm">
              <Bot className="h-3.5 w-3.5 text-primary-foreground" />
            </div>
            <div className="bg-accent/60 border border-border/30 rounded-2xl px-4 py-3 flex gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/60 animate-bounce" style={{ animationDelay: "0ms" }} />
              <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/60 animate-bounce" style={{ animationDelay: "150ms" }} />
              <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/60 animate-bounce" style={{ animationDelay: "300ms" }} />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="border-t border-border/50 p-3 flex-shrink-0 bg-accent/20">
        <div className="flex gap-2 items-end">
          <textarea
            ref={inputRef}
            className="flex-1 resize-none rounded-xl border border-border/50 bg-card px-3.5 py-2.5 text-xs outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/30 min-h-[60px] max-h-[120px] transition-all"
            placeholder="Ask about formulas, debug errors, test scenarios..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
            }}
          />
          <Button
            size="icon-sm"
            onClick={() => send()}
            disabled={!input.trim() || isLoading}
            className="h-9 w-9 flex-shrink-0 rounded-xl bg-gradient-to-br from-primary to-[hsl(var(--gradient-end))] hover:opacity-90 shadow-md shadow-primary/20"
          >
            {isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
          </Button>
        </div>
        <p className="text-[10px] text-muted-foreground mt-1.5 px-1">Enter to send · Shift+Enter for new line</p>
      </div>
    </div>
  );
}
