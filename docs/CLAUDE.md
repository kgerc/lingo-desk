# CLAUDE.md — Przewodnik Operacyjny dla AI

> Ten plik jest "pamięcią operacyjną" dla Claude. Zawiera wszystko, co musisz wiedzieć, żeby sprawnie pracować nad tym projektem bez pytania o podstawy.

---

## 1. Build & Run

### Wymagania wstępne
- Node.js 18+
- Yarn (workspace manager)
- Dostęp do Supabase (PostgreSQL) — credentials w `apps/backend/.env`

### Komendy (uruchamiane z roota repozytorium)

```bash
# Instalacja zależności (raz, lub po zmianie package.json)
npm install

# Tryb deweloperski — uruchamia backend i frontend równocześnie
npm run dev

# Tylko backend (port 3000)
npm run dev:backend

# Tylko frontend (port 5173)
npm run dev:frontend

# Build produkcyjny (oba)
npm run build
```

### Komendy Prisma (uruchamiane z `apps/backend/`)

```bash
npx prisma migrate dev          # Nowe migracje (dev)
npx prisma migrate deploy       # Wdrożenie migracji (prod)
npx prisma generate             # Regeneracja klienta Prisma
npx prisma studio               # GUI do bazy danych (localhost:5555)
npx prisma db seed              # Seeding danych
```

### Serwery deweloperskie
| Serwis | URL |
|--------|-----|
| Backend (Express) | http://localhost:3000 |
| Frontend (Vite) | http://localhost:5173 |
| Health check | http://localhost:3000/health |
| Prisma Studio | http://localhost:5555 |

### Zmienne środowiskowe
- Backend: `apps/backend/.env` — Supabase URL/KEY, JWT_SECRET, RESEND_API_KEY, STRIPE_KEY, GOOGLE_*, GEMINI_API_KEY, MICROSOFT_*
- Frontend: `apps/frontend/.env` — VITE_API_URL, VITE_APP_NAME

---

## 2. Tech Stack (aktualne wersje)

### Backend
| Biblioteka | Wersja | Cel |
|------------|--------|-----|
| Node.js | 18+ | Runtime |
| Express.js | 4.21.2 | Framework HTTP |
| TypeScript | 5.7.2 | Język |
| Prisma | 5.22.0 | ORM (PostgreSQL) |
| Zod | 3.23.8 | Walidacja schematów |
| jsonwebtoken | 9.0.2 | JWT autoryzacja |
| bcrypt | 5.1.1 | Haszowanie haseł |
| Resend | 4.8.0 | Email |
| node-cron | 3.0.3 | Zadania cykliczne |
| Multer | 2.0.2 | Upload plików |
| PDFKit | 0.17.2 | Generowanie PDF |
| xlsx | 0.18.5 | Excel export |
| csv-parse | 6.1.0 | Parsowanie CSV |
| @google/generative-ai | 0.24.1 | Gemini AI (CSV mapping) |
| googleapis | 170.0.0 | Google Calendar |
| @supabase/supabase-js | 2.48.0 | Supabase Storage |
| tsx | 4.19.2 | TS runner (dev) |

### Frontend
| Biblioteka | Wersja | Cel |
|------------|--------|-----|
| React | 18.3.1 | Framework UI |
| TypeScript | 5.7.2 | Język |
| Vite | 6.0.5 | Build tool |
| Zustand | 5.0.3 | Stan globalny |
| Axios | 1.7.9 | HTTP client |
| TanStack React Query | 5.62.11 | Server state + cache |
| @tanstack/react-router | 1.98.0 | Routing |
| TailwindCSS | 3.4.17 | Styling |
| shadcn/ui + Radix UI | latest | Komponenty UI |
| React Hook Form | 7.54.2 | Formularze |
| Recharts | 3.6.0 | Wykresy |
| react-big-calendar | 1.19.4 | Kalendarz |
| date-fns | 4.1.0 | Operacje na datach |
| moment | 2.30.1 | Daty (legacy, unikaj nowych użyć) |
| lucide-react | 0.469.0 | Ikony |
| react-hot-toast | 2.6.0 | Powiadomienia UI |
| @react-oauth/google | 0.13.4 | Google OAuth |
| xlsx | 0.18.5 | Excel export |

