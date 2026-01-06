# Teacher Schedule Management - Plan Testowania

## 📋 Checklist testów

### Przygotowanie
- [ ] Backend działa na `http://localhost:3000`
- [ ] Frontend działa na `http://localhost:5173`
- [ ] Masz konto lektora w systemie
- [ ] Lektor ma przypisane lekcje w bazie danych

---

## 🔧 Backend API Tests

### 1. GET /api/teachers/me/schedule
**Cel:** Sprawdź czy endpoint zwraca grafik zalogowanego lektora

```bash
# Zaloguj się jako lektor i skopiuj token
curl -X GET "http://localhost:3000/api/teachers/me/schedule?startDate=2026-01-01T00:00:00.000Z&endDate=2026-01-31T23:59:59.000Z" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Oczekiwany wynik:**
- Status: 200
- Body: Array z lekcjami lektora w podanym zakresie dat

---

### 2. GET /api/teachers/:id/availability/exceptions
**Cel:** Pobierz listę wyjątków dostępności

```bash
curl -X GET "http://localhost:3000/api/teachers/{TEACHER_ID}/availability/exceptions" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Oczekiwany wynik:**
- Status: 200
- Body: Array wyjątków (może być pusty)

---

### 3. POST /api/teachers/:id/availability/exceptions
**Cel:** Dodaj nowy wyjątek (urlop)

```bash
curl -X POST "http://localhost:3000/api/teachers/{TEACHER_ID}/availability/exceptions" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "startDate": "2026-02-01T00:00:00.000Z",
    "endDate": "2026-02-07T23:59:59.000Z",
    "reason": "Urlop zimowy"
  }'
```

**Oczekiwany wynik:**
- Status: 200
- Body: Utworzony wyjątek z ID

---

### 4. DELETE /api/teachers/:id/availability/exceptions/:exceptionId
**Cel:** Usuń wyjątek

```bash
curl -X DELETE "http://localhost:3000/api/teachers/{TEACHER_ID}/availability/exceptions/{EXCEPTION_ID}" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Oczekiwany wynik:**
- Status: 200
- Body: Potwierdzenie usunięcia

---

### 5. GET /api/teachers/:id/preferences
**Cel:** Pobierz preferencje lektora

```bash
curl -X GET "http://localhost:3000/api/teachers/{TEACHER_ID}/preferences" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Oczekiwany wynik:**
- Status: 200
- Body: Obiekt z preferencjami (timezone, prepTimeMinutes, etc.)

---

### 6. PUT /api/teachers/:id/preferences
**Cel:** Zaktualizuj preferencje

```bash
curl -X PUT "http://localhost:3000/api/teachers/{TEACHER_ID}/preferences" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "timezone": "Europe/Warsaw",
    "prepTimeMinutes": 15,
    "maxLessonsPerDay": 6,
    "minBreakBetweenMinutes": 10
  }'
```

**Oczekiwany wynik:**
- Status: 200
- Body: Zaktualizowane preferencje

---

## 🎨 Frontend UI Tests

### Test 1: Navigation
- [ ] Zaloguj się jako lektor
- [ ] Sprawdź menu boczne - powinny być linki:
  - [ ] "Dashboard"
  - [ ] "Mój grafik"
  - [ ] "Dostępność"
  - [ ] "Moje lekcje"
  - [ ] "Uczniowie"

### Test 2: Teacher Dashboard
- [ ] Przejdź do Dashboard
- [ ] Sprawdź sekcję "Podsumowanie tygodnia":
  - [ ] Wyświetla liczbę lekcji w tym tygodniu
  - [ ] Wyświetla sumę godzin
  - [ ] Wyświetla liczbę unikalnych uczniów
  - [ ] Wyświetla liczbę zrealizowanych lekcji
- [ ] Kliknij "Zobacz pełny grafik" → powinno przenieść do `/teacher/schedule`
- [ ] Sprawdź kartę "Zarządzaj dostępnością" → kliknięcie przenosi do `/teacher/availability`
- [ ] Sprawdź kartę "Dzisiaj" → pokazuje liczbę lekcji na dziś

### Test 3: Teacher Schedule Page
- [ ] Przejdź do "Mój grafik"
- [ ] Sprawdź czy kalendarz się wyświetla
- [ ] Sprawdź statystyki na górze:
  - [ ] Wszystkie lekcje
  - [ ] Godziny
  - [ ] Uczniowie
  - [ ] Zrealizowane
- [ ] Kliknij w lekcję → sprawdź czy otwiera się modal z szczegółami
- [ ] Przełącz widok Week/Month
- [ ] Sprawdź legendę statusów na dole

### Test 4: Weekly Availability Management
- [ ] Przejdź do "Dostępność"
- [ ] Sekcja "Tygodniowa dostępność":
  - [ ] Kliknij "Edytuj dostępność"
  - [ ] Dla Poniedziałku kliknij "+ Dodaj przedział"
  - [ ] Ustaw godziny 09:00 - 12:00
  - [ ] Dodaj drugi przedział 14:00 - 17:00
  - [ ] Kliknij "Zapisz"
  - [ ] Sprawdź toast: "Dostępność została zaktualizowana"
  - [ ] Odśwież stronę → sprawdź czy przedziały zostały zapisane

### Test 5: Availability Exceptions
- [ ] Przewiń do sekcji "Wyjątki dostępności"
- [ ] Kliknij "+ Dodaj wyjątek"
- [ ] Wypełnij formularz:
  - [ ] Data rozpoczęcia: wybierz przyszłą datę
  - [ ] Data zakończenia: tydzień później
  - [ ] Powód: "Urlop testowy"
