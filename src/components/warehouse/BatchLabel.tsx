import { forwardRef } from "react";
import { QRCodeSVG } from "qrcode.react";
import { format } from "date-fns";
import { pl } from "date-fns/locale";

interface BatchLabelProps {
  companyName: string;
  internalBatchNumber: string;
  productName: string;
  productSku?: string | null;
  quantity: number;
  unit: string;
  productionDate?: string | null;
  expirationDate?: string | null;
  supplierBatchNumber?: string | null;
  supplierName?: string | null;
}

export const BatchLabel = forwardRef<HTMLDivElement, BatchLabelProps>(
  ({ 
    companyName, 
    internalBatchNumber, 
    productName,
    productSku,
    quantity,
    unit,
    productionDate, 
    expirationDate,
    supplierBatchNumber,
    supplierName
  }, ref) => {
    const formatDate = (dateStr: string | null | undefined) => {
      if (!dateStr) return "-";
      try {
        return format(new Date(dateStr), "dd.MM.yyyy", { locale: pl });
      } catch {
        return "-";
      }
    };

    return (
      <div 
        ref={ref}
        className="w-[10cm] h-[7cm] bg-white text-black p-3 font-sans text-sm border-2 border-black"
        style={{ 
          fontFamily: "Arial, sans-serif",
          pageBreakInside: "avoid",
        }}
      >
        {/* Header with Company Name */}
        <div className="border-b-2 border-black pb-1 mb-2">
          <h1 className="text-lg font-bold text-center uppercase tracking-wide">
            {companyName}
          </h1>
        </div>

        {/* Main content - QR left, data right */}
        <div className="flex gap-3 mb-2">
          {/* QR Code */}
          <div className="flex-shrink-0">
            <div className="border border-gray-300 p-1">
              <QRCodeSVG 
                value={internalBatchNumber} 
                size={80}
                level="M"
                includeMargin={false}
              />
            </div>
          </div>

          {/* Data Section */}
          <div className="flex-1 text-xs space-y-1">
            <div>
              <span className="text-gray-500">Nr partii:</span>
              <p className="font-bold font-mono text-sm">{internalBatchNumber}</p>
            </div>
            <div>
              <span className="text-gray-500">Produkt:</span>
              <p className="font-semibold truncate">{productName}</p>
              {productSku && <p className="text-gray-500 text-xs">SKU: {productSku}</p>}
            </div>
          </div>
        </div>

        {/* Weight and Dates Grid */}
        <div className="grid grid-cols-3 gap-1 mb-2 text-xs">
          <div className="border border-black p-1 text-center">
            <p className="text-gray-500 uppercase text-[10px]">Ilość</p>
            <p className="text-base font-bold font-mono">{quantity.toFixed(1)}</p>
            <p className="text-[10px]">{unit}</p>
          </div>
          <div className="border border-black p-1 text-center">
            <p className="text-gray-500 uppercase text-[10px]">Data prod.</p>
            <p className="font-bold text-xs">{formatDate(productionDate)}</p>
          </div>
          <div className="border border-black p-1 text-center">
            <p className="text-gray-500 uppercase text-[10px]">Ważność</p>
            <p className="font-bold text-xs">{formatDate(expirationDate)}</p>
          </div>
        </div>

        {/* Supplier info if available */}
        {(supplierBatchNumber || supplierName) && (
          <div className="border-t border-gray-300 pt-1 text-[10px] text-gray-600">
            {supplierName && <span>Dostawca: {supplierName}</span>}
            {supplierBatchNumber && <span className="ml-2">| Partia dost.: {supplierBatchNumber}</span>}
          </div>
        )}

        {/* Footer */}
        <div className="text-center text-[9px] text-gray-400 mt-auto pt-1 border-t border-gray-200">
          <p>Skanuj QR do identyfikacji na produkcji</p>
        </div>
      </div>
    );
  }
);

BatchLabel.displayName = "BatchLabel";
