
## Plan: Dodanie edycji użytkownika i zmiany hasła

### Zakres zmian

Rozszerzę panel edycji użytkownika o:
1. **Wyświetlanie email** (tylko do odczytu - informacyjnie)
2. **Zmiana hasła** przez administratora
3. **Lepszy UX** z zakładkami w dialogu edycji

---

### Architektura rozwiązania

Zmiana hasła użytkownika przez admina wymaga **backend function**, ponieważ:
- Supabase Auth Admin API (`updateUserById`) wymaga `service_role` key
- Ten klucz NIE może być ujawniony w kodzie frontendowym

```text
┌─────────────────┐     ┌──────────────────────┐     ┌─────────────────┐
│   Admin Panel   │────►│  Edge Function       │────►│  Supabase Auth  │
│   (Frontend)    │     │  admin-update-user   │     │  Admin API      │
└─────────────────┘     └──────────────────────┘     └─────────────────┘
        │                        │
        │  { userId, password }  │  service_role key
        └────────────────────────┘
```

---

### Szczegóły techniczne

#### 1. Nowa Edge Function: `admin-update-user`

| Plik | Opis |
|------|------|
| `supabase/functions/admin-update-user/index.ts` | Endpoint do aktualizacji hasła użytkownika |

Funkcja będzie:
- Sprawdzać autoryzację (tylko global_admin może zmieniać hasła)
- Używać Supabase Admin API do aktualizacji hasła
- Zwracać status operacji

```typescript
// Szkic logiki
const supabaseAdmin = createClient(url, SERVICE_ROLE_KEY);
await supabaseAdmin.auth.admin.updateUserById(userId, { password });
```

#### 2. Aktualizacja hooka `useUsers.ts`

Nowy hook: `useUpdateUserPassword`

```typescript
export function useUpdateUserPassword() {
  return useMutation({
    mutationFn: async ({ userId, password }) => {
      const response = await supabase.functions.invoke('admin-update-user', {
        body: { userId, password }
      });
      if (response.error) throw response.error;
      return response.data;
    },
    // ...
  });
}
```

#### 3. Rozszerzony dialog edycji w `UsersPage.tsx`

Nowe elementy UI:
- Sekcja z emailem użytkownika (readonly)
- Pole nowego hasła z walidacją (min 6 znaków)
- Przycisk "Zmień hasło" (oddzielna akcja od zapisywania nazwy)

```text
┌─────────────────────────────────────────┐
│  Edycja użytkownika                     │
├─────────────────────────────────────────┤
│  Email: jan.kowalski@firma.pl (readonly)│
│                                         │
│  Imię i nazwisko: [Jan Kowalski     ]   │
│                                         │
│  ─────── Zmiana hasła ───────           │
│  Nowe hasło:       [••••••••        ]   │
│  Potwierdź hasło:  [••••••••        ]   │
│                                         │
│  [Anuluj]              [Zapisz zmiany]  │
└─────────────────────────────────────────┘
```

---

### Pliki do utworzenia/modyfikacji

| Plik | Akcja | Opis |
|------|-------|------|
| `supabase/functions/admin-update-user/index.ts` | Utwórz | Edge function do zmiany hasła |
| `src/hooks/useUsers.ts` | Edytuj | Dodaj hook `useUpdateUserPassword` |
| `src/pages/settings/UsersPage.tsx` | Edytuj | Rozszerz dialog edycji o hasło i email |

---

### Bezpieczeństwo

1. **Weryfikacja uprawnień** - Edge function sprawdzi czy wywołujący ma rolę `global_admin`
2. **Walidacja hasła** - Minimum 6 znaków, maksymalnie 72 (limit bcrypt)
3. **Audit log** - Logowanie operacji zmiany hasła w konsoli
4. **Service Role Key** - Przechowywany jako secret, niedostępny z frontendu

---

### Przepływ użytkownika

1. Admin klika ikonę edycji przy użytkowniku
2. Otwiera się dialog z danymi użytkownika
3. Admin może:
   - Zmienić imię i nazwisko → Zapisz
   - Wpisać nowe hasło → Zmień hasło
4. Po zmianie hasła - toast z potwierdzeniem
5. Użytkownik może się zalogować nowym hasłem
