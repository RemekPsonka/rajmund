

# Plan Naprawy Systemu NARROW ERP

## Podsumowanie

Zidentyfikowano **29 problemów** podzielonych na **29 osobnych zadań naprawczych**. Każde zadanie rozwiązuje dokładnie jeden problem.

---

## FAZA 1: Bezpieczeństwo (Krytyczne)

### Zadanie 1.1: Zabezpieczenie terminali produkcyjnych
**Problem**: Terminale `/production/terminal`, `/production/tumbler`, `/production/assembly`, `/production/freezing` są dostępne bez logowania.

**Rozwiązanie**: Przenieść trasy terminali do grupy `<ProtectedRoute>` w `App.tsx`.

| Plik | Zmiana |
|------|--------|
| `src/App.tsx` | Przenieść linie 95-98 do sekcji chronionych tras |

```text
PRZED:
<Route path="/production/terminal" element={<WeighingTerminalPage />} />
(poza ProtectedRoute)

PO:
<Route element={<ProtectedRoute />}>
  <Route path="/production/terminal" element={<WeighingTerminalPage />} />
</Route>
```

---

### Zadanie 1.2: Włączenie ochrony przed wyciekniętymi hasłami
**Problem**: Supabase Auth nie sprawdza haseł w bazach wycieków (HaveIBeenPwned).

**Rozwiązanie**: Użyć narzędzia `configure-auth` aby włączyć `leaked_password_protection`.

| Akcja | Wartość |
|-------|---------|
| configure-auth | `leaked_password_protection: true` |

---

### Zadanie 1.3: Walidacja danych wejściowych w NewDeliveryPage
**Problem**: Brak walidacji długości i formatu pól tekstowych (np. `supplier_batch_number`).

**Rozwiązanie**: Dodać schemat Zod dla formularza dostawy.

| Plik | Zmiana |
|------|--------|
| `src/pages/warehouse/NewDeliveryPage.tsx` | Dodać walidację Zod z limitami znaków |

---

## FAZA 2: Persystencja danych

### Zadanie 2.1: Naprawa Terminal Mrożenia - zapis do bazy
**Problem**: `ShockFreezingTerminalPage` używa tylko `useState`, dane giną przy odświeżeniu.

**Rozwiązanie**: Dodać mutację `createLog.mutateAsync` przy zatwierdzaniu procesu mrożenia.

| Plik | Zmiana |
|------|--------|
| `src/pages/production/ShockFreezingTerminalPage.tsx` | Implementacja zapisu do `t_production_logs` |

---

### Zadanie 2.2: Transakcje bazodanowe w NewDeliveryPage
**Problem**: Tworzenie partii i dokumentów w pętli bez transakcji - ryzyko częściowego zapisu.

**Rozwiązanie**: Opakować operacje w funkcję RPC z transakcją lub użyć `.upsert()` z obsługą błędów.

| Plik | Zmiana |
|------|--------|
| `src/pages/warehouse/NewDeliveryPage.tsx` | Refaktoryzacja na atomowe operacje |

---

### Zadanie 2.3: Transakcje w NewTransferPage
**Problem**: Identyczny problem jak w NewDeliveryPage.

**Rozwiązanie**: Analogiczna refaktoryzacja.

| Plik | Zmiana |
|------|--------|
| `src/pages/warehouse/NewTransferPage.tsx` | Refaktoryzacja na atomowe operacje |

---

## FAZA 3: Walidacja biznesowa

### Zadanie 3.1: Kontrola dat ważności przy wyborze partii
**Problem**: Można użyć przeterminowanych partii w produkcji.

**Rozwiązanie**: Dodać filtr `expire_at > NOW()` w hookach pobierających partie.

| Plik | Zmiana |
|------|--------|
| `src/hooks/useBatches.ts` | Filtr dat ważności w zapytaniach |
| `src/pages/production/*.tsx` | Wizualne oznaczenie przeterminowanych partii |

---

### Zadanie 3.2: Blokada partii ze statusem Quarantine/Blocked
**Problem**: Brak pełnej walidacji statusu partii przy selekcji.

**Rozwiązanie**: Konsekwentne filtrowanie `status = 'Released'` we wszystkich terminalach.

| Plik | Zmiana |
|------|--------|
| `src/pages/production/WeighingTerminalPage.tsx` | Filtr statusu |
| `src/pages/production/TumblerTerminalPage.tsx` | Filtr statusu |
| `src/pages/production/KebabAssemblyTerminalPage.tsx` | Filtr statusu |

---

### Zadanie 3.3: Walidacja wagi w TumblerTerminalPage
**Problem**: Brak sprawdzenia czy waga > 0 i czy nie przekracza dostępnej ilości.

