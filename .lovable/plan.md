
## Plan: Naprawa systemu receptur - automatyczny uzysk i walidacja

### Zidentyfikowane problemy

1. **Brak walidacji parowania** - w formularzu receptury można wpisać >100% parowania (np. 110%), co daje ujemny uzysk
2. **Błędne dane w istniejącej recepturze** - "Kebab clasic" ma `evaporation_percent: 110%` i `target_yield_percent: -12%`
3. **Uzysk teoretyczny wylicza się poprawnie z receptury** - kod już działa (linie 94-106 w RecipeFormDialog), ale terminal też musi to liczyć
4. **Terminal masowni przelicza uzysk poprawnie** - kod w liniach 305-318 robi to dobrze, ale z błędnymi danymi wejściowymi daje zły wynik

### Rozwiązanie

```text
┌───────────────────────────────────────────────────────────────┐
│ FORMULARZ RECEPTURY (RecipeFormDialog.tsx)                    │
├───────────────────────────────────────────────────────────────┤
│ • Walidacja: evaporation_percent musi być w zakresie 0-50%    │
│ • Blokada zapisania receptury z ujemnym uzyskiem              │
│ • Jasne komunikaty o błędach                                  │
└───────────────────────────────────────────────────────────────┘

┌───────────────────────────────────────────────────────────────┐
│ WYŚWIETLANIE (RecipesPage + Terminal)                         │
├───────────────────────────────────────────────────────────────┤
│ • Jeśli target_yield_percent ≤ 0 → wyświetlaj "⚠️ Błąd"       │
│ • Terminal: dodatkowe zabezpieczenie przed ujemnym uzyskiem   │
└───────────────────────────────────────────────────────────────┘

┌───────────────────────────────────────────────────────────────┐
│ NAPRAWA DANYCH                                                │
├───────────────────────────────────────────────────────────────┤
│ • Aktualizacja receptury "Kebab clasic":                      │
│   evaporation_percent: 3% (typowe dla masowania)              │
│   target_yield_percent: (przeliczone automatycznie)           │
└───────────────────────────────────────────────────────────────┘
```

---

### Szczegóły techniczne

#### 1. Walidacja w RecipeFormDialog.tsx

Dodanie walidacji przed zapisem:

| Pole | Walidacja | Komunikat |
|------|-----------|-----------|
| `evaporation_percent` | max 50% | "Parowanie nie może przekraczać 50%" |
| `realYield` | > 0% | "Uzysk musi być dodatni - zmniejsz parowanie lub dodaj składniki" |

Zmiana w komponencie:
- Walidacja pola parowania: `max="50"` (już jest) + sprawdzenie JS przed zapisem
- Sprawdzenie realYield > 0 przed wywołaniem `onSubmit`
- Toast z jasnym komunikatem błędu

#### 2. Wyświetlanie w tabeli RecipesPage.tsx

Obecny kod pokazuje tylko wartość z bazy. Zmienię na:
- Jeśli `target_yield_percent ≤ 0` → czerwony badge z komunikatem "Błąd"
- Jeśli poprawne → zielony kolor dla wartości

#### 3. Terminal masowni - zabezpieczenie

Dodatkowe zabezpieczenie w wyświetlaniu uzysku:
- `Math.max(0, real)` - nigdy nie pokazuj ujemnych wartości
- Wizualne ostrzeżenie gdy uzysk < 50%

#### 4. Naprawa istniejących danych

Aktualizacja receptury w bazie poprzez edycję w UI:
1. Użytkownik otworzy recepturę "Kebab clasic" do edycji
2. Zmieni parowanie z 110% na np. 3%
3. Zapisze - `target_yield_percent` przeliczy się automatycznie

---

### Pliki do modyfikacji

| Plik | Akcja | Zmiana |
|------|-------|--------|
| `src/components/recipes/RecipeFormDialog.tsx` | Edytuj | Walidacja: evaporation max 50%, realYield > 0 |
| `src/pages/settings/RecipesPage.tsx` | Edytuj | Wyświetlanie błędnych uzysków jako ⚠️ |
| `src/pages/production/TumblerTerminalPage.tsx` | Edytuj | Zabezpieczenie przed ujemnym uzyskiem |

---

### Logika walidacji

```text
handleSubmit():
  1. Sprawdź czy name jest wypełnione ✓ (już jest)
  2. NOWE: Sprawdź czy evaporationPercent ≤ 50
  3. NOWE: Sprawdź czy realYield > 0
  4. Jeśli błąd → toast.error() i return
  5. Zapisz recepturę
```

---

### Przykład prawidłowej receptury

```text
Receptura: Kebab Classic
├── Surowiec bazowy: Mięso kurczaka (100%)
├── Składniki:
│   ├── Przyprawa kebab: 0.020 kg/kg (+2%)
│   ├── Sól:             0.008 kg/kg (+0.8%)
│   └── Marynata:        0.050 kg/kg (+5%)
├── Uzysk teoretyczny:   107.8% (100 + 2 + 0.8 + 5)
├── Parowanie:           3%
└── Uzysk realny:        104.57% (107.8 × 0.97)
```

---

### Efekt końcowy

Po wdrożeniu:
1. Nie będzie można wprowadzić parowania > 50%
2. Nie będzie można zapisać receptury z ujemnym uzyskiem
3. Terminal poprawnie wyświetli uzysk
4. Istniejące błędne receptury będą wizualnie oznaczone jako wymagające korekty
