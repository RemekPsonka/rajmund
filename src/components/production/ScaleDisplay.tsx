import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatWeight } from "@/lib/formatters";

interface ScaleDisplayProps {
  weight: number | null;
  isReading?: boolean;
  targetKg?: number;
  tolerancePct?: number;
  label?: string;
  className?: string;
}

/**
 * HMI-style large weight display.
 * - 96px monospace digit
 * - Spinner + "Stabilizacja..." while isReading
 * - Green when within ±tolerancePct of targetKg, red when outside
 * - 300ms fade transition on weight change
 */
export function ScaleDisplay({
  weight,
  isReading = false,
  targetKg,
  tolerancePct = 2,
  label,
  className,
}: ScaleDisplayProps) {
  const [shown, setShown] = useState(weight);
  const [fade, setFade] = useState(false);

  useEffect(() => {
    if (weight === shown) return;
    setFade(true);
    const t1 = setTimeout(() => {
      setShown(weight);
      setFade(false);
    }, 150);
    return () => clearTimeout(t1);
  }, [weight, shown]);

  let toleranceColor = "text-foreground";
  if (!isReading && shown != null && targetKg != null && targetKg > 0) {
    const diffPct = Math.abs(shown - targetKg) / targetKg * 100;
    toleranceColor = diffPct <= tolerancePct ? "text-green-500" : "text-red-500";
  }

  return (
    <div
      className={cn(
        "rounded-lg border-2 border-border bg-black/90 p-6 flex flex-col items-end justify-center min-h-[160px]",
        className,
      )}
    >
      {label && (
        <div className="text-xs uppercase tracking-widest text-muted-foreground mb-2 self-start">
          {label}
        </div>
      )}
      <div
        className={cn(
          "font-mono text-[96px] leading-none tabular-nums tracking-tight transition-opacity duration-150",
          toleranceColor,
          fade ? "opacity-0" : "opacity-100",
        )}
      >
        {shown != null ? formatWeight(shown).replace(/\u00A0kg$/, "") : "—"}
      </div>
      <div className="mt-3 h-6 flex items-center gap-2 text-sm text-muted-foreground self-end">
        {isReading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Stabilizacja…</span>
          </>
        ) : targetKg != null ? (
          <span>cel: {formatWeight(targetKg)}</span>
        ) : (
          <span>kg</span>
        )}
      </div>
    </div>
  );
}

export default ScaleDisplay;