> **Uwaga:** Do manipulacji datami używaj `date-fns` (nie `moment`). `moment` jest zachowany dla istniejącego kodu.

---

## 3. Struktura Projektu

```
lingo-desk/
├── apps/
│   ├── backend/
│   │   ├── prisma/
│   │   │   ├── schema.prisma          # JEDYNE źródło prawdy o schemacie DB
│   │   │   └── migrations/            # Historia migracji (nie edytuj ręcznie)
│   │   └── src/
│   │       ├── config/
│   │       │   └── permissions.ts     # Macierz ról i uprawnień (RBAC)
│   │       ├── controllers/           # Handlery HTTP (jeden per moduł)
│   │       ├── middleware/
│   │       │   ├── auth.ts            # JWT verify + role check
│   │       │   ├── errorHandler.ts    # Centralny handler błędów
│   │       │   └── rateLimiter.ts     # Rate limiting
│   │       ├── routes/                # Definicje tras (jeden plik per moduł)
│   │       ├── services/              # Cała logika biznesowa (nie w kontrolerach)
│   │       ├── jobs/                  # Zadania cron
│   │       ├── types/                 # Typy TypeScript
│   │       ├── utils/
│   │       │   ├── scheduler.ts       # node-cron setup
│   │       │   ├── pdfGenerator.ts    # PDFKit wrapper
│   │       │   ├── csvGenerator.ts    # CSV export
│   │       │   └── supabase.ts        # Supabase Storage init
│   │       └── index.ts               # Entry point, middleware setup
│   │
│   └── frontend/
│       └── src/
│           ├── pages/                 # 29 stron (jeden plik = jedna strona)
│           ├── components/            # 36+ komponentów wielokrotnego użytku
│           │   └── reports/           # Komponenty raportowe
│           ├── services/              # 27 serwisów API (axios calls)
│           ├── stores/
│           │   ├── authStore.ts       # Zustand: auth state + token
│           │   └── sidebarStore.ts    # Zustand: UI state
│           ├── hooks/                 # Custom React hooks
│           ├── lib/
│           │   ├── api.ts             # Axios instance z interceptorami
│           │   └── errorUtils.ts      # Obsługa błędów API
│           ├── types/                 # TypeScript interfaces
│           ├── utils/                 # Funkcje pomocnicze
│           ├── styles/globals.css     # Globalne style
│           └── App.tsx                # Router + layout
│
├── docs/                              # Dokumentacja integracji
├── README.md
├── README_FEATURES.md                 # Dokumentacja funkcjonalna
├── SETUP.md                           # Instrukcja instalacji (PL)
├── IMPLEMENTATION_STATUS.md           # Status wdrożonych funkcji
└── CLAUDE.md                          # Ten plik
```

---

## 4. Konwencje Kodowania

### Ogólne zasady
- **Język UI**: Aplikacja jest po **polsku** (etykiety, komunikaty błędów, alerty).
- **TypeScript strict mode** — brak `any`, typy muszą być jawne.
- **Funkcyjny styl** w React (komponenty funkcyjne + hooks, zero class components).
- **OOP w serwisach backendowych** — klasy serwisów z metodami instancji.

### Nazewnictwo
| Kontekst | Konwencja | Przykład |
|----------|-----------|---------|
| Pliki komponentów React | PascalCase | `StudentModal.tsx` |
| Pliki serwisów/utils | camelCase | `paymentService.ts` |
| Zmienne i funkcje | camelCase | `getStudentById` |
| Stałe | UPPER_SNAKE_CASE | `JWT_SECRET` |
| Modele Prisma | PascalCase | `StudentEnrollment` |
| Endpointy REST | kebab-case | `/api/student-enrollments` |
| Klasy CSS (Tailwind) | utility classes inline | `className="flex items-center gap-2"` |

