/**
 * Utility functions for handling API validation errors
 * Extracts field-level errors from the standardized backend error format
 */

export interface ValidationErrorDetail {
  field: string;
  message: string;
  code: string;
  expected?: string;
  received?: string;
}

export interface ApiValidationError {
  code: 'VALIDATION_ERROR';
  message: string;
  errors: ValidationErrorDetail[];
}

/**
 * Extracts the error message from an API error response.
 * Supports both the new structured format and legacy formats.
 */
export function getErrorMessage(error: any, fallback: string): string {
  if (!error?.response?.data) return fallback;

  const data = error.response.data;

  // New format: { error: { code, message, errors[] } }
  if (data.error?.message) return data.error.message;

  // Legacy format: { message: '...' }
  if (data.message) return data.message;

  return fallback;
}

/**
 * Extracts field-level validation errors from API response.
 * Returns a Record<string, string> mapping field names to error messages,
 * compatible with the existing `errors` state in form components.
 */
/**
 * Maps Polish field names (from backend) back to form field keys
 */
const polishFieldToKey: Record<string, string> = {
  'Email': 'email',
  'Imię': 'firstName',
  'Nazwisko': 'lastName',
  'Hasło': 'password',
  'Telefon': 'phone',
};

export function getFieldErrors(error: any): Record<string, string> {
  const fieldErrors: Record<string, string> = {};

  const errorData = error?.response?.data?.error;

  if (errorData?.code === 'VALIDATION_ERROR' && Array.isArray(errorData.errors)) {
    for (const err of (errorData as ApiValidationError).errors) {
      if (err.field && err.field !== 'unknown') {
        // Use the first segment of dotted paths (e.g. "address.street" -> "address")
        const fieldKey = err.field.split('.')[0];
        if (!fieldErrors[fieldKey]) {
          fieldErrors[fieldKey] = err.message;
        }
      }
    }
  }

  // Handle DUPLICATE_ENTRY errors (e.g. unique email constraint from Prisma)
  if (errorData?.code === 'DUPLICATE_ENTRY' && errorData?.field) {
    const fieldKey = polishFieldToKey[errorData.field] || errorData.field;
    fieldErrors[fieldKey] = errorData.message;
  }

  // Handle DUPLICATE_EMAIL errors (manual check in service)
  if (errorData?.code === 'DUPLICATE_EMAIL') {
    fieldErrors['email'] = errorData.message;
  }

  return fieldErrors;
}

/**
 * Handles an API error by extracting both field-level and form-level errors.
 * Returns an object with field errors and a general message for toast display.
 */
export function handleApiError(
  error: any,
  fallbackMessage: string
): { fieldErrors: Record<string, string>; message: string } {
  const fieldErrors = getFieldErrors(error);
  const message = getErrorMessage(error, fallbackMessage);

  // If we have field-level errors, include the general message as form-level error
  if (Object.keys(fieldErrors).length > 0) {
    return { fieldErrors, message };
  }

  // No field-level errors - return form-level error only
  return { fieldErrors: { form: message }, message };
}
