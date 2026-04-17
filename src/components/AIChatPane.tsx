import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
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
  messages: Message[];
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  input: string;
  setInput: React.Dispatch<React.SetStateAction<string>>;
  width: number;
  setWidth: React.Dispatch<React.SetStateAction<number>>;
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

const FORMATTING_VERB_REGEX = /\b(wrap|wrapping|bold|italic|underline|color|colou?r|highlight|align|font\s*size|background|format|formatting|style|styling|delete|deleting|clear|clearing|remove|removing|erase|erasing|wipe|wiping)\b/i;

function describesFormattingButNoBlock(content: string, commandCount: number): boolean {
  if (commandCount > 0) return false;
  if (!content || content.length < 20) return false;
  // Skip the welcome message and any apology / refusal
  if (content.includes("👋") || content.startsWith("⚠️") || content.startsWith("✅")) return false;
  return FORMATTING_VERB_REGEX.test(content);
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

      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error("Please sign in to use the AI assistant.");
      }

      const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/spreadsheet-ai`;
      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
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
    <div className="flex flex-col h-full bg-card" style={{ width: 380 }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border flex-shrink-0">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium text-foreground">GridMind AI</span>
        </div>
        <Button variant="ghost" size="icon-sm" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map((msg, i) => {
          const commands = msg.role === "assistant" ? extractCommands(msg.content) : [];
          return (
            <div key={i} className={`flex gap-2 ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}>
              <div className={`flex-shrink-0 h-6 w-6 rounded flex items-center justify-center text-xs ${
                msg.role === "assistant"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground"
              }`}>
                {msg.role === "assistant" ? <Bot className="h-3 w-3" /> : <User className="h-3 w-3" />}
              </div>
              <div className="max-w-[85%] space-y-1.5">
                <div className={`rounded-lg px-3 py-2 text-xs leading-relaxed ${
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-foreground"
                }`}>
                  {msg.role === "assistant" ? (
                    <div className="prose prose-xs max-w-none prose-code:bg-background prose-code:text-primary prose-code:px-1 prose-code:rounded">
                      <ReactMarkdown>{msg.content || "▊"}</ReactMarkdown>
                    </div>
                  ) : (
                    <span>{msg.content}</span>
                  )}
                </div>
                {commands.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {commands.map((cmd, ci) => (
                      <Button
                        key={ci}
                        size="sm"
                        className="h-7 text-[10px] gap-1.5"
                        onClick={() => handleApply(cmd)}
                      >
                        <Play className="h-3 w-3" />
                        Apply {cmd.action === "SET_CELLS" ? `${cmd.data?.length || 0} cell changes` : cmd.action === "DELETE_CELLS" ? `${cmd.data?.length || 0} cell deletion${(cmd.data?.length || 0) === 1 ? "" : "s"}` : cmd.action}
                      </Button>
                    ))}
                  </div>
                )}
                {msg.role === "assistant" && describesFormattingButNoBlock(msg.content, commands.length) && !isLoading && (
                  <div className="flex items-start gap-1.5 rounded-md border border-destructive/40 bg-destructive/10 px-2 py-1.5 text-[10px] leading-snug text-destructive">
                    <AlertTriangle className="h-3 w-3 flex-shrink-0 mt-0.5" />
                    <span>The AI described changes but didn't produce an Apply block. Try rephrasing — e.g. <em>"Wrap rows 1–10 of column B"</em>.</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {showQuickActions && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {QUICK_ACTIONS.map((action) => (
              <button
                key={action.label}
                onClick={() => send(action.prompt(selectedCellLabel))}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[11px] font-medium bg-muted hover:bg-accent text-foreground border border-border transition-colors"
              >
                <action.icon className="h-3 w-3 text-muted-foreground" />
                {action.label}
              </button>
            ))}
          </div>
        )}

        {isLoading && messages[messages.length - 1]?.role !== "assistant" && (
          <div className="flex gap-2">
            <div className="h-6 w-6 rounded bg-primary flex items-center justify-center flex-shrink-0">
              <Bot className="h-3 w-3 text-primary-foreground" />
            </div>
            <div className="bg-muted rounded-lg px-3 py-2.5 flex gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: "0ms" }} />
              <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: "150ms" }} />
              <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: "300ms" }} />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="border-t border-border p-3 flex-shrink-0">
        <div className="flex gap-2 items-end">
          <textarea
            ref={inputRef}
            className="flex-1 resize-none rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring min-h-[120px] max-h-[240px]"
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
            className="h-8 w-8 flex-shrink-0 rounded-md"
          >
            {isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
          </Button>
        </div>
        <p className="text-[10px] text-muted-foreground mt-1.5 px-0.5">Enter to send · Shift+Enter for new line</p>
      </div>
    </div>
  );
}
