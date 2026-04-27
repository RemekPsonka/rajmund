/**
 * Industrial HMI number formatters.
 * Locale: pl-PL (separator tysięcy = NBSP, dziesiętny = przecinek).
 */

const NBSP = "\u00A0";

/** Wagi: 3 miejsca po przecinku, NBSP tysięcy. Np. 47326.8 → "47 326,800". */
export function formatWeight(kg: number | null | undefined, withUnit = true): string {
  if (kg === null || kg === undefined || Number.isNaN(kg)) return withUnit ? `—${NBSP}kg` : "—";
  const formatted = new Intl.NumberFormat("pl-PL", {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
    useGrouping: true,
  })
    .format(kg)
    .replace(/\u202F|\s/g, NBSP); // normalizacja narrow-NBSP → NBSP
  return withUnit ? `${formatted}${NBSP}kg` : formatted;
}

/** Sztuki/integery: NBSP tysięcy, brak miejsc po przecinku. */
export function formatCount(n: number | null | undefined, withUnit = false): string {
  if (n === null || n === undefined || Number.isNaN(n)) return withUnit ? `—${NBSP}szt` : "—";
  const formatted = new Intl.NumberFormat("pl-PL", {
    maximumFractionDigits: 0,
    useGrouping: true,
  })
    .format(Math.round(n))
    .replace(/\u202F|\s/g, NBSP);
  return withUnit ? `${formatted}${NBSP}szt` : formatted;
}

/** Temperatura: 1 miejsce po przecinku, jednostka °C. */
export function formatTemp(c: number | null | undefined): string {
  if (c === null || c === undefined || Number.isNaN(c)) return `—${NBSP}°C`;
  return `${c.toFixed(1).replace(".", ",")}${NBSP}°C`;
}

/** Procent: 1 miejsce po przecinku. */
export function formatPercent(pct: number | null | undefined): string {
  if (pct === null || pct === undefined || Number.isNaN(pct)) return "—%";
  return `${pct.toFixed(1).replace(".", ",")}%`;
}

/** Numer zmiany na podstawie godziny (6-14=1, 14-22=2, 22-6=3). */
export function getShiftNumber(date: Date = new Date()): 1 | 2 | 3 {
  const h = date.getHours();
  if (h >= 6 && h < 14) return 1;
  if (h >= 14 && h < 22) return 2;
  return 3;
}

export function getShiftLabel(date: Date = new Date()): string {
  return `Zmiana ${getShiftNumber(date)}`;
}
