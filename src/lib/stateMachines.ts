// Definicje maszyn stanów dla terminali produkcyjnych.
// Stan trzymany jest w UI (useState w komponencie terminala) i derive'owany
// z istniejących danych — nie persystujemy tego w bazie (na razie).

export const STATE_MACHINES = {
  weighing: ['Pending', 'Tare_Read', 'Gross_Read', 'Confirmed', 'Transferred'],
  tumbling: ['Idle', 'Loading', 'Loaded', 'Mixing', 'Resting', 'Done', 'Discharging', 'Closed'],
  assembly: ['Setup', 'Producing', 'Quality_Check', 'Done', 'Labeled', 'Closed'],
  freezing: ['Loading', 'Freezing', 'Stabilizing', 'Verified', 'Released'],
} as const;

export type WeighingState = typeof STATE_MACHINES.weighing[number];
export type TumblingState = typeof STATE_MACHINES.tumbling[number];
export type AssemblyState = typeof STATE_MACHINES.assembly[number];
export type FreezingState = typeof STATE_MACHINES.freezing[number];

// Polskie etykiety wyświetlane w UI (zgodnie z Core: system po polsku).
export const STATE_LABELS_PL: Record<string, string> = {
  // weighing
  Pending: 'Oczekiwanie',
  Tare_Read: 'Tara',
  Gross_Read: 'Brutto',
  Confirmed: 'Potwierdzone',
  Transferred: 'Przekazane',
  // tumbling
  Idle: 'Wolny',
  Loading: 'Załadunek',
  Loaded: 'Załadowane',
  Mixing: 'Masowanie',
  Resting: 'Odpoczynek',
  Done: 'Zakończone',
  Discharging: 'Rozładunek',
  Closed: 'Zamknięte',
  // assembly
  Setup: 'Przygotowanie',
  Producing: 'Produkcja',
  Quality_Check: 'Kontrola',
  Labeled: 'Etykiety',
  // freezing
  Freezing: 'Zamrażanie',
  Stabilizing: 'Stabilizacja',
  Verified: 'Zweryfikowane',
  Released: 'Zwolnione',
};
