# Naprawa błędu runtime w DevToolsPage

## Problem
`Uncaught TypeError: Cannot read properties of undefined (reading 'raw_input_kg')` w `src/pages/dev/DevToolsPage.tsx:366`.

Warunek renderowania bloku wyników `result && result.success` przepuszcza obiekt, w którym RPC zwróciło `success: true` ale bez pola `summary` (lub z pustym kontekstem po cleanupie). Wszystkie odwołania `result.summary.raw_input_kg`, `result.summary.decomposition?.yield_percent` itp. wybuchają na `result.summary` undefined.

## Zmiana
Plik: `src/pages/dev/DevToolsPage.tsx`

Linia 351 — wzmocnij warunek bramki:
```tsx
{result && result.success && result.summary && (
```

To wystarczy — wszystkie wewnętrzne odwołania już używają opcjonalnego `?.` na zagnieżdżonych polach (`decomposition?.`, `assembly?.`, itd.), więc brakuje tylko gwardii na sam `summary`.

## Brak innych zmian
- Nie ruszam scope'u Sprintu S6 / DatabaseHealthCheck.
- Nie ruszam pola "płeć" ani niczego z HR.
- Nie ruszam seed scenariusza Narrow.