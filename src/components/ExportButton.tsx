import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Download, FileSpreadsheet, FileText } from "lucide-react";
import { exportToExcel, exportToCSV } from "@/lib/exportUtils";
import { toast } from "sonner";

interface ExportButtonProps<T extends Record<string, unknown>> {
  data: T[];
  columns: { key: keyof T; header: string }[];
  filename: string;
  disabled?: boolean;
}

export function ExportButton<T extends Record<string, unknown>>({
  data,
  columns,
  filename,
  disabled = false,
}: ExportButtonProps<T>) {
  const handleExportExcel = () => {
    try {
      exportToExcel(data, columns, { filename });
      toast.success(`Wyeksportowano ${data.length} wierszy do Excel`);
    } catch (error) {
      toast.error("Błąd eksportu do Excel");
      console.error(error);
    }
  };

  const handleExportCSV = () => {
    try {
      exportToCSV(data, columns, { filename });
      toast.success(`Wyeksportowano ${data.length} wierszy do CSV`);
    } catch (error) {
      toast.error("Błąd eksportu do CSV");
      console.error(error);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" disabled={disabled || data.length === 0}>
          <Download className="h-4 w-4 mr-2" />
          Eksport
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={handleExportExcel}>
          <FileSpreadsheet className="h-4 w-4 mr-2" />
          Excel (.xlsx)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleExportCSV}>
          <FileText className="h-4 w-4 mr-2" />
          CSV
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
