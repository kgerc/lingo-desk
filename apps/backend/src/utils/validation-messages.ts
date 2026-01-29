/**
 * Centralized validation messages for the application
 * All messages are in Polish (default language)
 * Prepared for future i18n support
 */

import { z } from 'zod';

// ============================================
// VALIDATION MESSAGE TEMPLATES
// ============================================

export const messages = {
  // Required fields
  required: (field: string) => `Pole "${field}" jest wymagane`,

  // String validation
  string: {
    min: (field: string, min: number) => `Pole "${field}" musi mieć minimum ${min} ${getPolishCharacterWord(min)}`,
    max: (field: string, max: number) => `Pole "${field}" może mieć maksymalnie ${max} ${getPolishCharacterWord(max)}`,
    length: (field: string, len: number) => `Pole "${field}" musi mieć dokładnie ${len} ${getPolishCharacterWord(len)}`,
    email: (field: string) => `Pole "${field}" musi zawierać poprawny adres email`,
    url: (field: string) => `Pole "${field}" musi zawierać poprawny adres URL`,
    uuid: (field: string) => `Pole "${field}" musi zawierać poprawny identyfikator UUID`,
    regex: (field: string, pattern: string) => `Pole "${field}" ma nieprawidłowy format. Oczekiwany wzorzec: ${pattern}`,
    nonempty: (field: string) => `Pole "${field}" nie może być puste`,
  },

  // Number validation
  number: {
    min: (field: string, min: number) => `Pole "${field}" musi być większe lub równe ${min}`,
    max: (field: string, max: number) => `Pole "${field}" musi być mniejsze lub równe ${max}`,
    positive: (field: string) => `Pole "${field}" musi być liczbą dodatnią`,
    negative: (field: string) => `Pole "${field}" musi być liczbą ujemną`,
    int: (field: string) => `Pole "${field}" musi być liczbą całkowitą`,
    nonnegative: (field: string) => `Pole "${field}" musi być liczbą nieujemną (0 lub większą)`,
  },

  // Date validation
  date: {
    invalid: (field: string) => `Pole "${field}" musi zawierać poprawną datę`,
    future: (field: string) => `Pole "${field}" musi być datą w przyszłości`,
    past: (field: string) => `Pole "${field}" musi być datą w przeszłości`,
    min: (field: string, min: string) => `Pole "${field}" nie może być wcześniejsze niż ${min}`,
    max: (field: string, max: string) => `Pole "${field}" nie może być późniejsze niż ${max}`,
  },

  // Enum validation
  enum: {
    invalid: (field: string, options: string[]) =>
      `Pole "${field}" musi być jedną z wartości: ${options.join(', ')}`,
  },

  // Array validation
  array: {
    min: (field: string, min: number) => `Pole "${field}" musi zawierać minimum ${min} ${getPolishElementWord(min)}`,
    max: (field: string, max: number) => `Pole "${field}" może zawierać maksymalnie ${max} ${getPolishElementWord(max)}`,
    nonempty: (field: string) => `Pole "${field}" musi zawierać przynajmniej jeden element`,
  },

  // Boolean validation
  boolean: {
    invalid: (field: string) => `Pole "${field}" musi być wartością logiczną (tak/nie)`,
  },

  // Custom business rules
  business: {
    duplicateEmail: 'Użytkownik z tym adresem email już istnieje',
    duplicatePhone: 'Użytkownik z tym numerem telefonu już istnieje',
    invalidCredentials: 'Nieprawidłowy email lub hasło',
    accountInactive: 'Konto jest nieaktywne. Skontaktuj się z administratorem',
    unauthorized: 'Brak uprawnień do wykonania tej operacji',
    notFound: (entity: string) => `Nie znaleziono: ${entity}`,
    alreadyExists: (entity: string) => `${entity} już istnieje`,
    cannotDelete: (entity: string, reason: string) => `Nie można usunąć ${entity}: ${reason}`,
    invalidReference: (field: string) => `Nieprawidłowe odniesienie w polu "${field}" - rekord nie istnieje`,
    conflictingSchedule: 'Wykryto konflikt w harmonogramie - wybrana godzina jest już zajęta',
    insufficientBalance: 'Niewystarczające saldo na koncie ucznia',
    pastDate: (field: string) => `Pole "${field}" nie może być datą z przeszłości`,
  },

  // API/System errors
  system: {
    internalError: 'Wystąpił błąd wewnętrzny. Spróbuj ponownie później',
    validationFailed: 'Walidacja nie powiodła się. Sprawdź wprowadzone dane',
    networkError: 'Błąd połączenia z serwerem',
    timeout: 'Przekroczono limit czasu żądania',
    unauthorized: 'Sesja wygasła. Zaloguj się ponownie',
    forbidden: 'Brak uprawnień do wykonania tej operacji',
  },
};

