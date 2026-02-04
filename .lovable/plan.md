

## Plan: Naprawa Terminalu Składania Kebaba

### Zidentyfikowane problemy

1. **Błędna logika filtrowania** - Terminal szuka zleceń typu "Assembly", ale takie nie istnieją w systemie
2. **Produkt "Kebab Czerwony 15kg"** ma `industry_category: null` - nie jest klasyfikowany jako SemiFinished
3. **Brak automatycznego przepływu** - Terminal powinien automatycznie pobierać partie wynikowe z zakończonych zleceń masowania

### Obecny stan vs. Oczekiwany przepływ

```text
OBECNY (błędny):
┌──────────────────────────────────────────────────────────────────┐
│ Terminal Składania                                               │
│ ├── Szuka: orders.type === "Assembly"     ❌ (brak takich)       │
│ └── Szuka: batches.industry_category === "SemiFinished" ❌       │
│            (Kebab Czerwony ma NULL)                              │
└──────────────────────────────────────────────────────────────────┘

OCZEKIWANY (prawidłowy):
┌──────────────────────────────────────────────────────────────────┐
│ 1. Masownica (Processing) kończy pracę                           │
│    └── Zapisuje output_batch (np. Kebab Czerwony)                │
│                                                                  │
│ 2. Terminal Składania automatycznie pobiera:                     │
│    ├── Zamknięte zlecenia Processing z ostatnich dni             │
│    └── Ich partie wynikowe (output_batch)                        │
│                                                                  │
│ 3. Operator wybiera partię do składania                          │
│    └── System tworzy zlecenie Assembly automatycznie             │
└──────────────────────────────────────────────────────────────────┘
```

### Rozwiązanie

Zmodyfikuję Terminal Składania aby:

1. **Pobierał zakończone zlecenia masowania** zamiast szukać zleceń Assembly
2. **Pokazywał partie wynikowe z tych zleceń** jako dostępne do składania
3. **Automatycznie tworzył zlecenie Assembly** przy starcie składania
4. **Nie wymagał kategorii SemiFinished** - używał relacji `output_batch_id` z logów

---

### Szczegóły techniczne

#### 1. Zmiana źródła danych dla zleceń

**Było:**
```typescript
const { data: orders } = useProductionOrders("Open");
const assemblyOrders = orders?.filter(o => o.type === "Assembly") || [];
```

**Będzie:**
```typescript
const { data: closedOrders } = useProductionOrders("Closed");
const processingOutputs = closedOrders?.filter(o => o.type === "Processing") || [];
```

#### 2. Nowy hook do pobierania partii wynikowych z masowania

```typescript
// Pobierz partie wynikowe z zakończonych zleceń Processing
export function useProcessingOutputBatches() {
  return useQuery({
    queryKey: ["processing-output-batches"],
    queryFn: async () => {
      // Pobierz logi z output_batch_id dla zleceń Processing
      const { data, error } = await supabase
        .from("t_production_logs")
        .select(`
          id,
          output_batch_id,
          production_order:t_production_orders!inner(
            id, order_number, type, status
          ),
          output_batch:t_batches!t_production_logs_output_batch_id_fkey(
            id, internal_batch_number, current_quantity, status,
            product:t_products(id, name)
          )
        `)
        .not("output_batch_id", "is", null)
        .eq("production_order.type", "Processing")
        .eq("production_order.status", "Closed");
      
      if (error) throw error;
      return data;
    }
  });
}
```

#### 3. Przeprojektowany interfejs wyboru

Zamiast dropdown ze zleceniami, terminal pokaże:

```text
┌─────────────────────────────────────────────────────────────────┐
│ 🔴 DOSTĘPNE PARTIE DO SKŁADANIA                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ 📦 20260123/KEB-RED/001                                    │ │
│  │    Kebab Czerwony 15kg                                     │ │
│  │    Dostępne: 12.36 kg | Ze zlecenia: PRZ/2026/01/23/01     │ │
│  │    [     WYBIERZ DO SKŁADANIA     ]                        │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ 📦 20260204/KEB-RED/002                                    │ │
│  │    Kebab Czerwony 15kg                                     │ │
│  │    Dostępne: 54.26 kg | Ze zlecenia: PRZ/2026/02/04/14     │ │
│  │    [     WYBIERZ DO SKŁADANIA     ]                        │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

#### 4. Automatyczne tworzenie zlecenia Assembly

Przy wyborze partii system automatycznie:
1. Tworzy nowe zlecenie typu "Assembly" 
2. Dodaje wybraną partię jako input
3. Przechodzi do ważenia słupków

---

### Pliki do modyfikacji

| Plik | Akcja | Zmiana |
|------|-------|--------|
| `src/hooks/useProductionOrders.ts` | Edytuj | Dodaj hook `useProcessingOutputBatches` |
| `src/pages/production/KebabAssemblyTerminalPage.tsx` | Edytuj | Przeprojektuj logikę wyboru źródła |

---

### Przepływ użytkownika po zmianach

1. **Operator otwiera Terminal Składania**
2. **System pokazuje dostępne partie** z zakończonych zleceń masowania
3. **Operator wybiera partię** → System tworzy zlecenie Assembly
4. **Operator loguje się kodem QR** (bez zmian)
5. **Operator waży słupki** i dodaje do listy (bez zmian)
6. **Zatwierdzenie** zamyka proces (bez zmian)

---

### Alternatywne podejście (prostsze)

Jeśli chcesz zachować obecną strukturę, wystarczy:

1. **Naprawić produkt "Kebab Czerwony"** - ustawić `industry_category = 'SemiFinished'`
2. **Usunąć wymóg zlecenia Assembly** - pozwolić na składanie bez zlecenia
3. **Automatycznie tworzyć zlecenie** przy pierwszym skanowaniu partii

To prostsze podejście wymaga mniej zmian w kodzie.

---

### Rekomendacja

Proponuję **podejście alternatywne (prostsze)** jako pierwszy krok:

1. Naprawić kategorię produktu Kebab Czerwony → `SemiFinished`
2. Zmienić logikę terminala aby:
   - Pozwalał na skanowanie partii bez wcześniejszego wyboru zlecenia
   - Automatycznie tworzył zlecenie Assembly po zeskanowaniu pierwszej partii
3. Partia źródłowa będzie filtrowana po:
   - `status = 'Released'`
   - `current_quantity > 0`
   - Produkt z kategorią `SemiFinished` LUB pochodzący z output_batch zleceń Processing