**Rozwiązanie**: Dodać walidację przed dodaniem partii do tumblera.

| Plik | Zmiana |
|------|--------|
| `src/pages/production/TumblerTerminalPage.tsx` | Walidacja `weight > 0 && weight <= batch.current_quantity` |

---

### Zadanie 3.4: Walidacja temperatury w TumblerTerminalPage
**Problem**: Brak walidacji zakresu temperatury (np. -50°C do +50°C).

**Rozwiązanie**: Dodać ograniczenia min/max dla pola temperatury.

| Plik | Zmiana |
|------|--------|
| `src/pages/production/TumblerTerminalPage.tsx` | `min={-50} max={50}` + walidacja |

---

### Zadanie 3.5: Walidacja SSCC - cyfra kontrolna
**Problem**: `generateSSCC()` nie generuje poprawnej cyfry kontrolnej wg GS1.

**Rozwiązanie**: Implementacja algorytmu Mod10 dla SSCC.

| Plik | Zmiana |
|------|--------|
| `src/hooks/useHandlingUnits.ts` | Poprawna funkcja `calculateSSCCCheckDigit()` |

---

### Zadanie 3.6: Walidacja numeru partii dostawcy
**Problem**: `supplier_batch_number` może zawierać dowolne znaki.

**Rozwiązanie**: Regex dla dozwolonych znaków (alfanumeryczne + myślniki).

| Plik | Zmiana |
|------|--------|
| `src/pages/warehouse/NewDeliveryPage.tsx` | Walidacja formatu partii |

---

## FAZA 4: Naprawa logiki biznesowej

### Zadanie 4.1: Hardcoded product_id w KebabAssemblyTerminalPage
**Problem**: Używany jest `finishedProducts[0]` bez sprawdzenia.

**Rozwiązanie**: Dodać wybór produktu docelowego lub sprawdzenie czy lista nie jest pusta.

| Plik | Zmiana |
|------|--------|
| `src/pages/production/KebabAssemblyTerminalPage.tsx` | Bezpieczny dostęp do `finishedProducts` |

---

### Zadanie 4.2: Brak aktualizacji current_quantity po produkcji
**Problem**: Po zużyciu partii w produkcji `current_quantity` nie jest pomniejszane.

**Rozwiązanie**: Dodać UPDATE batcha po każdym `production_input`.

| Plik | Zmiana |
|------|--------|
| `src/hooks/useProductionOrders.ts` | Aktualizacja stanu partii po pobraniu |

---

### Zadanie 4.3: Placeholder w ProductionOrderDetailPage
**Problem**: Sekcja "Partie wynikowe" pokazuje placeholder zamiast rzeczywistych danych.

**Rozwiązanie**: Pobrać dane z `t_production_logs` gdzie `output_batch_id IS NOT NULL`.

| Plik | Zmiana |
|------|--------|
| `src/pages/production/ProductionOrderDetailPage.tsx` | Rzeczywiste dane z logów |

---

### Zadanie 4.4: Brak linku do partii wynikowej w zamkniętych zleceniach
**Problem**: Po zamknięciu zlecenia nie ma nawigacji do utworzonej partii.

**Rozwiązanie**: Dodać link do `/warehouse/batches?id={batch_id}`.

| Plik | Zmiana |
|------|--------|
| `src/pages/production/ProductionOrderDetailPage.tsx` | Nawigacja do partii |

---

### Zadanie 4.5: Brak obsługi błędów w RecipeFormDialog
**Problem**: Błędy z bazy nie są prezentowane użytkownikowi.

**Rozwiązanie**: Dodać `onError` callback z toast.

| Plik | Zmiana |
|------|--------|
| `src/components/recipes/RecipeFormDialog.tsx` | Obsługa błędów mutacji |

---

## FAZA 5: Optymalizacja wydajności

### Zadanie 5.1: Cache dla auth.getUser() w useRolePermissions
**Problem**: Częste wywołania `supabase.auth.getUser()` przy każdym renderze.

**Rozwiązanie**: Użyć `useAuth()` hook zamiast bezpośredniego wywołania.

| Plik | Zmiana |
|------|--------|
| `src/hooks/useRolePermissions.ts` | Zamiana na `useAuth()` hook |

---

### Zadanie 5.2: Brakujący refetch po mutacji w usePackaging
**Problem**: Po transakcji opakowań lista się nie odświeża.

**Rozwiązanie**: Dodać `queryClient.invalidateQueries()`.

| Plik | Zmiana |
|------|--------|
| `src/hooks/usePackaging.ts` | Invalidacja cache po mutacji |

---

### Zadanie 5.3: Brak paginacji w BatchesPage
**Problem**: Przy dużej liczbie partii (>1000) dane będą obcinane.

