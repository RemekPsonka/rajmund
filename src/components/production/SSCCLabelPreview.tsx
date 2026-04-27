import { QRCodeSVG } from "qrcode.react";
import { format } from "date-fns";
import { Printer } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface SSCCLabelPreviewProps {
  sscc: string;
  gtin?: string;
  lotCode?: string;
  productName?: string;
  weightKg: number;
  productionDate?: string | null;
  bestBefore?: string | null;
  open: boolean;
  onClose: () => void;
  onPrint: () => void;
  isPrinting?: boolean;
}

const fmt = (d?: string | null) => {
  if (!d) return "—";
  try {
    return format(new Date(d), "yyyy-MM-dd");
  } catch {
    return "—";
  }
};

export function SSCCLabelPreview({
  sscc,
  gtin,
  lotCode,
  productName,
  weightKg,
  productionDate,
  bestBefore,
  open,
  onClose,
  onPrint,
  isPrinting,
}: SSCCLabelPreviewProps) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Etykieta paletowa SSCC</DialogTitle>
        </DialogHeader>

        {/* Mock layout 100x150mm Zebra-like */}
        <div
          className="border-2 border-foreground p-4 font-mono bg-background text-foreground"
          style={{ aspectRatio: "2/3" }}
        >
          <div className="text-center font-bold text-lg mb-2 tracking-wider">
            PALETA
          </div>
          {productName && (
            <div className="mb-2 text-center text-sm font-semibold truncate">
              {productName}
            </div>
          )}
          <div className="grid grid-cols-2 gap-2 text-xs mb-2">
            <div>
              LOT: <span className="font-bold">{lotCode || "—"}</span>
            </div>
            <div>
              WAGA: <span className="font-bold">{weightKg.toFixed(2)} kg</span>
            </div>
            <div>PROD: {fmt(productionDate)}</div>
            <div>TMC: {fmt(bestBefore)}</div>
          </div>
          <div className="my-4 flex justify-center">
            <QRCodeSVG value={`(00)${sscc}`} size={120} />
          </div>
          <div className="text-center font-mono text-sm break-all">
            SSCC: {sscc}
          </div>
          {gtin && (
            <div className="text-center text-xs mt-1">GTIN: {gtin}</div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Zamknij
          </Button>
          <Button onClick={onPrint} disabled={isPrinting}>
            <Printer className="mr-2 h-4 w-4" />
            {isPrinting ? "DRUKUJĘ…" : "DRUKUJ"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
