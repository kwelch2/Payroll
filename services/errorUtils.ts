export function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) {
    return `${fallback} ${error.message}`;
  }
  if (typeof error === 'string' && error.trim() !== '') {
    return `${fallback} ${error}`;
  }
  return fallback;
}
