import { useEffect, useState } from "react";
import { User, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { getShiftLabel } from "@/lib/formatters";

export interface TerminalFooterProps {
  operator?: { name: string } | null;
  className?: string;
}

function pad(n: number): string {
  return n.toString().padStart(2, "0");
}

function useNow(intervalMs = 1000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

export function TerminalFooter({ operator, className }: TerminalFooterProps) {
  const now = useNow(1000);
  const time = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
  const shift = getShiftLabel(now);

  return (
    <footer
      className={cn(
        "fixed bottom-0 left-0 right-0 z-40",
        "h-[60px] border-t bg-card text-card-foreground shadow-[0_-2px_8px_rgba(0,0,0,0.04)]",
        "flex items-center justify-between px-6",
        "font-mono",
        className,
      )}
    >
      <div className="flex items-center gap-3 min-w-0">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary">
          <User className="h-5 w-5" />
        </div>
        <span className="truncate text-sm font-semibold uppercase tracking-wide">
          {operator?.name ?? "Brak operatora"}
        </span>
      </div>

      <div className="hidden md:block text-base font-bold uppercase tracking-widest text-muted-foreground">
        {shift}
      </div>

      <div className="flex items-center gap-2 tabular-nums">
        <Clock className="h-5 w-5 text-muted-foreground" />
        <span className="text-2xl font-bold tracking-tight">{time}</span>
      </div>
    </footer>
  );
}

export default TerminalFooter;
