# Lingo Desk — Dokumentacja Funkcjonalna

> **Lingo Desk** to kompleksowy system CRM dla szkół językowych. Umożliwia zarządzanie całym cyklem pracy szkoły: od rejestracji uczniów i nauczycieli, przez planowanie lekcji i kursów, po rozliczenia finansowe i raportowanie.

---

## Rdzeń aplikacji — jaki problem rozwiązuje?

Szkoły językowe operują na skrzyżowaniu edukacji i usług: mają uczniów, nauczycieli, harmonogramy, opłaty, poziomy zaawansowania i komunikację wielokanałową. Zarządzanie tym wszystkim w arkuszach kalkulacyjnych i komunikatorach jest nieefektywne i podatne na błędy.

Lingo Desk centralizuje te procesy w jednej aplikacji webowej:

- **Dla administracji i managementu** — pełna kontrola nad finansami, kadrą i harmonogramami.
- **Dla nauczycieli** — wgląd we własny plan zajęć, materiały i listę uczniów.
- **Dla uczniów** — dostęp do harmonogramu, saldo budżetu i historia płatności.
- **Dla rodziców** — podgląd aktywności i płatności dziecka.

---

## Spis modułów

1. [Autoryzacja i Zarządzanie Sesjami](#1-autoryzacja-i-zarządzanie-sesjami)
2. [Zarządzanie Użytkownikami (Zespół)](#2-zarządzanie-użytkownikami-zespół)
3. [Zarządzanie Organizacją i Ustawieniami](#3-zarządzanie-organizacją-i-ustawieniami)
4. [Zarządzanie Uczniami](#4-zarządzanie-uczniami)
5. [Zarządzanie Nauczycielami](#5-zarządzanie-nauczycielami)
6. [Kursy i Grupy](#6-kursy-i-grupy)
7. [Lekcje i Harmonogram](#7-lekcje-i-harmonogram)
8. [Frekwencja (Attendance)](#8-frekwencja-attendance)
9. [Zastępstwa (Substitutions)](#9-zastępstwa-substitutions)
10. [Sale i Lokalizacje (Classrooms)](#10-sale-i-lokalizacje-classrooms)
11. [Płatności](#11-płatności)
12. [Saldo i Rozliczenia Uczniów](#12-saldo-i-rozliczenia-uczniów)
13. [Wypłaty Nauczycieli (Payouts)](#13-wypłaty-nauczycieli-payouts)
14. [Dłużnicy (Debtors)](#14-dłużnicy-debtors)
15. [Alerty](#15-alerty)
16. [Powiadomienia](#16-powiadomienia)
17. [Mailing (Komunikacja Masowa)](#17-mailing-komunikacja-masowa)
18. [Materiały Dydaktyczne](#18-materiały-dydaktyczne)
19. [Dokumenty Uczniów](#19-dokumenty-uczniów)
20. [Formularze Zgłoszeń (Course Applications)](#20-formularze-zgłoszeń-course-applications)
21. [Raporty](#21-raporty)
22. [Dashboard Admina / Managera](#22-dashboard-admina--managera)
23. [Dashboard Nauczyciela](#23-dashboard-nauczyciela)
24. [Dashboard Ucznia](#24-dashboard-ucznia)
25. [Integracje Zewnętrzne](#25-integracje-zewnętrzne)

---

## 1. Autoryzacja i Zarządzanie Sesjami

**Strony:** `LoginPage`, `RegisterPage`
**Backend:** `auth.routes.ts`

### Co robi
Obsługuje rejestrację, logowanie i identyfikację zalogowanego użytkownika. Wydaje tokeny JWT używane we wszystkich kolejnych requestach.

### Encje
- `User` — konto użytkownika z emailem, hasłem (bcrypt), rolą i przypisaniem do organizacji.

### Ścieżki użytkownika
- **Rejestracja** — formularz z imieniem, nazwiskiem, emailem i hasłem → konto zostaje utworzone, zwracany jest JWT.
- **Logowanie emailem/hasłem** → JWT.
- **Logowanie przez Google OAuth** (`@react-oauth/google`) → backend weryfikuje `idToken` Google → tworzy lub odnajduje konto → zwraca JWT.
- **Pobranie własnych danych** (`GET /auth/me`) — endpoint używany przy odświeżeniu strony do przywrócenia sesji z localStorage.

### Mechanizm tokenu
Token JWT (ważność 7 dni) jest przechowywany w `localStorage` i wstrzykiwany do każdego requesta przez interceptor Axios. Po zwrocie `401` użytkownik jest automatycznie wylogowywany i przekierowywany do `/login`.

---

## 2. Zarządzanie Użytkownikami (Zespół)

**Strona:** `UsersPage`
**Backend:** `user.routes.ts`, `userProfile.routes.ts`

### Co robi
Pozwala administratorom zarządzać kontami pracowników szkoły — zapraszać nowych, zmieniać role i usuwać konta.

### Encje
- `User` — konto pracownika z rolą, emailem, numerem telefonu.
- `UserProfile` — rozszerzony profil (avatar, preferencje powiadomień).

### Ścieżki użytkownika
- **Zaproszenie nowego użytkownika** — modal z polami: email, imię, nazwisko, telefon, rola, opcjonalne hasło.
- **Zmiana roli** — dropdown przy użytkowniku → `PATCH /users/:id/role`.
- **Usunięcie konta** — potwierdzone przez `ConfirmDialog`.
- **Edycja profilu własnego** — zmiana danych osobowych i preferencji powiadomień przez `userProfile.routes.ts`.

### Role (7)
| Rola | Opis |
|------|------|
| `ADMIN` | Pełny dostęp |
| `MANAGER` | Uczniowie, nauczyciele, kursy, płatności |
| `HR` | Finanse, wypłaty, raporty |
| `METHODOLOGIST` | Kursy, lekcje, materiały |
| `TEACHER` | Własne lekcje i uczniowie |
| `STUDENT` | Własne kursy i harmonogram |
| `PARENT` | Dane przypisanych dzieci |

---

## 3. Zarządzanie Organizacją i Ustawieniami

**Strony:** `OrganizationSettingsPage`, `SettingsPage`, `VisibilitySettingsPage`, `NotificationSettingsPage`, `DashboardSettingsPage`
**Backend:** `organization.routes.ts`

### Co robi
Centralny hub konfiguracji szkoły — branding, dane kontaktowe, waluta, strefa czasowa, święta i ustawienia widoczności publicznej.

### Encje
- `Organization` — główna encja tenanta.
- `OrganizationSettings` — konfiguracja dodatkowa (kolor, waluta, strefa czasowa, flagi funkcji).

### Ścieżki użytkownika
- **Dane szkoły** — formularz z polami: nazwa, adres, miasto, kod pocztowy, telefon, email, strona www, NIP, opis, strefa czasowa, waluta, kraj.
- **Logo** — upload obrazu do Supabase Storage, podgląd aktualnego loga, opcja usunięcia.
- **Święta** — lista polskich świąt z przełącznikami enable/disable; opcja globalnego pomijania świąt w harmonogramie.
- **Ustawienia widoczności** — co jest widoczne publicznie (np. formularz zapisu).
- **Ustawienia powiadomień** — które powiadomienia są włączone dla organizacji.

---

## 4. Zarządzanie Uczniami

**Strona:** `StudentsPage`
**Backend:** `student.routes.ts`

### Co robi
Centralny rejestr uczniów. Obsługuje cały cykl życia ucznia w szkole — od przyjęcia, przez aktywną naukę, po archiwizację.

### Encje
- `Student` — profil ucznia: dane osobowe, poziom językowy, status aktywności, data urodzenia, `deletedAt` (soft delete).
- `StudentEnrollment` — zapis ucznia do konkretnego kursu.
- `StudentBudget` — saldo godzin/środków ucznia.
- `StudentDocument` — dokumenty ucznia (umowy, certyfikaty).
- `StudentLoginHistory` — historia logowań ucznia do portalu.
- `ParentStudentRelation` — powiązanie rodzic–dziecko.

### Ścieżki użytkownika
- **Dodanie ucznia** — modal z danymi osobowymi i przypisaniem do kursu.
- **Import uczniów z CSV** — `ImportStudentsModal` z możliwością mapowania kolumn.
- **Przeglądanie listy** — tabela z kolumnami: numer, imię i nazwisko, email, telefon, poziom językowy, badge salda, kursy; filtry po poziomie, statusie, zakresie salda.
- **Zakładka Archiwa** — uczniowie z ustawionym `deletedAt`; możliwość przywrócenia.
- **Akcje na uczniu** — edycja, przejście do rozliczeń, archiwizacja, usunięcie.
- **Szczegóły ucznia** — zakładki: aktywność, dokumenty, anulowania, rozliczenia, historia salda.

### Logika biznesowa
- **Soft delete** — archiwizacja nie usuwa rekordu, ustawia `deletedAt`. Wszystkie zapytania muszą filtrować `deletedAt: null`.
- **Automatyczna nummeracja** — każdy uczeń dostaje unikalny numer w ramach organizacji.
- Próg alertu niskiego budżetu: **< 2 godziny**.

---

## 5. Zarządzanie Nauczycielami

**Strona:** `TeachersPage`
**Backend:** `teacher.routes.ts`

### Co robi
Rejestr kadry nauczycielskiej z informacjami kadrowymi, finansowymi i rozliczeniowymi.

### Encje
- `Teacher` — profil: dane osobowe, stawka godzinowa, typ umowy, specjalizacje językowe, status aktywności.
- `TeacherPayout` — wypłata/rozliczenie z nauczycielem za dany okres.
- `Substitution` — zastępstwo (patrz moduł 9).

### Ścieżki użytkownika
- **Zakładka Lista** — tabela z kolumnami: imię i nazwisko, email, telefon, typ umowy (badge), stawka godzinowa, liczba kursów, liczba uczniów; filtry po statusie, typie umowy, języku, zakresie stawki.
- **Zakładka Wypłaty** — podgląd rozliczeń z nauczycielami (komponent `TeacherPayoutsTab`).
- **Dodanie/edycja nauczyciela** — modal z danymi osobowymi, stawką, typem umowy, językami.
- **Usunięcie** — zbiorcze lub pojedyncze.

### Typy umów
| Typ | Opis |
|-----|------|
| `B2B` | Umowa business-to-business |
| `EMPLOYMENT` | Umowa o pracę |
| `CIVIL` | Umowa cywilnoprawna (zlecenie/dzieło) |

---

## 6. Kursy i Grupy

**Strony:** `CoursesPage`, `GroupsPage`
**Backend:** `course.routes.ts`

### Co robi
Definiuje ofertę edukacyjną szkoły. `CoursesPage` to pełne zarządzanie kursami (indywidualne i grupowe). `GroupsPage` to widok kart skupiony wyłącznie na kursach grupowych.

### Encje
- `Course` — kurs: nazwa, język, poziom (A0–C2), format, tryb, cena, daty, status.
- `StudentEnrollment` — zapis ucznia do kursu z trybem płatności.
- `CourseMaterial` — materiały dydaktyczne przypisane do kursu.
- `Location` / `Classroom` — sala i lokalizacja zajęć.

### Ścieżki użytkownika
- **Tworzenie kursu** — `CourseModal` z polami: nazwa, język, poziom, format (GROUP/INDIVIDUAL), tryb (IN_PERSON/ONLINE/HYBRID), cena, daty startu i końca, nauczyciel, sala.
- **Zarządzanie uczniami kursu** — modal `EnrollStudentModal` do przypisywania i usuwania uczniów.
- **Rozliczenie grupowe** — dostępne tylko dla kursów GROUP; generuje zestawienie płatności.
- **Kopiowanie kursu** — duplikuje kurs bez uczniów.
- **Filtry** — typ (GROUP/INDIVIDUAL), poziom, tryb, status, wyszukiwanie tekstowe.

### Formaty i tryby
| Wymiar | Wartości |
|--------|----------|
| Format | `GROUP`, `INDIVIDUAL` |
| Tryb | `IN_PERSON`, `ONLINE`, `HYBRID` |
| Poziom | `A0`, `A1`, `A2`, `B1`, `B2`, `C1`, `C2` |

---

## 7. Lekcje i Harmonogram

**Strony:** `LessonsPage`, `CalendarPage`
**Backend:** `lesson.routes.ts`

### Co robi
Zarządza wszystkimi lekcjami w szkole. Oferuje widok listy z filtrami oraz interaktywny kalendarz z drag-and-drop. Obsługuje lekcje jednorazowe i cykliczne z walidacją konfliktów.

### Encje
- `Lesson` — lekcja: tytuł, czas, czas trwania, status, tryb (online/stacjonarnie), URL nagrania, nauczyciel, uczniowie, sala.
- `RecurringPattern` — wzorzec cykliczności (codziennie / co tydzień / co miesiąc, dni tygodnia, data końca).
- `LessonAttendance` — obecność ucznia na konkretnej lekcji.
- `Substitution` — zastępstwo nauczyciela w lekcji.

### Ścieżki użytkownika
1. **Tworzenie lekcji jednorazowej** → `LessonModal` → przypisanie nauczyciela i uczniów → opcjonalna sala.
2. **Tworzenie lekcji cyklicznych** → `LessonModal` z przełącznikiem "cyklicznie" → wybór wzorca → generowanie całej serii.
3. **Drag-and-drop w kalendarzu** → zmiana terminu lekcji + walidacja konfliktu.
4. **Odwołanie lekcji** → `CancelLessonDialog` → opcjonalne naliczenie opłaty anulacyjnej.
5. **Oznaczenie frekwencji** → `AttendanceSection` z listą uczniów (obecny / nieobecny / no-show).

### Statusy lekcji
| Status | Kolor w kalendarzu | Opis |
|--------|--------------------|------|
| `SCHEDULED` | niebieski | Zaplanowana |
| `CONFIRMED` | zielony | Potwierdzona |
| `COMPLETED` | szary | Zakończona |
| `CANCELLED` | czerwony | Odwołana |
| `PENDING_CONFIRMATION` | żółty | Oczekuje na potwierdzenie |
| `NO_SHOW` | pomarańczowy | Uczeń się nie pojawił |

### Widoki harmonogramu
- **Lista** — tabela z filtrowaniem i sortowaniem (po dacie, tytule, nauczycielu, uczniu).
- **Kalendarz** — `react-big-calendar` z widokami miesiąc / tydzień / dzień / agenda, drag-and-drop.
- **Zastępstwa** — zakładka z listą wszystkich zastępstw.

---

## 8. Frekwencja (Attendance)

**Backend:** `attendance.routes.ts`

### Co robi
Rejestruje obecność każdego ucznia na każdej lekcji. Stanowi podstawę do rozliczeń — tylko lekcje z potwierdzonym statusem i frekwencją są rozliczane finansowo.

### Encje
- `LessonAttendance` — rekord obecności: `lessonId`, `studentId`, status (`PRESENT` / `ABSENT` / `NO_SHOW`), notatka.

### API
| Endpoint | Opis |
|----------|------|
| `GET /attendance/lesson/:lessonId` | Pobierz frekwencję dla lekcji |
| `POST /attendance` | Utwórz rekord obecności |
| `POST /attendance/bulk-upsert` | Zbiorczy zapis frekwencji (submit całej listy) |
| `PUT /attendance/:lessonId/:studentId` | Aktualizacja jednego rekordu |
| `DELETE /attendance/:lessonId/:studentId` | Usunięcie rekordu |

---

## 9. Zastępstwa (Substitutions)

**Backend:** `substitution.routes.ts` (widok w `LessonsPage` — zakładka "Zastępstwa")

### Co robi
Obsługuje sytuację, gdy planowy nauczyciel nie może prowadzić lekcji i zastępuje go inny nauczyciel. Zachowuje historię zmian.

### Encje
- `Substitution` — zastępstwo: `lessonId`, oryginalny nauczyciel (`originalTeacherId`), zastępca (`substituteTeacherId`), powód, data.

### Ścieżki użytkownika
- Manager lub nauczyciel tworzy zastępstwo dla konkretnej lekcji.
- Zastępstwo można edytować lub usunąć.
- Wszystkie zastępstwa są widoczne w zakładce "Zastępstwa" na `LessonsPage`.

### API
| Endpoint | Opis |
|----------|------|
| `GET /substitutions` | Lista wszystkich zastępstw |
| `POST /substitutions` | Utwórz zastępstwo |
| `PUT /substitutions/:id` | Zaktualizuj zastępstwo |
| `DELETE /substitutions/:id` | Usuń zastępstwo |

---

## 10. Sale i Lokalizacje (Classrooms)

**Strona:** `ClassroomsPage`
**Backend:** `classroom.routes.ts`

### Co robi
Zarządza fizyczną infrastrukturą szkoły — budynkami (Locations) i salami lekcyjnymi (Classrooms). Obsługuje walidację konfliktów rezerwacji sali.

### Encje
- `Location` — lokalizacja/budynek: nazwa, adres, status aktywności.
- `Classroom` — sala: nazwa, pojemność, przypisanie do lokalizacji, status aktywności.

### Ścieżki użytkownika
- **Widok drzewa** — lokalizacje rozwijane do listy sal.
- **Dodanie lokalizacji** → `LocationModal` z nazwą i adresem.
- **Dodanie sali** → `ClassroomModal` z nazwą, pojemnością i przypisaniem do lokalizacji.
- **Toggle aktywności** — szybkie włączenie/wyłączenie sali bez usuwania.
- **Sprawdzenie konfliktu** — `GET /classrooms/conflict-check` używane przy tworzeniu lekcji.

---

## 11. Płatności

**Strona:** `PaymentsPage`
**Backend:** `payment.routes.ts`

### Co robi
Rejestruje wszystkie wpłaty uczniów, obsługuje import masowy z CSV z pomocą AI oraz zarządza ustawieniami płatności.

### Encje
- `Payment` — wpłata: kwota, waluta, metoda, status, data zapłaty, przypisanie do ucznia i kursu.
- `Invoice` — faktura powiązana z płatnością.

### Ścieżki użytkownika
- **Zakładka Płatności** — tabela z filtrowaniem po statusie, metodzie płatności, walucie, zakresie dat; sortowanie; akcje: usuń, wyślij przypomnienie.
- **Dodanie płatności ręcznie** — `PaymentModal` z polami: uczeń, kurs, kwota, waluta, metoda, data.
- **Import z CSV** — `ImportPaymentsModal`:
  1. Upload pliku CSV.
  2. Google Gemini AI automatycznie mapuje kolumny na pola systemu (imię, nazwisko, kwota, data).
  3. Podgląd zmapowanych danych.
  4. Zatwierdzenie → zapis do bazy.
- **Zakładka Rozliczenia** — komponent `SettlementsTab` (patrz moduł 12).
- **Zakładka Ustawienia** — komponent `PaymentSettingsTab` — konfiguracja metod płatności, walut, dni rozliczeniowych.

### Tryby płatności
| Tryb | Opis |
|------|------|
| `PACKAGE` | Uczeń kupuje pakiet godzin z góry |
| `PER_LESSON` | Płatność naliczana po każdej lekcji |
| `BALANCE` | Odliczane z salda konta ucznia |

### Metody płatności
`STRIPE` · `CASH` · `BANK_TRANSFER`

### Logika biznesowa
- Płatności są wielowalutowe. Przeliczenia przez kursy walut przechowywane w `ExchangeRate`.
- Import CSV z Gemini: AI rozpoznaje kolumny nawet gdy nagłówki są po polsku lub mają niestandardowe nazwy.

---

## 12. Saldo i Rozliczenia Uczniów

**Backend:** `balance.routes.ts`, `settlement.routes.ts`
**Widoczne w:** `PaymentsPage` (zakładka Rozliczenia), profil ucznia (zakładka Rozliczenia)

### Co robi
Automatycznie śledzi saldo godzin/środków każdego ucznia i umożliwia tworzenie formalnych rozliczeń okresowych.

### Encje
- `StudentBudget` — bieżące saldo ucznia (godziny lub środki pieniężne).
- `StudentSettlement` — formalne rozliczenie za okres: bilans otwarcia, wpłaty, lekcje, bilans zamknięcia.

### Logika biznesowa
- Po zakończeniu lekcji (`COMPLETED`) saldo pomniejszane jest o czas trwania lekcji.
- Przy odwołaniu po terminie — naliczana jest skonfigurowana opłata anulacyjna.
- Alert niskiego salda wyzwalany gdy saldo **< 2 godziny**.
- **Podgląd prognozowany** (`GET /settlement/student/:id/forecast`) — symuluje przyszłe saldo na podstawie zaplanowanych lekcji.

### API Saldo
| Endpoint | Opis |
|----------|------|
| `GET /balance/my` | Własne saldo (portal ucznia) |
| `GET /balance/my/transactions` | Historia własnych transakcji |
| `GET /balance/:studentId` | Saldo ucznia (admin) |
| `POST /balance/:studentId/adjust` | Ręczna korekta salda |

### API Rozliczenia
| Endpoint | Opis |
|----------|------|
| `POST /settlement/preview` | Podgląd rozliczenia przed zapisem |
| `POST /settlement` | Utwórz rozliczenie |
| `DELETE /settlement/:id` | Usuń tylko ostatnie rozliczenie |

---

## 13. Wypłaty Nauczycieli (Payouts)

**Backend:** `payout.routes.ts`
**Widoczne w:** `TeachersPage` (zakładka Wypłaty), `ReportsPage` (raport Payouts)

### Co robi
Oblicza i rejestruje wypłaty dla nauczycieli na podstawie przeprowadzonych lekcji, stawek godzinowych i potrąceń.

### Encje
- `TeacherPayout` — wypłata: nauczyciel, okres, kwota brutto, kwota netto, status (`PENDING` / `PAID`), data wypłaty.

### Ścieżki użytkownika
- **Podsumowanie nauczycieli** — widok ze wszystkimi nauczycielami i ich należnościami za bieżący okres.
- **Prognoza wypłaty** — `GET /payouts/forecast` — szacowana kwota na dany dzień.
- **Podgląd wypłaty nauczyciela** — lista lekcji wchodzących w skład rozliczenia, stawki, potrącenia.
- **Zmiana statusu** — `PATCH /payouts/:id/status` → oznaczenie jako zapłacone.

### API
| Endpoint | Opis |
|----------|------|
| `GET /payouts/teachers-summary` | Podsumowanie wszystkich nauczycieli |
| `GET /payouts/teacher/:id/preview` | Podgląd wypłaty |
| `GET /payouts/teacher/:id/lessons` | Lekcje za dzień |
| `GET /payouts/teacher/:id/lessons-range` | Lekcje za zakres dat |
| `POST /payouts` | Utwórz wypłatę |
| `PATCH /payouts/:id/status` | Zmień status wypłaty |

---

## 14. Dłużnicy (Debtors)

**Strona:** `DebtorsPage`
**Backend:** `payment.routes.ts` (endpointy `/debtors`, `/reminders`)

### Co robi
Zbiera uczniów z zaległymi płatnościami i umożliwia wysyłanie przypomnień emailowych.

### Encje
- Widok obliczony na podstawie `Payment` (statusy zaległe) i `Student`.

### Ścieżki użytkownika
- **Karty podsumowania** — łączna kwota zadłużenia, liczba dłużników.
- **Lista dłużników** — rozwijane karty z: imię i nazwisko, email, telefon, łączna kwota (czerwona), liczba zaległych płatności, liczba dni od najstarszej zaległości (badge).
- **Widok rozwinięty ucznia** — lista konkretnych zaległych płatności z datami.
- **Wysłanie przypomnienia** — `POST /reminders/:paymentId` → email przez Resend.
- **Status przypomnienia** — `GET /reminders/:paymentId/status` → kiedy ostatnio wysłano.

---

## 15. Alerty

**Strona:** `AlertsPage`
**Backend:** `alert.routes.ts`

### Co robi
Wyświetla systemowe alerty dotyczące budżetów uczniów i zaległych płatności. Alerty generowane są automatycznie przez zadania cron lub ręcznie przez administratora.

### Encje
- `Alert` — alert: typ, priorytet (`CRITICAL` / `HIGH` / `NORMAL`), status przeczytania, treść, powiązanie z uczniem lub lekcją.

### Ścieżki użytkownika
- **Filtrowanie** — zakładki statusu (Wszystkie / Nieprzeczytane / Przeczytane) oraz priorytetu.
- **Oznaczanie jako przeczytane** — pojedynczo (`PATCH /alerts/:id/read`) lub zbiorczo (`PATCH /alerts/mark-all-read`).
- **Generowanie alertów** — `POST /alerts/generate` — ręczne wyzwolenie skanowania systemu.
- **Licznik nieprzeczytanych** — `NotificationBell` w headerze używa `GET /alerts/unread-count`.

### Automatyczne generowanie alertów (cron)
- Alerty niskiego budżetu — **poniedziałki, 10:00**.
- Alerty zaległych płatności — **codziennie, 9:00**.

---

## 16. Powiadomienia

**Backend:** `notification.routes.ts`
**Widoczne w:** `NotificationCenter` (panel w headerze), `NotificationSettingsPage`

### Co robi
Wielokanałowy system komunikacji automatycznej — wysyła powiadomienia o nadchodzących lekcjach, zaległych płatnościach i niskim budżecie.

### Encje
- `Notification` — powiadomienie: kanał, typ, status (`PENDING` / `SENT` / `FAILED`), treść, odbiorca.
- `NotificationTemplate` — szablon emaila konfigurowany per organizacja.

### Kanały
`EMAIL` (Resend) · `SMS` · `PUSH` · `IN_APP`

### Automatyczne powiadomienia (cron)
| Zdarzenie | Harmonogram |
|-----------|-------------|
| Przypomnienie o lekcji (1h przed) | Co 5 minut |
| Alert niskiego budżetu | Poniedziałki, 10:00 |
| Przypomnienie o płatności | Codziennie, 9:00 |
| Czyszczenie starych powiadomień | Niedziele, 2:00 |

---

## 17. Mailing (Komunikacja Masowa)

**Strona:** `MailingsPage`
**Backend:** `mailing.routes.ts`

### Co robi
Umożliwia wysyłanie masowych emaili do wybranych grup odbiorców z możliwością załączenia plików i użycia gotowych szablonów.

### Encje
- `Mailing` — rekord wysyłki: temat, treść, lista odbiorców, typ, załączniki, data wysyłki.

### Ścieżki użytkownika
1. **Wybór grupy odbiorców** — Wszyscy uczniowie / Wybrani uczniowie / Dłużnicy / Uczestnicy kursu / Uczestnicy lekcji.
2. **Wpisanie treści** — temat i treść wiadomości.
3. **Wybór szablonu** — Welcome / Przypomnienie / Płatność / Ocena nauczyciela.
4. **Załączniki** — upload do 10 plików, maks. 10 MB każdy.
5. **Podgląd** — wyrenderowany email przed wysyłką.
6. **Wysyłka** — `POST /mailing/send-bulk` z `multipart/form-data`.

---

## 18. Materiały Dydaktyczne

**Strona:** `MaterialsPage`
**Backend:** `material.routes.ts`, `file.routes.ts`

### Co robi
Repozytorium plików edukacyjnych przypisanych do kursów lub konkretnych lekcji. Obsługuje też nagrania lekcji online.

### Encje
- `CourseMaterial` — materiał: tytuł, opis, plik (URL w Supabase Storage), rozmiar, nazwa pliku, powiązanie z kursem lub lekcją.
- `File` — metadane pliku w Supabase Storage.

### Ścieżki użytkownika
- **Zakładka Materiały kursów** — wybierz kurs → lista materiałów → pobierz / usuń.
- **Zakładka Materiały lekcji** — wybierz lekcję → lista materiałów + sekcja nagrania (URL do nagrania dla zakończonych lekcji online).
- **Upload materiału** — `UploadMaterialModal` z tytułem, opisem i wyborem pliku.

---

## 19. Dokumenty Uczniów

**Backend:** `document.routes.ts`
**Widoczne w:** zakładka "Dokumenty" w profilu ucznia (`StudentsPage`)

### Co robi
Przechowuje formalne dokumenty przypisane do ucznia — umowy, certyfikaty, zaświadczenia.

### Encje
- `StudentDocument` — dokument: typ (`CONTRACT` / `CERTIFICATE` / `OTHER`), nazwa, URL pliku, data.

### API
| Endpoint | Opis |
|----------|------|
| `GET /documents/student/:id` | Dokumenty ucznia |
| `POST /documents` | Upload dokumentu |
| `DELETE /documents/:id` | Usuń dokument |

---

## 20. Formularze Zgłoszeń (Course Applications)

**Strony:** `CourseApplicationsPage`, `PublicApplicationForm`
**Backend:** `courseApplication.routes.ts`

### Co robi
Umożliwia potencjalnym uczniom zgłoszenie się na kurs przez publiczny formularz (bez logowania). Administracja przegląda zgłoszenia i może je zaakceptować, odrzucić lub przekonwertować na pełne konto ucznia.

### Encje
- `CourseApplication` — zgłoszenie: imię, nazwisko, email, telefon, preferencje kursów, status (`NEW` / `ACCEPTED` / `REJECTED`), data zgłoszenia.

### Ścieżki użytkownika

**Ścieżka kandydata (publiczna, bez logowania):**
1. Wejście na `PublicApplicationForm` (URL z slugiem organizacji).
2. Wypełnienie formularza — dane osobowe + preferowany kurs/poziom.
3. Zgłoszenie → `POST /applications/public/:orgSlug`.

**Ścieżka administratora:**
1. `CourseApplicationsPage` — lista zgłoszeń z filtrowaniem po statusie i wyszukiwaniem.
2. Kliknięcie zgłoszenia → `ApplicationDetailsModal` z pełnymi danymi.
3. Akcje: **Zaakceptuj** / **Odrzuć** → `PUT /applications/:id/status`.
4. **Konwersja do ucznia** → `POST /applications/:id/convert` — tworzy pełny profil ucznia z danych zgłoszenia.

---

## 21. Raporty

**Strona:** `ReportsPage`
**Backend:** `report.routes.ts`

### Co robi
Dostarcza analityczne raporty biznesowe dla kierownictwa szkoły z możliwością eksportu.

### Dostępne raporty

| Zakładka | Endpoint | Opis |
|----------|----------|------|
| **Wypłaty** (Payouts) | `GET /reports/teacher-payouts` | Zestawienie wypłat dla nauczycieli za wybrany okres |
| **Nowi uczniowie** | `GET /reports/new-students` | Liczba nowych zapisów w czasie |
| **Marże** | `GET /reports/margins` | Przychody minus koszty per kurs/nauczyciel |
| **Dłużnicy** | `GET /reports/debtors` | Pełne zestawienie zaległości płatniczych |
| **Retencja** | `GET /reports/retention` | Wskaźnik zatrzymania uczniów (churn analysis) |

### Eksport
`GET /reports/export/:reportType` — eksport dowolnego raportu do CSV lub PDF.

---

## 22. Dashboard Admina / Managera

**Strona:** `DashboardPage` (dla ról ADMIN, MANAGER, HR, METHODOLOGIST)

### Co robi
Pulpit z kluczowymi KPI szkoły i szybkimi akcjami. Wyświetla aktualny stan biznesu na przestrzeni wybranego okresu.

### KPI (karty statystyk)
- Liczba dłużników
- Oczekujące płatności
- Lekcje dzisiaj
- Aktywni nauczyciele
- Aktywne kursy
- Aktywni uczniowie

### Wykresy
- **Wykres przychodów** — słupkowy, z podziałem na nowych i powracających uczniów.
- **Wykres lekcji** — liczba lekcji w czasie.

### Szybkie akcje
- Dodaj ucznia (otwiera `StudentModal`)
- Dodaj lekcję (otwiera `LessonModal`)
- Dodaj kurs (otwiera `CourseModal`)

### Filtry okresu
Ostatnie 30 dni / Bieżący miesiąc / Bieżący rok z nawigacją strzałkami.

---

## 23. Dashboard Nauczyciela

**Strona:** `TeacherDashboard`, `TeacherSchedulePage`

### Co robi
Spersonalizowany widok dla nauczyciela — plan tygodnia, statystyki i przypomnienia o niezaznaczonej frekwencji.

### Sekcje
- **Statystyki tygodnia** — łączna liczba lekcji, łączne godziny, unikalni uczniowie, zakończone lekcje.
- **Lekcje dzisiaj** — liczba zaplanowanych na dziś.
- **Przypomnienia** — lista lekcji, dla których nie zaznaczono frekwencji.
- **Pełny harmonogram** — link do `TeacherSchedulePage` z kalendarzem tygodniowym/miesięcznym.

---

## 24. Dashboard Ucznia

**Strona:** `StudentDashboard`

### Co robi
Uproszczony widok dla ucznia — nadchodzące lekcje i aktywne kursy.

### Sekcje
- **Statystyki** — moje kursy, nadchodzące lekcje, zakończone lekcje.
- **Nadchodzące lekcje** — lista z datą, tytułem, imieniem nauczyciela i godziną.
- **Aktywne kursy** — karty kursów z podstawowymi informacjami.

---

## 25. Integracje Zewnętrzne

**Strona:** `IntegrationsPage`
**Backend:** `google-calendar.routes.ts`, `microsoft-teams.routes.ts`

### Co robi
Pozwala nauczycielom i administratorom połączyć swoje konto z zewnętrznymi serwisami kalendarza i wideokonferencji.

### Google Calendar

**Encja:** `GoogleCalendarSync` — token OAuth, status połączenia, data ostatniej synchronizacji.

**Ścieżka użytkownika:**
1. Kliknięcie "Połącz z Google Calendar" → przekierowanie OAuth.
2. Po autoryzacji → lekcje są synchronizowane do kalendarza Google.
3. Ręczna synchronizacja na żądanie (`POST /google-calendar/sync`).
4. Odłączenie → `DELETE /google-calendar/disconnect`.

### Microsoft Teams

**Encja:** `MicrosoftTeamsSync` — token OAuth, status połączenia.

**Ścieżka użytkownika:**
1. Kliknięcie "Połącz z Microsoft Teams" → przekierowanie OAuth.
2. Po połączeniu — lekcje online automatycznie otrzymują link do spotkania Teams.
3. Odłączenie → `DELETE /teams/disconnect`.

---

## Architektura Multi-Tenant

Każdy `User` jest powiązany z co najmniej jedną `Organization`. Wszystkie dane (uczniowie, nauczyciele, kursy, lekcje, płatności) są izolowane per organizacja poprzez pole `organizationId` na każdej encji. Użytkownik może należeć do wielu organizacji i przełączać się między nimi w UI przez komponent `OrganizationSwitcher`. Wartość `organizationId` zawsze pochodzi z tokenu JWT — nigdy z parametrów requestu.
