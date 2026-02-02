export const API_BASE = '/api/v1';

interface ApiError {
  error: { code: string; message: string };
}

export class ApiRequestError extends Error {
  code?: string;

  constructor(message: string, code?: string) {
    super(message);
    this.name = 'ApiRequestError';
    this.code = code;
  }
}

export async function apiFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    let code: string | undefined;
    try {
      const body: ApiError = await response.json();
      if (body.error?.message) {
        message = body.error.message;
        code = body.error.code;
      }
    } catch {
      // Use default message
    }
    throw new ApiRequestError(message, code);
  }
  return response.json();
}