- [ ] Kliknij "Dodaj"
- [ ] Sprawdź toast: "Wyjątek został dodany"
- [ ] Sprawdź czy wyjątek pojawił się na liście
- [ ] Kliknij ikonę kosza przy wyjątku
- [ ] Potwierdź usunięcie w dialogu
- [ ] Sprawdź toast: "Wyjątek został usunięty"

### Test 6: Schedule Preferences
- [ ] Przewiń do sekcji "Preferencje grafiku"
- [ ] Kliknij "Pokaż"
- [ ] Zmień wartości:
  - [ ] Strefa czasowa: Europe/Warsaw
  - [ ] Czas przygotowania: 15 minut
  - [ ] Maks. lekcji dziennie: 6
  - [ ] Min. przerwa: 10 minut
- [ ] Kliknij "Zapisz preferencje"
- [ ] Sprawdź toast: "Preferencje zostały zaktualizowane"
- [ ] Kliknij "Ukryj", potem ponownie "Pokaż"
- [ ] Sprawdź czy wartości się zachowały

---

## 🔄 Integration Tests

### Test 7: Konflikt z wyjątkiem
**Scenariusz:** Sprawdź czy system blokuje tworzenie lekcji podczas urlopu

1. [ ] Dodaj wyjątek dostępności na konkretny dzień
2. [ ] Jako admin spróbuj zaplanować lekcję dla tego lektora w tym dniu
3. [ ] **Oczekiwany wynik:** System powinien pokazać ostrzeżenie o konflikcie

### Test 8: Preferencje a planowanie
**Scenariusz:** Sprawdź czy preferencje są respektowane

1. [ ] Ustaw "Max lekcji dziennie: 3"
2. [ ] Ustaw "Min. przerwa: 15 minut"
3. [ ] Spróbuj zaplanować 4 lekcje w jednym dniu
4. [ ] **Oczekiwany wynik:** System powinien ostrzec o przekroczeniu limitu

### Test 9: React Query Cache
**Scenariusz:** Sprawdź czy dane są cached

1. [ ] Otwórz "Mój grafik"
2. [ ] Otwórz DevTools → Network
3. [ ] Przełącz między Week/Month
4. [ ] **Oczekiwany wynik:** Nie powinno być dodatkowych requestów (dane z cache)

---

## 🐛 Edge Cases

### Test 10: Pusta dostępność
- [ ] Usuń wszystkie przedziały czasowe
- [ ] Zapisz
- [ ] Sprawdź czy każdy dzień pokazuje "Brak dostępności"

### Test 11: Nakładające się przedziały
- [ ] Dodaj przedział 09:00-12:00
- [ ] Spróbuj dodać 11:00-14:00
- [ ] **Oczekiwany wynik:** Powinno pozwolić (lub ostrzec, zależnie od biznesowej logiki)

### Test 12: Nieprawidłowe daty w wyjątkach
- [ ] Spróbuj dodać wyjątek gdzie `endDate < startDate`
- [ ] **Oczekiwany wynik:** Walidacja powinna to zablokować

### Test 13: Brak uprawnień
- [ ] Zaloguj się jako student
- [ ] Spróbuj otworzyć `/teacher/schedule`
- [ ] **Oczekiwany wynik:** Brak dostępu lub przekierowanie

---

## 📊 Performance Tests

### Test 14: Duża liczba lekcji
1. [ ] Dodaj 50+ lekcji w bazie dla lektora
2. [ ] Otwórz "Mój grafik"
3. [ ] Sprawdź czy kalendarz ładuje się < 2 sekundy

### Test 15: Wiele wyjątków
1. [ ] Dodaj 20+ wyjątków dostępności
2. [ ] Otwórz stronę "Dostępność"
3. [ ] Sprawdź czy lista się wyświetla poprawnie

---

## ✅ Success Criteria

Wszystkie testy przeszły pomyślnie gdy:
- [ ] Backend API zwraca poprawne odpowiedzi
- [ ] Frontend wyświetla dane bez błędów
- [ ] Toast notifications działają
- [ ] Confirm dialogs działają
- [ ] React Query invalidation działa (dane się odświeżają)
- [ ] Brak błędów w konsoli przeglądarki
- [ ] Brak błędów w konsoli backendu
- [ ] Nawigacja między stronami działa płynnie
- [ ] Dane się zachowują po odświeżeniu strony

---

## 🛠️ Debugging Tips

### Problem: "401 Unauthorized"
**Rozwiązanie:** Sprawdź czy token jest ważny, przeloguj się

### Problem: "404 Not Found" na endpoincie
**Rozwiązanie:** Sprawdź czy backend działa i czy route jest poprawnie zdefiniowany

### Problem: Dane się nie odświeżają
**Rozwiązanie:** Sprawdź React Query DevTools, zrób manual invalidateQueries

### Problem: TypeScript errors
**Rozwiązanie:** Sprawdź czy wszystkie interfejsy są poprawnie zaimportowane

### Problem: "Teacher not found"
**Rozwiązanie:** Sprawdź czy zalogowany user ma powiązany rekord Teacher w bazie

---

## 📝 Test Report Template

Po zakończeniu testów wypełnij:

**Data testów:** _______________
**Tester:** _______________
**Środowisko:** Dev / Staging / Prod
**Wersja:** _______________

**Wyniki:**
- Testy backend API: ____ / 6 passed
- Testy frontend UI: ____ / 6 passed
- Testy integracyjne: ____ / 3 passed
- Edge cases: ____ / 4 passed
- Performance: ____ / 2 passed

**Znalezione bugi:**
1. _______________
2. _______________

**Uwagi:**
_______________