// ============================================
// POLISH GRAMMAR HELPERS
// ============================================

function getPolishCharacterWord(count: number): string {
  if (count === 1) return 'znak';
  if (count >= 2 && count <= 4) return 'znaki';
  if (count >= 5 && count <= 21) return 'znaków';
  const lastDigit = count % 10;
  const lastTwoDigits = count % 100;
  if (lastTwoDigits >= 12 && lastTwoDigits <= 14) return 'znaków';
  if (lastDigit >= 2 && lastDigit <= 4) return 'znaki';
  return 'znaków';
}

function getPolishElementWord(count: number): string {
  if (count === 1) return 'element';
  if (count >= 2 && count <= 4) return 'elementy';
  if (count >= 5 && count <= 21) return 'elementów';
  const lastDigit = count % 10;
  const lastTwoDigits = count % 100;
  if (lastTwoDigits >= 12 && lastTwoDigits <= 14) return 'elementów';
  if (lastDigit >= 2 && lastDigit <= 4) return 'elementy';
  return 'elementów';
}

// ============================================
// ZOD SCHEMA HELPERS WITH POLISH MESSAGES
// ============================================

/**
 * Creates a required string field with Polish validation messages
 */
export function requiredString(fieldName: string, options?: { min?: number; max?: number }) {
  let schema = z.string({
    required_error: messages.required(fieldName),
    invalid_type_error: messages.required(fieldName),
  });

  if (options?.min !== undefined) {
    schema = schema.min(options.min, { message: messages.string.min(fieldName, options.min) });
  }
  if (options?.max !== undefined) {
    schema = schema.max(options.max, { message: messages.string.max(fieldName, options.max) });
  }

  return schema;
}

/**
 * Creates an optional string field with Polish validation messages
 */
export function optionalString(fieldName: string, options?: { min?: number; max?: number }) {
  let schema = z.string({
    invalid_type_error: `Pole "${fieldName}" musi być tekstem`,
  });

  if (options?.min !== undefined) {
    schema = schema.min(options.min, { message: messages.string.min(fieldName, options.min) });
  }
  if (options?.max !== undefined) {
    schema = schema.max(options.max, { message: messages.string.max(fieldName, options.max) });
  }

  return schema.optional();
}

/**
 * Creates a required email field with Polish validation messages
 */
export function requiredEmail(fieldName: string = 'Email') {
  return z.string({
    required_error: messages.required(fieldName),
    invalid_type_error: messages.required(fieldName),
  }).email({ message: messages.string.email(fieldName) });
}

/**
 * Creates an optional email field with Polish validation messages
 */
export function optionalEmail(fieldName: string = 'Email') {
  return z.string()
    .email({ message: messages.string.email(fieldName) })
    .optional()
    .or(z.literal(''));
}

/**
 * Creates a required UUID field with Polish validation messages
 */
export function requiredUuid(fieldName: string) {
  return z.string({
    required_error: messages.required(fieldName),
    invalid_type_error: messages.required(fieldName),
  }).uuid({ message: messages.string.uuid(fieldName) });
}

/**
 * Creates an optional UUID field with Polish validation messages
 */
export function optionalUuid(fieldName: string) {
  return z.string()
    .uuid({ message: messages.string.uuid(fieldName) })
    .optional();
}

/**
 * Creates a required positive integer field with Polish validation messages
 */
export function requiredPositiveInt(fieldName: string) {
  return z.number({
    required_error: messages.required(fieldName),
    invalid_type_error: `Pole "${fieldName}" musi być liczbą`,
  })
    .int({ message: messages.number.int(fieldName) })
    .positive({ message: messages.number.positive(fieldName) });
}

/**
 * Creates an optional positive integer field with Polish validation messages
 */
export function optionalPositiveInt(fieldName: string) {
  return z.number({
    invalid_type_error: `Pole "${fieldName}" musi być liczbą`,
  })
    .int({ message: messages.number.int(fieldName) })
    .positive({ message: messages.number.positive(fieldName) })
    .optional();
}

/**
 * Creates a required non-negative number field with Polish validation messages
 */
