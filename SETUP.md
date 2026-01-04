# 🚀 LingoDesk - Setup Guide

Ten dokument zawiera kompletne instrukcje uruchomienia aplikacji LingoDesk.

---

## 📋 Wymagania

- **Node.js** 18+ (sprawdź: `node --version`)
- **npm** lub **yarn**
- **Git**
- **Konto Supabase** (darmowe na [supabase.com](https://supabase.com))

---

## 🔧 Krok 1: Instalacja zależności

```bash
# Z poziomu głównego katalogu projektu
npm install

# Instalacja zależności backendu
cd apps/backend
npm install

# Instalacja zależności frontendu
cd ../frontend
npm install
```

---

## 🗄️ Krok 2: Konfiguracja bazy danych (Supabase)

### 2.1 Załóż projekt w Supabase

1. Wejdź na [supabase.com](https://supabase.com)
2. Kliknij "Start your project"
3. Stwórz nowy projekt (nazwa: `lingodesk`)
4. Wybierz region (np. Frankfurt dla Polski)
5. Ustaw hasło do bazy danych i **zapisz je**

### 2.2 Pobierz connection string

1. W panelu Supabase, przejdź do **Settings** → **Database**
2. Skopiuj **Connection string** (URI format)
3. Zamień `[YOUR-PASSWORD]` na hasło z kroku 2.1

Przykład:
```
postgresql://postgres:twoje-haslo@db.xxxxxxxxxxxx.supabase.co:5432/postgres
```

### 2.3 Pobierz API keys

1. Przejdź do **Settings** → **API**
2. Skopiuj:
   - **Project URL** (np. `https://xxxxxxxxxxxx.supabase.co`)
   - **anon public** key
   - **service_role** key (secret!)

---

## ⚙️ Krok 3: Konfiguracja environment variables

### Backend (.env)

Stwórz plik `apps/backend/.env`:

```bash
cd apps/backend
cp .env.example .env
```

Edytuj `apps/backend/.env` i wklej swoje dane:

```env
# Server
NODE_ENV=development
PORT=3000
API_URL=http://localhost:3000

# Database (Supabase PostgreSQL)
DATABASE_URL="postgresql://postgres:TWOJE_HASLO@db.xxxxxxxxxxxx.supabase.co:5432/postgres"

# Supabase
SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
SUPABASE_ANON_KEY=twoj-anon-key
SUPABASE_SERVICE_ROLE_KEY=twoj-service-role-key

# JWT (wygeneruj losowy klucz)
JWT_SECRET=super-tajny-klucz-zmien-to-w-produkcji
JWT_EXPIRES_IN=7d

# Email (opcjonalne w MVP)
RESEND_API_KEY=
EMAIL_FROM=LingoDesk <noreply@lingodesk.com>

# Frontend URL
FRONTEND_URL=http://localhost:5173

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

### Frontend (.env)

Stwórz plik `apps/frontend/.env`:

```bash
cd apps/frontend
cp .env.example .env
```

Edytuj `apps/frontend/.env`:

```env
VITE_API_URL=http://localhost:3000/api
VITE_APP_NAME=LingoDesk
```

---

## 🗃️ Krok 4: Uruchomienie migracji bazy danych

```bash
cd apps/backend

# Wygeneruj Prisma Client
npx prisma generate

# Uruchom migracje (stworzenie tabel)
npx prisma migrate dev --name init

# (Opcjonalnie) Otwórz Prisma Studio do podglądu danych
npx prisma studio
```

Po uruchomieniu migracji, tabele zostaną utworzone w Supabase.

---

## 🚀 Krok 5: Uruchomienie aplikacji

### Uruchom backend i frontend jednocześnie:

Z poziomu głównego katalogu projektu:

```bash
npm run dev
```

To uruchomi:
- **Backend**: [http://localhost:3000](http://localhost:3000)
- **Frontend**: [http://localhost:5173](http://localhost:5173)

### Lub uruchom osobno:

**Backend:**
```bash
cd apps/backend
npm run dev
```

**Frontend:**
```bash
cd apps/frontend
npm run dev
```

---

## ✅ Krok 6: Testowanie

1. Otwórz [http://localhost:5173](http://localhost:5173)
2. Kliknij "Załóż nowe konto"
3. Wypełnij formularz:
   - Imię: Jan
   - Nazwisko: Kowalski
   - Nazwa szkoły: My English School
   - Email: jan@example.com
   - Hasło: password123
4. Kliknij "Załóż konto"
5. Powinieneś zostać przekierowany do dashboardu

---

## 🐛 Troubleshooting

### Problem: "Cannot find module '@prisma/client'"

**Rozwiązanie:**
```bash
cd apps/backend
npx prisma generate
```

### Problem: "Database connection failed"

**Sprawdź:**
1. Czy `DATABASE_URL` w `.env` jest prawidłowe
2. Czy hasło nie zawiera znaków specjalnych (zamień na `%XX` encoding)
3. Czy projekt Supabase jest aktywny

### Problem: "Port 3000 already in use"

**Rozwiązanie:**
```bash
# Windows
netstat -ano | findstr :3000
taskkill /PID <PID> /F

# Mac/Linux
lsof -ti:3000 | xargs kill
```

### Problem: Frontend nie łączy się z backendem

**Sprawdź:**
1. Czy backend działa na porcie 3000: [http://localhost:3000/health](http://localhost:3000/health)
2. Czy `VITE_API_URL` w `apps/frontend/.env` jest prawidłowe
3. Restart serwera frontendowego

---

## 📚 Następne kroki

Po uruchomieniu aplikacji możesz:

1. **Dodać pierwszego ucznia** (przycisk w dashboardzie)
2. **Dodać lektora**
3. **Stworzyć kurs**
4. **Zaplanować zajęcia**

---

## 🔐 Bezpieczeństwo

**WAŻNE dla produkcji:**
- Zmień `JWT_SECRET` na losowy, bezpieczny klucz
- Użyj zmiennych środowiskowych w Vercel/Heroku
- Nigdy nie commituj plików `.env` do repozytorium
- Włącz Row Level Security w Supabase

---

## 📞 Wsparcie

Jeśli masz problemy:
1. Sprawdź logi backendu (terminal)
2. Sprawdź console DevTools w przeglądarce (F12)
3. Sprawdź czy wszystkie zależności są zainstalowane

---

## 🎉 Gotowe!

Twoja aplikacja LingoDesk działa lokalnie. Powodzenia!
