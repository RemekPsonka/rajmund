import * as XLSX from "xlsx";

interface ExportOptions {
  filename: string;
  sheetName?: string;
}

/**
 * Export data to Excel (.xlsx) file
 */
export function exportToExcel<T extends Record<string, unknown>>(
  data: T[],
  columns: { key: keyof T; header: string }[],
  options: ExportOptions
): void {
  const { filename, sheetName = "Dane" } = options;

  // Transform data to array of arrays with headers
  const headers = columns.map((col) => col.header);
  const rows = data.map((item) =>
    columns.map((col) => {
      const value = item[col.key];
      // Handle dates, numbers, and other types
      if (value instanceof Date) {
        return value.toLocaleDateString("pl-PL");
      }
      if (value === null || value === undefined) {
        return "";
      }
      return value;
    })
  );

  const worksheetData = [headers, ...rows];

  // Create workbook and worksheet
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);

  // Auto-size columns
  const colWidths = columns.map((col, i) => {
    const maxLen = Math.max(
      col.header.length,
      ...rows.map((row) => String(row[i]).length)
    );
    return { wch: Math.min(maxLen + 2, 50) };
  });
  worksheet["!cols"] = colWidths;

  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

  // Generate file and trigger download
  XLSX.writeFile(workbook, `${filename}.xlsx`);
}

/**
 * Export data to CSV file
 */
export function exportToCSV<T extends Record<string, unknown>>(
  data: T[],
  columns: { key: keyof T; header: string }[],
  options: ExportOptions
): void {
  const { filename } = options;

  // Transform data to CSV string
  const headers = columns.map((col) => `"${col.header}"`).join(";");
  const rows = data.map((item) =>
    columns
      .map((col) => {
        const value = item[col.key];
        if (value instanceof Date) {
          return `"${value.toLocaleDateString("pl-PL")}"`;
        }
        if (value === null || value === undefined) {
          return '""';
        }
        // Escape quotes and wrap in quotes
        return `"${String(value).replace(/"/g, '""')}"`;
      })
      .join(";")
  );

  const csvContent = [headers, ...rows].join("\n");

  // Add BOM for Excel compatibility with Polish characters
  const bom = "\uFEFF";
  const blob = new Blob([bom + csvContent], { type: "text/csv;charset=utf-8;" });

  // Trigger download
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `${filename}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(link.href);
}
