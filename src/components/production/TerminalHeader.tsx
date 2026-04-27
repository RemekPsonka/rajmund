import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ArrowLeft, type LucideIcon } from "lucide-react";

export type TerminalKind =
  | "freezing"
  | "weighing"
  | "tumbler"
  | "assembly"
  | "palletization";

const STYLES: Record<TerminalKind, string> = {
  freezing: "bg-red-700 text-white",
  weighing: "bg-blue-700 text-white",
  tumbler: "bg-orange-700 text-white",
  assembly: "bg-orange-700 text-white",
  palletization: "bg-gray-700 text-white",
};

export interface TerminalHeaderProps {
  kind: TerminalKind;
  title: string;
  icon?: LucideIcon;
  onBack?: () => void;
  right?: React.ReactNode;
  className?: string;
}

export function TerminalHeader({
  kind,
  title,
  icon: Icon,
  onBack,
  right,
  className,
}: TerminalHeaderProps) {
  return (
    <header
      className={cn(
        "h-[60px] flex items-center justify-between px-4 md:px-6",
        "shadow-[0_2px_8px_rgba(0,0,0,0.08)]",
        STYLES[kind],
        className,
      )}
    >
      <div className="flex items-center gap-3 min-w-0">
        {onBack && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onBack}
            className="h-10 w-10 text-white hover:bg-white/15 hover:text-white"
            aria-label="Wróć"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
        )}
        {Icon && <Icon className="h-7 w-7 shrink-0" />}
        <h1 className="truncate text-2xl font-bold uppercase tracking-wide">{title}</h1>
      </div>
      {right && <div className="flex items-center gap-3">{right}</div>}
    </header>
  );
}

export default TerminalHeader;