export function requiredNonNegative(fieldName: string) {
  return z.number({
    required_error: messages.required(fieldName),
    invalid_type_error: `Pole "${fieldName}" musi być liczbą`,
  }).nonnegative({ message: messages.number.nonnegative(fieldName) });
}

/**
 * Creates an optional non-negative number field with Polish validation messages
 */
export function optionalNonNegative(fieldName: string) {
  return z.number({
    invalid_type_error: `Pole "${fieldName}" musi być liczbą`,
  }).nonnegative({ message: messages.number.nonnegative(fieldName) }).optional();
}

/**
 * Creates a required boolean field with Polish validation messages
 */
export function requiredBoolean(fieldName: string) {
  return z.boolean({
    required_error: messages.required(fieldName),
    invalid_type_error: messages.boolean.invalid(fieldName),
  });
}

/**
 * Creates an optional boolean field with Polish validation messages
 */
export function optionalBoolean(fieldName: string) {
  return z.boolean({
    invalid_type_error: messages.boolean.invalid(fieldName),
  }).optional();
}

/**
 * Creates a required enum field with Polish validation messages
 */
export function requiredEnum<T extends readonly [string, ...string[]]>(
  fieldName: string,
  values: T,
  valueLabels?: Record<T[number], string>
) {
  const displayValues = valueLabels
    ? values.map(v => valueLabels[v as T[number]] || v)
    : [...values];

  return z.enum(values, {
    required_error: messages.required(fieldName),
    invalid_type_error: messages.enum.invalid(fieldName, displayValues),
  });
}

/**
 * Creates an optional enum field with Polish validation messages
 */
export function optionalEnum<T extends readonly [string, ...string[]]>(
  fieldName: string,
  values: T,
  valueLabels?: Record<T[number], string>
) {
  const displayValues = valueLabels
    ? values.map(v => valueLabels[v as T[number]] || v)
    : [...values];

  return z.enum(values, {
    invalid_type_error: messages.enum.invalid(fieldName, displayValues),
  }).optional();
}

/**
 * Creates a required date string field that transforms to Date
 */
export function requiredDateString(fieldName: string) {
  return z.string({
    required_error: messages.required(fieldName),
    invalid_type_error: messages.required(fieldName),
  }).transform((str, ctx) => {
    const date = new Date(str);
    if (isNaN(date.getTime())) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: messages.date.invalid(fieldName),
      });
      return z.NEVER;
    }
    return date;
  });
}

/**
 * Creates an optional date string field that transforms to Date
 */
export function optionalDateString(fieldName: string) {
  return z.string()
    .optional()
    .transform((str, ctx) => {
      if (!str) return undefined;
      const date = new Date(str);
      if (isNaN(date.getTime())) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: messages.date.invalid(fieldName),
        });
        return z.NEVER;
      }
      return date;
    });
}

/**
 * Creates an optional URL field that treats empty string as undefined
 */
export function optionalUrl(fieldName: string) {
  return z.string()
    .optional()
    .transform((val) => {
      if (!val || val.trim() === '') return undefined;
      return val;
    })
    .pipe(z.string().url({ message: messages.string.url(fieldName) }).optional());
}

/**
 * Creates a required phone number field with Polish validation
 */
export function optionalPhone(fieldName: string = 'Telefon') {
  return z.string()
    .regex(/^[+]?[\d\s-]{9,15}$/, { message: `Pole "${fieldName}" musi zawierać poprawny numer telefonu` })
    .optional()
    .or(z.literal(''));
}

// ============================================
// COMMON FIELD SCHEMAS
// ============================================

