import ReactMarkdown from "react-markdown";
import { cn } from "@/lib/utils";

export function ChatMessage({
  role,
  content,
}: {
  role: "user" | "assistant" | "system";
  content: string;
}) {
  if (role === "system") return null;
  const isUser = role === "user";
  return (
    <div className={cn("flex w-full", isUser ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed md:text-base",
          isUser
            ? "bg-primary/15 border border-primary/30 text-foreground"
            : "bg-surface border border-border text-foreground",
        )}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap">{content}</p>
        ) : (
          <div className="prose prose-sm prose-invert max-w-none prose-p:my-2 prose-li:my-0.5 prose-ul:my-2">
            <ReactMarkdown>{content || "…"}</ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  );
}
