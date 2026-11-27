import {
  type AuthResult,
  requestAuthenticated,
  sendAuthenticated,
} from './auth';

// Une seule clé par compte. Le serveur n'en garde que l'empreinte et le
// préfixe : la clé complète n'est renvoyée qu'à sa création.
export type ApiKey = {
  prefix: string;
  created_at: string;
  last_used_at: string | null;
};

type Failure = Extract<AuthResult, { ok: false }>;

// GET /api/auth/api-key -> 200 ApiKey, 204 si le compte n'a pas de clé.
export async function getApiKey(): Promise<
  { ok: true; key: ApiKey | null } | Failure
> {
  const result = await requestAuthenticated('GET', '/api/auth/api-key');
  if (!result.ok) return result;
  return { ok: true, key: result.data as ApiKey | null };
}

// POST /api/auth/api-key -> 201 ApiKey & { key }. L'ancienne clé est révoquée.
export async function createApiKey(): Promise<
  { ok: true; key: ApiKey; secret: string } | Failure
> {
  const result = await requestAuthenticated('POST', '/api/auth/api-key', {});
  if (!result.ok) return result;
  const { key, ...info } = result.data as ApiKey & { key: string };
  return { ok: true, key: info, secret: key };
}

// DELETE /api/auth/api-key -> 204.
export const deleteApiKey = () =>
  sendAuthenticated('DELETE', '/api/auth/api-key', {});
