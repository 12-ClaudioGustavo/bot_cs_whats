/**
 * URL base do Gateway API (backend Express).
 * Em desenvolvimento: http://localhost:3001
 * Em produção: definida em NEXT_PUBLIC_API_URL
 */
export const API_URL =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

/**
 * Wrapper de fetch que inclui automaticamente o cookie de sessão
 * e aponta sempre para o backend correto.
 */
export async function apiFetch(
  path: string,
  options: RequestInit = {}
): Promise<Response> {
  return fetch(`${API_URL}${path}`, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
}
