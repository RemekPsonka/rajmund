import { forwardRef } from "react";
import { QRCodeSVG } from "qrcode.react";
import { format } from "date-fns";
import { pl } from "date-fns/locale";

interface PalletLabelProps {
  companyName: string;
  ssccNumber: string;
  productSummary: { name: string; weight: number; count: number }[];
  totalNetWeight: number;
  totalGrossWeight: number;
  productionDate: string;
  facilityName?: string;
}

export const PalletLabel = forwardRef<HTMLDivElement, PalletLabelProps>(
  ({ companyName, ssccNumber, productSummary, totalNetWeight, totalGrossWeight, productionDate, facilityName }, ref) => {
    const formattedDate = format(new Date(productionDate), "dd.MM.yyyy", { locale: pl });
    
    return (
      <div 
        ref={ref}
        className="w-[10cm] h-[15cm] bg-white text-black p-4 font-sans text-sm border border-black print:border-2"
        style={{ 
          fontFamily: "Arial, sans-serif",
          pageBreakInside: "avoid",
        }}
      >
        {/* Header with Company Name */}
        <div className="border-b-2 border-black pb-2 mb-3">
          <h1 className="text-xl font-bold text-center uppercase tracking-wide">
            {companyName}
          </h1>
          {facilityName && (
            <p className="text-center text-xs text-gray-600">{facilityName}</p>
          )}
        </div>

        {/* QR Code Section */}
        <div className="flex justify-center mb-3">
          <div className="p-2 border border-gray-300">
            <QRCodeSVG 
              value={ssccNumber} 
              size={120}
              level="M"
              includeMargin={false}
            />
          </div>
        </div>

        {/* SSCC Number */}
        <div className="text-center mb-3">
          <p className="text-xs text-gray-500 uppercase">Nr SSCC / Paleta</p>
          <p className="text-lg font-bold font-mono tracking-wider">{ssccNumber}</p>
        </div>

        {/* Product Summary Grid */}
        <div className="border border-black mb-3">
          <div className="bg-gray-100 px-2 py-1 border-b border-black">
            <p className="text-xs font-bold uppercase">Zawartość palety</p>
          </div>
          <div className="max-h-[4cm] overflow-hidden">
            {productSummary.slice(0, 5).map((item, idx) => (
              <div 
                key={idx}
                className="flex justify-between px-2 py-1 border-b border-gray-200 last:border-b-0 text-xs"
              >
                <span className="truncate flex-1">{item.name}</span>
                <span className="font-mono ml-2">{item.count}x</span>
                <span className="font-mono font-bold ml-2 w-16 text-right">
                  {item.weight.toFixed(1)} kg
                </span>
              </div>
            ))}
            {productSummary.length > 5 && (
              <div className="px-2 py-1 text-xs text-gray-500 italic">
                + {productSummary.length - 5} więcej pozycji...
              </div>
            )}
          </div>
        </div>

        {/* Weight Section */}
        <div className="grid grid-cols-2 gap-2 mb-3">
          <div className="border border-black p-2 text-center">
            <p className="text-xs text-gray-500 uppercase">Waga Netto</p>
            <p className="text-2xl font-bold font-mono">{totalNetWeight.toFixed(1)}</p>
            <p className="text-xs">kg</p>
          </div>
          <div className="border border-black p-2 text-center">
            <p className="text-xs text-gray-500 uppercase">Waga Brutto</p>
            <p className="text-2xl font-bold font-mono">{totalGrossWeight.toFixed(1)}</p>
            <p className="text-xs">kg</p>
          </div>
        </div>

        {/* Date Section */}
        <div className="border border-black p-2 text-center mb-3">
          <p className="text-xs text-gray-500 uppercase">Data Produkcji / Zamrożenia</p>
          <p className="text-lg font-bold">{formattedDate}</p>
        </div>

        {/* Footer */}
        <div className="text-center text-xs text-gray-400 mt-auto pt-2 border-t border-gray-200">
          <p>Wygenerowano automatycznie przez system MES</p>
        </div>
      </div>
    );
  }
);

PalletLabel.displayName = "PalletLabel";
