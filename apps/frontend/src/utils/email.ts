/**
 * Returns the email address for display, or null if it's an auto-generated
 * placeholder (created during CSV import when the student had no email).
 */
export function displayEmail(email: string | null | undefined): string | null {
  if (!email) return null;
  if (email.endsWith('@placeholder.local')) return null;
  return email;
}
