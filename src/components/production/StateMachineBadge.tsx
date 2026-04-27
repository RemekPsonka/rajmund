import { useEffect, useState } from "react";
import { Check, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { STATE_LABELS_PL } from "@/lib/stateMachines";

interface StateMachineBadgeProps {
  states: readonly string[];
  current: string;
  labels?: Record<string, string>;
  /** Ms timestamp wejścia w bieżący stan; gdy podane, w aktywnym pillu pokaże się timer. */
  timer?: { stateStartedAt: number };
  className?: string;
}

function formatElapsed(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => n.toString().padStart(2, "0");
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

export function StateMachineBadge({
  states,
  current,
  labels,
  timer,
  className,
}: StateMachineBadgeProps) {
  const labelMap = labels ?? STATE_LABELS_PL;
  const currentIdx = Math.max(0, states.indexOf(current));

  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!timer) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [timer]);

  const elapsedLabel = timer ? formatElapsed(now - timer.stateStartedAt) : null;

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-1.5 rounded-md border bg-card p-2",
        className
      )}
      role="group"
      aria-label="Etap procesu"
    >
      {/* Kompaktowy fallback dla bardzo wąskich ekranów */}
      <span className="sr-only">
        Etap {currentIdx + 1} z {states.length}: {labelMap[current] ?? current}
      </span>

      {states.map((state, idx) => {
        const isPast = idx < currentIdx;
        const isActive = idx === currentIdx;
        const label = labelMap[state] ?? state;

        return (
          <div key={state} className="flex items-center gap-1.5">
            <div
              className={cn(
                "flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition-colors",
                isActive && "bg-primary text-primary-foreground shadow-sm",
                isPast && "bg-muted text-muted-foreground",
                !isActive && !isPast && "bg-muted/40 text-muted-foreground/60"
              )}
              aria-current={isActive ? "step" : undefined}
            >
              {isPast && <Check className="h-3 w-3" aria-hidden />}
              <span>{label}</span>
              {isActive && elapsedLabel && (
                <span
                  className="ml-1 rounded bg-primary-foreground/15 px-1 font-mono text-[10px] tabular-nums"
                  aria-label={`Czas w stanie ${elapsedLabel}`}
                >
                  {elapsedLabel}
                </span>
              )}
            </div>
            {idx < states.length - 1 && (
              <ChevronRight
                className="hidden h-3 w-3 text-muted-foreground/50 sm:block"
                aria-hidden
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
