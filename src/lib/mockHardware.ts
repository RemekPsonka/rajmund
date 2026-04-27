/**
 * Centralny moduł mock hardware'u używany przez 4 terminale produkcyjne,
 * paletyzację i wszelkie ekrany symulujące wagi/skanery/drukarki.
 *
 * NIE wykonuje I/O ani zapisu do bazy — to jest warstwa imitacji urządzeń.
 * Logikę audytu (np. wpis do t_print_log) trzymaj w hookach domeny (useLogPrint).
 */

import { useCallback, useState } from "react";

// ---------------------------------------------------------------------------
// utils
// ---------------------------------------------------------------------------

export async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// Waga
// ---------------------------------------------------------------------------

/**
 * Symuluje pojedynczy odczyt wagi z losowym jitterem ±jitterPct%.
 * Domyślnie ±2% (typowy szum komercyjnej wagi pomostowej).
 */
export function mockScaleRead(targetKg: number, jitterPct = 2): number {
  const jitter = (Math.random() - 0.5) * 2 * (jitterPct / 100);
  return Math.round(targetKg * (1 + jitter) * 1000) / 1000;
}

export interface UseMockScaleResult {
  reading: number | null;
  isReading: boolean;
  readWeight: (plannedKg?: number) => Promise<number>;
  reset: () => void;
}

/**
 * Hook dla terminali — symuluje "naciśnij PRINT na wadze" z latencją ~400ms.
 * Domyślnie używa plannedKg z argumentu hooka, ale można nadpisać per-call.
 */
export function useMockScale(plannedKg: number, jitterPct = 2): UseMockScaleResult {
  const [reading, setReading] = useState<number | null>(null);
  const [isReading, setIsReading] = useState(false);

  const readWeight = useCallback(
    async (override?: number): Promise<number> => {
      setIsReading(true);
      await sleep(400);
      const value = mockScaleRead(override ?? plannedKg, jitterPct);
      setReading(value);
      setIsReading(false);
      return value;
    },
    [plannedKg, jitterPct],
  );

  const reset = useCallback(() => setReading(null), []);

  return { reading, isReading, readWeight, reset };
}

// ---------------------------------------------------------------------------
// Skaner kodów
// ---------------------------------------------------------------------------

export type ScannerCodeType = "SSCC" | "GTIN" | "LOT" | "EMPLOYEE";

/**
 * Symuluje skan kodu — latencja ~300ms, zwraca syntetyczny ale prawidłowy kod.
 * SSCC: deleguje do generateSSCC z hooks/useHandlingUnits (poprawny mod10).
 * GTIN: 13-cyfrowy EAN startujący od 590 (Polska).
 * LOT: format LOT-YYYYMMDD-NNN.
 * EMPLOYEE: format EMP-NNNN.
 */
export async function mockScannerRead(type: ScannerCodeType): Promise<string> {
  await sleep(300);

  if (type === "SSCC") {
    const { generateSSCC } = await import("@/hooks/useHandlingUnits");
    return generateSSCC();
  }

  if (type === "GTIN") {
    return "590" + Math.floor(Math.random() * 1e10).toString().padStart(10, "0");
  }

  if (type === "LOT") {
    return (
      "LOT-" +
      new Date().toISOString().slice(0, 10).replace(/-/g, "") +
      "-" +
      Math.floor(Math.random() * 1000).toString().padStart(3, "0")
    );
  }

  // EMPLOYEE
  return "EMP-" + Math.floor(Math.random() * 10000).toString().padStart(4, "0");
}

// ---------------------------------------------------------------------------
// Drukarka
// ---------------------------------------------------------------------------

export interface MockPrintResult {
  id: string;
  printed_at: string;
}

/**
 * Symuluje wysłanie zadania do drukarki — latencja ~500ms.
 * Zwraca sztuczny job-id + timestamp. NIE wpisuje do t_print_log
 * (to robi useLogPrint w warstwie domenowej).
 */
export async function mockPrint(
  _documentType: string,
  _payload: unknown,
): Promise<MockPrintResult> {
  await sleep(500);
  return {
    id:
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `print-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    printed_at: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Mrożenie szokowe — sonda temperatury rdzenia
// ---------------------------------------------------------------------------

/**
 * Mock symulacji odczytów sondy temperatury rdzenia podczas mrożenia szokowego.
 *
 * Krzywa wykładnicza: T(t) = T0 + (Ttarget - T0) * (1 - exp(-k * t))
 * - T0       — temperatura startowa (typowo +4°C produkt z chłodni)
 * - Ttarget  — asymptota (np. -22°C w komorze szokowej)
 * - k        — stała szybkości (1/s); im większa, tym szybsze schładzanie
 *
 * Domyślne k=0.0008  → próg CCP -18°C osiągany ~50 min (czas symulowany = realny).
 * Dla dema można podmienić na mockFreezingTempAtFast (k=0.01) → ~5 min.
 */
export function mockFreezingTempAt(
  elapsedSec: number,
  T0 = 4,
  Ttarget = -22,
  k = 0.0008,
): number {
  const t = T0 + (Ttarget - T0) * (1 - Math.exp(-k * elapsedSec));
  return Math.round(t * 10) / 10;
}

/** Przyspieszona wersja do dem (próg CCP w ~5 min realnego czasu). */
export function mockFreezingTempAtFast(elapsedSec: number): number {
  return mockFreezingTempAt(elapsedSec, 4, -22, 0.01);
}
