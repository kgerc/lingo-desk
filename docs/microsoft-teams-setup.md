# Microsoft Teams Integration — Setup

Ten dokument opisuje krok po kroku jak skonfigurować aplikację Azure AD i uzyskać dane potrzebne do uruchomienia integracji z Microsoft Teams w LingoDesk.

---

## Wymagania wstępne

- Konto Microsoft 365 z rolą **Global Administrator** lub **Application Administrator** w Azure AD
- Użytkownicy, którzy będą używać integracji, muszą mieć licencję **Microsoft Teams**

---

## Krok 1 — Utwórz aplikację w Azure Active Directory

1. Zaloguj się do [portal.azure.com](https://portal.azure.com)
2. W wyszukiwarce wpisz **„App registrations"** i wybierz wynik
3. Kliknij **„+ New registration"**
4. Wypełnij formularz:
   - **Name:** `LingoDesk` (lub dowolna nazwa)
   - **Supported account types:** wybierz odpowiedni wariant:
     - `Accounts in this organizational directory only` — dla jednej organizacji (zalecane dla szkół)
     - `Accounts in any organizational directory` — dla wielu tenantów (jeśli SaaS)
   - **Redirect URI:** zostaw puste na razie (ustawisz w następnym kroku)
5. Kliknij **„Register"**

Po rejestracji zostaniesz przekierowany na stronę aplikacji. Zapisz:
- **Application (client) ID** → `MICROSOFT_CLIENT_ID`
- **Directory (tenant) ID** → `MICROSOFT_TENANT_ID`

---

## Krok 2 — Dodaj Redirect URI

1. W menu po lewej kliknij **„Authentication"**
2. Kliknij **„+ Add a platform"** → wybierz **„Web"**
3. W polu **Redirect URIs** wpisz:
   ```
   http://localhost:3000/api/microsoft-teams/callback
   ```
   (dla produkcji zmień na adres produkcyjny, np. `https://twoja-domena.pl/api/microsoft-teams/callback`)
4. W sekcji **Implicit grant and hybrid flows** zaznacz:
   - `Access tokens`
   - `ID tokens`
5. Kliknij **„Configure"**, a następnie **„Save"**

---

## Krok 3 — Utwórz Client Secret

1. W menu po lewej kliknij **„Certificates & secrets"**
2. Kliknij **„+ New client secret"**
3. Wypełnij:
   - **Description:** `LingoDesk backend`
   - **Expires:** `24 months` (lub dłużej, pamiętaj o odnowieniu przed wygaśnięciem)
4. Kliknij **„Add"**
5. Skopiuj wartość z kolumny **„Value"** — to jest `MICROSOFT_CLIENT_SECRET`

> **Uwaga:** Wartość sekretu jest widoczna tylko raz. Jeśli ją zapomnisz, musisz wygenerować nową.

---

## Krok 4 — Dodaj uprawnienia API (Microsoft Graph)

1. W menu po lewej kliknij **„API permissions"**
2. Kliknij **„+ Add a permission"**
3. Wybierz **„Microsoft Graph"**
4. Wybierz **„Delegated permissions"** (użytkownik loguje się przez OAuth)
5. Wyszukaj i zaznacz następujące uprawnienia:
   - `OnlineMeetings.ReadWrite` — tworzenie/edycja/usuwanie spotkań Teams
   - `Calendars.ReadWrite` — synchronizacja kalendarza (opcjonalne)
   - `offline_access` — odświeżanie tokenów w tle
   - `openid`, `profile`, `email` — dane profilu użytkownika
6. Kliknij **„Add permissions"**
7. Kliknij **„Grant admin consent for [Twoja organizacja]"** i potwierdź

> **Ważne:** `OnlineMeetings.ReadWrite` wymaga zgody administratora. Bez niej użytkownicy będą widzieć błąd podczas próby połączenia.

---

## Krok 5 — Uzupełnij zmienne środowiskowe

Otwórz plik `apps/backend/.env` i dodaj:

```env
# Microsoft Teams / Azure AD
MICROSOFT_CLIENT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
MICROSOFT_CLIENT_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
MICROSOFT_TENANT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
MICROSOFT_REDIRECT_URI=http://localhost:3000/api/microsoft-teams/callback
```

| Zmienna | Skąd wziąć |
|---|---|
| `MICROSOFT_CLIENT_ID` | Azure Portal → App registrations → Overview → Application (client) ID |
| `MICROSOFT_CLIENT_SECRET` | Azure Portal → App registrations → Certificates & secrets → Value |
| `MICROSOFT_TENANT_ID` | Azure Portal → App registrations → Overview → Directory (tenant) ID. Użyj `common` jeśli aplikacja ma być wielotenantowa |
| `MICROSOFT_REDIRECT_URI` | Musi dokładnie pasować do URI dodanego w kroku 2 |

---

## Krok 6 — Weryfikacja

1. Uruchom backend: `npm run dev` w `apps/backend`
2. Zaloguj się do LingoDesk jako Admin lub Manager
3. Przejdź do **Ustawienia → Integracje**
4. Kliknij **„Połącz z Microsoft Teams"**
5. Zaloguj się kontem Microsoft 365 — powinna pojawić się zgoda na uprawnienia
6. Po akceptacji zostaniesz przekierowany z powrotem z komunikatem „Microsoft Teams połączony pomyślnie"
7. Utwórz nową lekcję z trybem **Online** — system automatycznie wygeneruje spotkanie Teams i zapisze link

---

## Rozwiązywanie problemów

### Błąd `AADSTS650052` — brak zgody administratora
Przejdź do Azure Portal → API permissions → kliknij **„Grant admin consent"**

### Błąd `AADSTS700016` — aplikacja nie znaleziona
Sprawdź czy `MICROSOFT_CLIENT_ID` jest poprawny i czy aplikacja istnieje w tym tenancie.

### Błąd `invalid_client`
Sprawdź `MICROSOFT_CLIENT_SECRET` — może być wygasły lub błędnie skopiowany.

### `redirect_uri_mismatch`
URI w `.env` musi być **identyczny** (łącznie z `http`/`https` i ewentualnym `/`) jak ten dodany w Azure Portal.

### Spotkanie Teams nie jest tworzone
- Sprawdź w konsoli backendu czy pojawia się błąd `Failed to create Microsoft Teams meeting`
- Upewnij się, że użytkownik łączący konto ma licencję Teams (nie samo M365 Basic)
- Uprawnienie `OnlineMeetings.ReadWrite` wymaga rzeczywistego użytkownika (nie service account)

---

## Środowisko produkcyjne

Dla środowiska produkcyjnego zmień Redirect URI na produkcyjny adres:

```
https://twoja-domena.pl/api/microsoft-teams/callback
```

Pamiętaj o dodaniu go w Azure Portal (krok 2) i aktualizacji `.env`:

```env
MICROSOFT_REDIRECT_URI=https://twoja-domena.pl/api/microsoft-teams/callback
```
