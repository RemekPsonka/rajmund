
## Plan: Rozbudowa Terminala Masowni o Start Procesu i Wybór Receptury

### Zidentyfikowane problemy

1. **Brak etapu "Start procesu"** - terminal przeskakuje z dodawania wsadu bezpośrednio do wyjścia
2. **Brak możliwości przypisania receptury** - kolumna `recipe_id` istnieje w bazie, ale UI jej nie obsługuje  
3. **Brak receptur w systemie** - tabela `t_recipes` jest pusta (trzeba najpierw utworzyć receptury w ustawieniach)

### Architektura rozwiązania

Rozszerzę przepływ terminala z 2 do 3 kroków:

```text
┌────────────┐     ┌─────────────────┐     ┌─────────────┐
│ 1. WSAD    │────►│ 2. START        │────►│ 3. WYJŚCIE  │
│ (Input)    │     │ (Receptura)     │     │ (Output)    │
└────────────┘     └─────────────────┘     └─────────────┘
     │                    │                      │
     ▼                    ▼                      ▼
  Skanuj partia      Wybierz recepturę      Waż wyroby
  wsadowe            Ustaw parametry        gotowe
                     START PROCESU
```

---

### Szczegóły techniczne

#### 1. Aktualizacja interfejsu `ProductionOrder`

Dodanie pola `recipe_id` i `machine_id` do interfejsu TypeScript:

```typescript
// src/hooks/useProductionOrders.ts
export interface ProductionOrder {
  // ... istniejące pola
  recipe_id: string | null;
  machine_id: string | null;
}
```

#### 2. Nowy hook do aktualizacji zlecenia

```typescript
// src/hooks/useProductionOrders.ts
export function useUpdateProductionOrder() {
  return useMutation({
    mutationFn: async ({ id, ...data }) => {
      const { error } = await supabase
        .from("t_production_orders")
        .update(data)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["production-orders"] });
    },
  });
}
```

#### 3. Rozszerzenie TumblerTerminalPage.tsx

| Element | Zmiana |
|---------|--------|
| **Step state** | `"input" \| "processing" \| "output"` (dodany środkowy krok) |
| **Receptura** | Dropdown z listą receptur dla wybranej firmy |
| **Start procesu** | Przycisk zapisujący `recipe_id` i `machine_id` do zlecenia |
| **Wskaźnik kroków** | 3 kroki zamiast 2 |

#### 4. Nowy komponent: Panel startu procesu

Nowy etap w terminalu:

```text
┌─────────────────────────────────────────────┐
│ 2. START PROCESU                            │
├─────────────────────────────────────────────┤
│                                             │
│  Receptura: [▼ Wybierz recepturę        ]   │
│                                             │
│  ┌─────────────────────────────────────┐    │
│  │ Składniki receptury:                │    │
│  │ • Mięso kurczaka 60%  - 0.60 kg/kg  │    │
│  │ • Przyprawa kebab     - 0.02 kg/kg  │    │
│  │ • Sól                 - 0.01 kg/kg  │    │
│  └─────────────────────────────────────┘    │
│                                             │
│  Oczekiwany uzysk: 85%                      │
│  Parowanie: 3%                              │
│                                             │
│  [        🟢 START PROCESU        ]         │
│                                             │
└─────────────────────────────────────────────┘
```

---

### Pliki do modyfikacji

| Plik | Akcja | Opis |
|------|-------|------|
| `src/hooks/useProductionOrders.ts` | Edytuj | Dodaj `useUpdateProductionOrder`, rozszerz interfejs |
| `src/pages/production/TumblerTerminalPage.tsx` | Edytuj | Dodaj krok "Start procesu" z wyborem receptury |

---

### Przepływ użytkownika (po zmianie)

1. **Wybór zlecenia i maszyny** (bez zmian)
2. **Krok 1 - Wsad**: Skanowanie partii wsadowych (bez zmian)
3. **Krok 2 - Start procesu** (NOWY):
   - Wybór receptury z listy
   - Podgląd składników i parametrów
   - Przycisk "START PROCESU" zapisuje `recipe_id` i `machine_id` do zlecenia
4. **Krok 3 - Wyjście**: Ważenie wyrobów gotowych (bez zmian)

---

### Uwaga: Wymagane receptury

Aby krok "Start procesu" działał, system musi mieć utworzone receptury. Sprawdzenie pokazało, że **tabela t_recipes jest obecnie pusta**. 

Po wdrożeniu tej zmiany, użytkownik będzie musiał:
1. Przejść do Ustawienia → Receptury
2. Utworzyć recepturę dla masy kebabowej
3. Wrócić do Terminala Masowni i wybrać utworzoną recepturę

---

### Zależności

- Import hooka `useRecipes` z `@/hooks/useRecipes`
- Import hooka `useRecipeIngredients` do wyświetlenia składników
- Nowy hook `useUpdateProductionOrder` do zapisania `recipe_id`
