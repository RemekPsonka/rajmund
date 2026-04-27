/**
 * Mock symulacji odczytów sondy temperatury rdzenia podczas mrożenia szokowego.
 *
 * Krzywa wykładnicza: T(t) = T0 + (Ttarget - T0) * (1 - exp(-k * t))
 * - T0       — temperatura startowa (typowo +4°C produkt z chłodni)
 * - Ttarget  — asymptota (np. -22°C w komorze szokowej)
 * - k        — stała szybkości (1/s); im większa, tym szybsze schładzanie
 *
 * Domyślne k=0.0008  → próg CCP -18°C osiągany ~50 min (czas symulowany = realny).
 * Dla dema demo można podmienić na mockFreezingTempAtFast (k=0.01) → ~5 min.
 */
export function mockFreezingTempAt(
  elapsedSec: number,
  T0 = 4,
  Ttarget = -22,
  k = 0.0008
): number {
  const t = T0 + (Ttarget - T0) * (1 - Math.exp(-k * elapsedSec));
  return Math.round(t * 10) / 10;
}

/** Przyspieszona wersja do dem (próg CCP w ~5 min realnego czasu). */
export function mockFreezingTempAtFast(elapsedSec: number): number {
  return mockFreezingTempAt(elapsedSec, 4, -22, 0.01);
}