### Struktura komponentu React
```tsx
// 1. Importy (zewnętrzne → wewnętrzne → typy)
// 2. Typy/interfejsy propsów
// 3. Komponent (props destructuring)
// 4. Hooki (useState, useEffect, useQuery)
// 5. Handlery
// 6. Return JSX
```

### Serwisy backendowe
- Jeden serwis per moduł domenowy (np. `lessonService.ts`).
- Kontrolery są **cienkie** — tylko rozpakowanie requesta i wywołanie serwisu.
- Walidacja wejścia przez **Zod** w kontrolerze, przed wywołaniem serwisu.
- Logika biznesowa **wyłącznie w serwisach**.

### Obsługa błędów
- Backend: wszystkie błędy rzucaj przez `throw new Error(...)` lub Prisma errors — `errorHandler.ts` je łapie i formatuje response.
- Frontend: błędy API przez `errorUtils.ts` → `react-hot-toast` dla komunikatów użytkownikowi.
- Nigdy nie wyświetlaj surowych błędów technicznych użytkownikowi.

### Formularze (Frontend)
- Wszystkie formularze przez **React Hook Form** + `@hookform/resolvers` z Zod.
- Walidacja po stronie frontu musi pokrywać te same reguły co po stronie backendu.

---

## 5. Wzorce Projektowe

### Backend

#### Repository via Prisma
Brak osobnej warstwy repository — Prisma Client jest używany bezpośrednio w serwisach. Nie dodawaj abstrakcji repository, chyba że zadanie wyraźnie tego wymaga.

```typescript
// Wzorzec serwisu
export class LessonService {
  async getLessonById(id: string, organizationId: string) {
    return prisma.lesson.findFirst({
      where: { id, organizationId },
      include: { teacher: true, students: true }
    });
  }
}
```

#### Middleware Chain
```
Request → rateLimiter → auth (JWT) → requireRole() → controller → service → Prisma → response
```

#### Autoryzacja (RBAC)
```typescript
// W routes/*.ts — zawsze sprawdzaj rolę przed handlerem
router.get('/', authenticate, requireRole(['ADMIN', 'MANAGER']), controller.list);
```

#### Zadania cron (jobs/)
- Każde zadanie cron to osobny plik w `jobs/`.
- Zadania rejestrowane w `utils/scheduler.ts`.
- Nie uruchamiaj długich operacji synchronicznie — używaj async/await.

### Frontend

#### Server State: React Query
```typescript
// Wzorzec pobierania danych
const { data, isLoading, error } = useQuery({
  queryKey: ['students', organizationId],
  queryFn: () => studentService.getAll(organizationId),
  staleTime: 5 * 60 * 1000, // 5 minut
});
```

#### Client State: Zustand
- `authStore` — token JWT, dane usera, organizacja. Trwały (localStorage).
- `sidebarStore` — stan UI (otwarty/zamknięty sidebar). Trwały (localStorage).
- Nie twórz nowych store'ów bez wyraźnej potrzeby. Preferuj React Query dla danych serwerowych.

#### Axios Interceptory (lib/api.ts)
- Token jest wstrzykiwany automatycznie przez interceptor.
- 401 → automatyczny redirect do `/login`.
- Nigdy nie ustawiaj headera `Authorization` ręcznie w serwisach.

#### Serwisy API (services/)
```typescript
// Wzorzec serwisu frontendowego
export const lessonService = {
  getAll: (params: LessonFilters) => api.get('/lessons', { params }),
  getById: (id: string) => api.get(`/lessons/${id}`),
  create: (data: CreateLessonDto) => api.post('/lessons', data),
  update: (id: string, data: UpdateLessonDto) => api.put(`/lessons/${id}`, data),
  delete: (id: string) => api.delete(`/lessons/${id}`),
};
```