**Rozwiązanie**: Dodać paginację lub infinite scroll.

| Plik | Zmiana |
|------|--------|
| `src/pages/warehouse/BatchesPage.tsx` | Implementacja paginacji |

---

## FAZA 6: UX i obsługa błędów

### Zadanie 6.1: Brak feedback przy błędzie logowania pracownika
**Problem**: Nieprawidłowy kod QR nie pokazuje komunikatu błędu.

**Rozwiązanie**: Dodać toast z informacją o błędnym kodzie.

| Plik | Zmiana |
|------|--------|
| Wszystkie terminale | Toast przy błędzie weryfikacji QR |

---

### Zadanie 6.2: Brak potwierdzenia przy usuwaniu receptury
**Problem**: Usunięcie receptury następuje bez potwierdzenia.

**Rozwiązanie**: Dodać dialog `AlertDialog` przed usunięciem.

| Plik | Zmiana |
|------|--------|
| `src/pages/settings/RecipesPage.tsx` | Dialog potwierdzenia |

---

### Zadanie 6.3: Brak wizualnego oznaczenia przeterminowanych partii
**Problem**: Partie po dacie ważności wyglądają jak normalne.

**Rozwiązanie**: Dodać czerwone tło/badge dla przeterminowanych.

| Plik | Zmiana |
|------|--------|
| `src/pages/warehouse/BatchesPage.tsx` | Styl dla przeterminowanych |

---

### Zadanie 6.4: Brak stanu pustego w tabelach
**Problem**: Niektóre tabele nie pokazują komunikatu gdy brak danych.

**Rozwiązanie**: Dodać `<EmptyState />` komponent.

| Plik | Zmiana |
|------|--------|
| Wiele plików | Komponent stanu pustego |

---

## FAZA 7: Dokumenty i raporty

### Zadanie 7.1: Brak walidacji danych przed generowaniem CMR
**Problem**: Można wygenerować CMR bez wymaganych pól (kierowca, tablice).

**Rozwiązanie**: Walidacja przed otwarciem generatora PDF.

| Plik | Zmiana |
|------|--------|
| `src/pages/shipping/ShipmentDetailPage.tsx` | Walidacja pól CMR |

---

### Zadanie 7.2: Hardcoded dane firmy w dokumentach PDF
**Problem**: Adres nadawcy jest zahardcodowany.

**Rozwiązanie**: Pobrać dane z `t_companies` i `t_facilities`.

| Plik | Zmiana |
|------|--------|
| `src/components/shipping/documents/CMRDocument.tsx` | Dynamiczne dane firmy |
| `src/components/shipping/documents/HDIDocument.tsx` | Dynamiczne dane firmy |

---

## FAZA 8: Spójność danych

### Zadanie 8.1: Brak cascade delete dla production_inputs
**Problem**: Usunięcie zlecenia może osierocić rekordy inputs.

**Rozwiązanie**: Dodać `ON DELETE CASCADE` do foreign key.

| Plik | Zmiana |
|------|--------|
| Migracja SQL | ALTER TABLE ADD CONSTRAINT |

---

### Zadanie 8.2: Niespójne nazewnictwo kolumn
**Problem**: Mieszane `output_batch_id` vs `batch_id` w różnych tabelach.

**Rozwiązanie**: Dokumentacja lub aliasy w hookach (bez zmiany schematu).

| Plik | Zmiana |
|------|--------|
| Dokumentacja | Wyjaśnienie konwencji |

---

## Harmonogram realizacji

| Faza | Zadania | Priorytet | Szacowany czas |
|------|---------|-----------|----------------|
| 1. Bezpieczeństwo | 1.1 - 1.3 | Krytyczny | 1 godzina |
| 2. Persystencja | 2.1 - 2.3 | Wysoki | 2 godziny |
| 3. Walidacja | 3.1 - 3.6 | Wysoki | 3 godziny |
| 4. Logika | 4.1 - 4.5 | Średni | 3 godziny |
| 5. Wydajność | 5.1 - 5.3 | Średni | 2 godziny |
| 6. UX | 6.1 - 6.4 | Niski | 2 godziny |
| 7. Dokumenty | 7.1 - 7.2 | Niski | 1 godzina |
| 8. Spójność | 8.1 - 8.2 | Niski | 1 godzina |

**Łączny szacowany czas: ~15 godzin roboczych**

---

## Rekomendowana kolejność

1. **Natychmiast**: Zadania 1.1, 1.2 (bezpieczeństwo krytyczne)
2. **Dziś**: Zadania 2.1, 3.1, 4.3 (funkcjonalność podstawowa)
3. **Ten tydzień**: Pozostałe zadania Fazy 2-4
4. **Następny tydzień**: Fazy 5-8