export const commonFields = {
  // Identification
  id: requiredUuid('ID'),

  // User fields
  email: requiredEmail('Email'),
  password: requiredString('Hasło', { min: 6 }),
  firstName: requiredString('Imię', { min: 2, max: 50 }),
  lastName: requiredString('Nazwisko', { min: 2, max: 50 }),
  phone: optionalPhone('Telefon'),

  // Course/Lesson fields
  title: requiredString('Tytuł', { min: 2, max: 200 }),
  name: requiredString('Nazwa', { min: 2, max: 200 }),
  description: optionalString('Opis', { max: 2000 }),
  durationMinutes: requiredPositiveInt('Czas trwania'),
  pricePerLesson: requiredNonNegative('Cena za lekcję'),
  currency: requiredString('Waluta', { min: 3, max: 3 }).default('PLN'),

  // Date fields
  startDate: requiredDateString('Data rozpoczęcia'),
  endDate: optionalDateString('Data zakończenia'),
  scheduledAt: requiredDateString('Data i godzina'),

  // Enums
  deliveryMode: requiredEnum('Tryb prowadzenia', ['IN_PERSON', 'ONLINE', 'BOTH'] as const, {
    'IN_PERSON': 'Stacjonarnie',
    'ONLINE': 'Online',
    'BOTH': 'Hybrydowo',
  }),
  lessonDeliveryMode: requiredEnum('Tryb lekcji', ['IN_PERSON', 'ONLINE'] as const, {
    'IN_PERSON': 'Stacjonarnie',
    'ONLINE': 'Online',
  }),
  lessonStatus: requiredEnum('Status lekcji', ['SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'NO_SHOW'] as const, {
    'SCHEDULED': 'Zaplanowana',
    'IN_PROGRESS': 'W trakcie',
    'COMPLETED': 'Zakończona',
    'CANCELLED': 'Anulowana',
    'NO_SHOW': 'Nieobecność',
  }),
  courseType: requiredEnum('Typ kursu', ['GROUP', 'INDIVIDUAL'] as const, {
    'GROUP': 'Grupowy',
    'INDIVIDUAL': 'Indywidualny',
  }),
  languageLevel: requiredEnum('Poziom', ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const),
  paymentMethod: requiredEnum('Metoda płatności', ['STRIPE', 'CASH', 'BANK_TRANSFER'] as const, {
    'STRIPE': 'Stripe',
    'CASH': 'Gotówka',
    'BANK_TRANSFER': 'Przelew bankowy',
  }),
  paymentStatus: requiredEnum('Status płatności', ['PENDING', 'COMPLETED', 'FAILED', 'REFUNDED'] as const, {
    'PENDING': 'Oczekująca',
    'COMPLETED': 'Zakończona',
    'FAILED': 'Niepowodzenie',
    'REFUNDED': 'Zwrócona',
  }),
  contractType: requiredEnum('Typ umowy', ['B2B', 'EMPLOYMENT', 'CONTRACTOR'] as const, {
    'B2B': 'B2B',
    'EMPLOYMENT': 'Umowa o pracę',
    'CONTRACTOR': 'Zlecenie/Dzieło',
  }),
  paymentMode: requiredEnum('Tryb płatności', ['PACKAGE', 'PER_LESSON'] as const, {
    'PACKAGE': 'Pakiet',
    'PER_LESSON': 'Za lekcję',
  }),
  recurringFrequency: requiredEnum('Częstotliwość', ['WEEKLY', 'BIWEEKLY', 'MONTHLY'] as const, {
    'WEEKLY': 'Co tydzień',
    'BIWEEKLY': 'Co dwa tygodnie',
    'MONTHLY': 'Co miesiąc',
  }),
  attendanceStatus: requiredEnum('Status obecności', ['PRESENT', 'ABSENT', 'LATE', 'EXCUSED'] as const, {
    'PRESENT': 'Obecny',
    'ABSENT': 'Nieobecny',
    'LATE': 'Spóźniony',
    'EXCUSED': 'Usprawiedliwiony',
  }),
};

// ============================================
// ERROR FORMATTING FOR API RESPONSES
// ============================================

export interface ValidationErrorDetail {
  field: string;
  message: string;
  code: string;
  expected?: string;
  received?: string;
}

export interface FormattedValidationError {
  code: 'VALIDATION_ERROR';
  message: string;
  errors: ValidationErrorDetail[];
}

/**
 * Formats Zod errors into a standardized API response format
 */
export function formatZodErrors(error: z.ZodError): FormattedValidationError {
  const errors: ValidationErrorDetail[] = error.errors.map((err) => {
    const field = err.path.join('.');
    return {
      field: field || 'unknown',
      message: err.message,
      code: err.code,
      ...(err.code === 'invalid_type' && {
        expected: (err as any).expected,
        received: (err as any).received,
      }),
      ...(err.code === 'invalid_enum_value' && {
        expected: (err as any).options?.join(', '),
        received: (err as any).received,
      }),
    };
  });

  return {
    code: 'VALIDATION_ERROR',
    message: messages.system.validationFailed,
    errors,
  };
}

/**
 * Creates a standardized API error response
 */
export function createApiError(
  code: string,
  message: string,
  statusCode: number = 400,
  details?: any
): { statusCode: number; body: { error: { code: string; message: string; details?: any } } } {
  return {
    statusCode,
    body: {
      error: {
        code,
        message,
        ...(details && { details }),
      },
    },
  };
}
