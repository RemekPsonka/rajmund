# Plan: Manual smoke test Sprintu 2 (pełna automatyzacja)

## Co robimy

Wykonuję smoke test 6 punktów S2 end-to-end w preview Lovable. Każdy krok robię w browser, każdą asercję weryfikuję zapytaniem do bazy. Na koniec — raport pass/fail per punkt + decyzja S3 go/no-go.

## Kolejność

### 0. Seed (migracja, ~10 sek)
- Wywołam `SELECT public.simulate_full_production_day();` jako migrację
- Zwróci ID firmy KTF, partii surowca/mięsa/masy/kebabu, zlecenia
- Zapamiętam zwrócone IDs do późniejszej weryfikacji

UWAGA: seed tworzy zlecenia jako **Closed**. Do testu pkt 1, 2-3, 4 muszę dodatkowo wstawić **3 świeże otwarte zlecenia** (Processing + Assembly + Freezing) używając tych samych produktów i partii — w tej samej migracji, jako INSERT po SELECT seed.

### 1. Tumbler — ZAKOŃCZ PARTIĘ → LOT (~5 akcji)
- `navigate_to_sandbox /production/tumbler`
- Wybierz otwarte zlecenie Processing
- Wpisz kod partii mięsa w pole skanowania, Enter
- Step processing → start, step output → wpisz wagę 2850 (95% z 3000)
- Klik ZAKOŃCZ PARTIĘ → potwierdź
- **Weryfikacja w bazie:** nowa partia z `source_event_type='TUMBLING'`, wpis w `t_lot_lineage` z `event_type='TUMBLING'`, zlecenie `Closed`

### 2. KebabAssembly — gate selektora produktu (~4 akcje)
- `/production/assembly`
- Sprawdź czy widać selektor produktu jako pierwszy ekran
- Wybierz produkt → asercja: pojawia się badge + przycisk „Zmień produkt"
- Klik „Zmień produkt" → asercja: powrót do gate
- **Pomijam Asercję B** (zmiana industry_category dla wszystkich produktów + restore) — wymaga 2 dodatkowych migracji i ryzyko śmieci. Zweryfikuję statycznie: grep w `KebabAssemblyTerminalPage.tsx` pokaże logikę gate'a.

### 3. KebabAssembly — preset wagi z unit_target_weight_kg (~4 akcje)
- Migracja: `UPDATE t_products SET unit_target_weight_kg=5 WHERE name='Kebab Drobiowy 15kg'` + nowy produkt FinishedGood z `unit_target_weight_kg=10`
- W terminalu: wybierz produkt 1 → screenshot pola variant
- „Zmień produkt" → wybierz produkt 2 → screenshot pola variant
- Asercja: preset 5 → 10

### 4. Mrożenie CCP (kluczowy punkt, ~10 akcji) — DWIE ŚCIEŻKI
**Ścieżka A (passed, -20°C):**
- `/production/freezing` → wybierz facility/komorę
- Wpisz kod partii kebabu w skaner
- Asercja UI: partia na liście aktywnych
- F5 (`navigate_to_sandbox` ponownie) → asercja: partia nadal jest (persystencja)
- Wpisz -20 w temp → zapisz → Zakończ
- **Weryfikacja w bazie:** `t_production_logs.ccp_passed=true`, `freezing_completed_at` not null, nowa partia `source_event_type='FREEZING'`, lineage z `event_type='FREEZING'`

**Ścieżka B (failed, -10°C):**
- Wymaga drugiego otwartego zlecenia Freezing + drugiej partii (oba dorzucę w seed migration)
- Skanuj → wpisz -10 → Zakończ
- **Weryfikacja:** `ccp_passed=false`, zlecenie nadal `Open`, `notes` zawiera `[QC ...] ... CCP -18°C`, brak nowej partii

### 5. StateMachineBadge w 4 terminalach (~4 akcje + screenshoty)
- Po kolei: `/production/terminal`, `/production/tumbler`, `/production/assembly`, `/production/freezing`
- Screenshot każdego — sprawdzę obecność badge'a + (Tumbler/Freezing) timera mm:ss
- Test timera: w Tumblerze sprawdzę aktywny pill — jeśli zawiera tabular-nums z dwukropkiem, pass

### 6. Unsaved changes warning (~3 akcje)
- W Tumblerze: zacznij flow (zlecenie + skan partii) → isDirty=true
- Klik „Magazyn" w sidebarze
- Browser pokazuje natywny `confirm()` → mogę zaobserwować dialog przez `observe`
- Akceptuj/odrzuć i sprawdź zachowanie

UWAGA techniczna: `window.confirm()` jest natywny, browser tools czasem auto-akceptują. Jeśli się nie uda — zaraportuję jako „browser-blocked, weryfikacja kodem" (już potwierdzone w sprint2-smoke.test.ts).

### 7. Cleanup
- Migracja: `DELETE` świeżych otwartych zleceń + ich logów (zostawiam seed KTF jako fixture pod S3)
- `unit_target_weight_kg` zostawiam (wg punktu 7 user message)

## Output dla użytkownika

Tabela 6 punktów × {status, dowody (screenshot/query), uwagi}, zakończona decyzją:
- 6/6 ✅ → **S3 startuje**
- pkt 4 ❌ → **STOP**, fix S2.5
- pkt 1-3 ❌ → idź dalej, P2 backlog
- pkt 5-6 ❌ → kosmetyka, S3 ok

## Ryzyka

- **Skanowanie partii:** wpisuję kod ręcznie w input + Enter; jeśli komponent ma niestandardowy handler, próbuję 2× i raportuję blocker
- **Natywny confirm w pkt 6:** jak wyżej, mam fallback statyczny
- **Czas:** ~25-35 wywołań browser--act + ~10 read_query + 2-3 migracje. Realnie 8-12 minut wykonania.

## Co NIE robię

- Asercja B w pkt 2 (zmiana industry_category dla wszystkich produktów) — za duże ryzyko śmieci, weryfikuję statycznie
- Tworzenie zleceń z UI — robię to przez seed migration (szybciej, deterministycznie)
- Reset bazy po teście — usuwam tylko świeże zlecenia testowe, fixture KTF zostaje
