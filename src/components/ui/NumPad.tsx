import { Delete } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface NumPadProps {
  value: string;
  onChange: (newValue: string) => void;
  /** Maks. liczba znaków łącznie z kropką. Domyślnie 8 (np. 99999.99). */
  maxLength?: number;
  /** Czy pozwalać na kropkę dziesiętną. Domyślnie true. */
  decimal?: boolean;
  className?: string;
  /** Jednostka wyświetlana po wartości (np. "kg", "szt"). */
  unit?: string;
}

const KEYS: Array<{ label: string; value: string; isAction?: "backspace" }> = [
  { label: "7", value: "7" },
  { label: "8", value: "8" },
  { label: "9", value: "9" },
  { label: "4", value: "4" },
  { label: "5", value: "5" },
  { label: "6", value: "6" },
  { label: "1", value: "1" },
  { label: "2", value: "2" },
  { label: "3", value: "3" },
  { label: ".", value: "." },
  { label: "0", value: "0" },
  { label: "BACKSPACE", value: "", isAction: "backspace" },
];

export function NumPad({
  value,
  onChange,
  maxLength = 8,
  decimal = true,
  className,
  unit,
}: NumPadProps) {
  const handleKey = (key: typeof KEYS[number]) => {
    if (key.isAction === "backspace") {
      onChange(value.slice(0, -1));
      return;
    }
    if (key.value === ".") {
      if (!decimal) return;
      if (value.includes(".")) return;
      // ".5" zamiast ".5" → "0." na początku
      const next = value.length === 0 ? "0." : value + ".";
      if (next.length > maxLength) return;
      onChange(next);
      return;
    }
    if (value.length >= maxLength) return;
    // Blokuj wiodące zera typu "007"
    if (value === "0" && key.value !== ".") {
      onChange(key.value);
      return;
    }
    onChange(value + key.value);
  };

  const display = value || "0";

  return (
    <div className={cn("flex flex-col gap-3 select-none", className)}>
      <div className="flex items-baseline justify-end gap-2 rounded-lg border bg-muted/40 px-4 py-4 min-h-[88px]">
        <span
          className={cn(
            "font-mono text-[64px] leading-none tabular-nums tracking-tight",
            value ? "text-foreground" : "text-muted-foreground/60",
          )}
        >
          {display}
        </span>
        {unit && (
          <span className="font-mono text-2xl text-muted-foreground">{unit}</span>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2">
        {KEYS.map((key, idx) => {
          const isDisabled =
            (key.value === "." && (!decimal || value.includes("."))) ||
            (!key.isAction && value.length >= maxLength && key.value !== ".");
          return (
            <Button
              key={idx}
              type="button"
              variant={key.isAction ? "secondary" : "outline"}
              onClick={() => handleKey(key)}
              disabled={isDisabled}
              className={cn(
                "h-20 w-20 rounded-xl text-2xl font-semibold",
                "transition-colors hover:bg-accent hover:text-accent-foreground",
                "active:scale-[0.97]",
                key.isAction === "backspace" && "text-destructive",
              )}
              aria-label={key.isAction === "backspace" ? "Usuń ostatnią cyfrę" : `Wpisz ${key.label}`}
            >
              {key.isAction === "backspace" ? <Delete className="h-7 w-7" /> : key.label}
            </Button>
          );
        })}
      </div>
    </div>
  );
}

export default NumPad;