#### Komponenty UI (shadcn/ui)
- Używaj komponentów z `shadcn/ui` (Button, Dialog, Input, Select, Table, itp.).
- Nie twórz własnych prymitywów UI — rozszerzaj istniejące.
- Ikony z `lucide-react`.

---

## 6. Baza Danych

### Najważniejsze relacje
```
Organization
  ├── Users (many-to-many przez role)
  ├── Teachers (one-to-many)
  ├── Students (one-to-many)
  ├── Courses (one-to-many)
  │   └── Lessons (one-to-many)
  │       └── LessonAttendance (one-to-many)
  └── Payments (one-to-many)

Student
  ├── StudentEnrollment → Course
  ├── StudentBudget
  ├── Payment
  ├── Alert
  └── Notification

Teacher
  ├── Lesson (many-to-many)
  ├── TeacherPayout
  └── Substitution
```

### Zasady pracy ze schematem
- Zmiany schematu **zawsze** przez migrację (`prisma migrate dev`), nigdy przez ręczne SQL.
- Soft delete dla uczniów: pole `deletedAt` (timestamp) zamiast fizycznego usunięcia rekordu.
- Multi-tenant: **każde** zapytanie musi filtrować po `organizationId`.
- Enum values w Prisma są pisane `UPPER_SNAKE_CASE` (np. `LessonStatus.COMPLETED`).

---

## 7. API — Konwencje

### Struktura endpointów
```
GET    /api/{resource}          # Lista zasobów
GET    /api/{resource}/:id      # Pojedynczy zasób
POST   /api/{resource}          # Tworzenie
PUT    /api/{resource}/:id      # Aktualizacja (pełna)
PATCH  /api/{resource}/:id      # Aktualizacja (częściowa)
DELETE /api/{resource}/:id      # Usunięcie
```

### Format odpowiedzi
```json
// Sukces
{ "data": {...}, "message": "..." }

// Błąd
{ "error": "Opis błędu po polsku", "details": [...] }
```

### Autoryzacja
Wszystkie endpointy (poza `/api/auth/*` i `/api/applications/public/*`) wymagają:
```
Authorization: Bearer <jwt_token>
```

---

## 8. Bezpieczeństwo — Kluczowe zasady

- Nigdy nie zwracaj hasła ani tokenu JWT w odpowiedzi API.
- Wszystkie zapytania do bazy muszą zawierać `organizationId` z tokenu JWT (nie z body requesta).
- Validacja Zod przed każdą operacją zapisu.
- Pliki uploady: obsługiwane przez Multer + przechowywane w Supabase Storage (nie lokalnie).
- Rate limiting: 500 req/15min globalnie, niższy dla endpointów `/auth`.

---

## 9. Znane pułapki i specyfika projektu

1. **`moment` vs `date-fns`**: W projekcie współistnieją oba. W nowym kodzie używaj `date-fns`. `moment` jest w kilku starszych komponentach kalendarza.

2. **Wielowalutowość**: Płatności są przechowywane w walucie oryginalnej. Przeliczanie przez `ExchangeRate`. Przy dodawaniu nowej logiki finansowej zawsze uwzględniaj walutę.

3. **Cron jobs**: Uruchamiane automatycznie przy starcie serwera (w `index.ts`). W środowisku developerskim mogą powodować niezamierzone emaile do użytkowników testowych.

4. **Google Gemini w imporcie CSV**: Mapowanie kolumn jest nieterministyczne. Zawsze zwracaj podgląd do zatwierdzenia przez użytkownika przed zapisem.

5. **Supabase Storage**: Bucket inicjalizowany przy starcie przez `supabase.ts`. Przed dodaniem nowego typu pliku sprawdź, czy bucket już istnieje.

6. **Soft delete uczniów**: Filtruj `deletedAt: null` we wszystkich zapytaniach do `Student`. Prisma nie robi tego automatycznie.

7. **Multi-tenant isolation**: `organizationId` **zawsze** pochodzi z `req.user.organizationId` (z JWT), nigdy z parametrów requesta.
