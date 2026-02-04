
## Plan: Naprawa wyświetlania sumy wsadu w Terminalu Masowni

### Zidentyfikowany problem

Terminal masowni wyświetla **0.0 kg** mimo że zlecenie ma zapisany wsad w bazie danych o wadze **10 000 kg**.

```text
Problem:
┌──────────────────────────────────────────────────────────────┐
│  totalInputWeight = inputItems.reduce(...)                   │
│  ↑                                                           │
│  Liczy TYLKO z lokalnego stanu (nowo dodane pozycje)         │
│                                                              │
│  existingInputs = dane z bazy danych                         │
│  ↑                                                           │
│  NIE JEST uwzględniane w kalkulacji sumy!                    │
└──────────────────────────────────────────────────────────────┘
```

### Rozwiązanie

Zmodyfikować obliczanie `totalInputWeight` aby uwzględniało:
- `inputItems` - nowo dodane pozycje (lokalny stan)
- `existingInputs` - wcześniej zapisane pozycje (z bazy danych)

---

### Szczegóły techniczne

#### Zmiana w TumblerTerminalPage.tsx

**Obecny kod (linia 131-135):**
```typescript
const totalInputWeight = useMemo(() => 
  inputItems.reduce((sum, item) => sum + item.weight, 0),
  [inputItems]
);
```

**Nowy kod:**
```typescript
const totalInputWeight = useMemo(() => {
  const localWeight = inputItems.reduce((sum, item) => sum + item.weight, 0);
  const existingWeight = existingInputs?.reduce((sum, inp) => sum + Number(inp.weight), 0) || 0;
  return localWeight + existingWeight;
}, [inputItems, existingInputs]);
```

#### Dodatkowa zmiana - wyświetlanie liczby pozycji

**Obecny kod (linia 610):**
```typescript
<p>{inputItems.length || existingInputs?.length || 0} pozycji</p>
```

**Nowy kod:**
```typescript
<p>{inputItems.length + (existingInputs?.length || 0)} pozycji</p>
```

---

### Przepływ danych po naprawie

```text
┌─────────────────────────────────────────────────────────────────┐
│                      totalInputWeight                           │
│                            =                                    │
│   inputItems.weight    +    existingInputs.weight               │
│   (nowo dodane)             (zapisane w bazie)                  │
│                                                                 │
│   Przykład:                                                     │
│   0 kg (brak nowych)   +    10 000 kg (z bazy)   =   10 000 kg  │
└─────────────────────────────────────────────────────────────────┘
```

---

### Pliki do modyfikacji

| Plik | Zmiana |
|------|--------|
| `src/pages/production/TumblerTerminalPage.tsx` | Zmiana kalkulacji `totalInputWeight` i liczby pozycji |

---

### Efekt końcowy

Po wdrożeniu terminal będzie poprawnie wyświetlać:
- Sumę wag z zapisanych wsadów (10 000 kg w tym przypadku)
- Łączną liczbę pozycji (1 pozycja)
- Nowe wsady będą dodawane do istniejącej sumy
