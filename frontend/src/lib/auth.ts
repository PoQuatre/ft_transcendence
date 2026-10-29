// Appels /api/auth/* et traduction des erreurs du backend (backend/internal/auth).

export type AuthResult =
  | { ok: true }
  | { ok: false; title: string; message: string };

export type LoginPayload = { email: string; password: string };
export type SignupPayload = LoginPayload & { username: string };
export type ProfilePayload = { username?: string; email?: string };
export type PasswordPayload = { currentPassword: string; newPassword: string };

// Règles de backend/internal/helpers/validator.go (password_complexity).
export const PASSWORD_RULES = [
  {
    id: 'len',
    label: '10-72 CARACTÈRES',
    test: (p: string) => p.length >= 10 && p.length <= 72,
  },
  { id: 'upper', label: 'UNE MAJUSCULE', test: (p: string) => /[A-Z]/.test(p) },
  { id: 'lower', label: 'UNE MINUSCULE', test: (p: string) => /[a-z]/.test(p) },
  { id: 'digit', label: 'UN CHIFFRE', test: (p: string) => /[0-9]/.test(p) },
  {
    id: 'special',
    label: 'UN CARACTÈRE SPÉCIAL',
    test: (p: string) => /[^A-Za-z0-9]/.test(p),
  },
] as const;

export const USERNAME_PATTERN = '[A-Za-z0-9_]{3,30}';

async function readMessage(res: Response): Promise<string> {
  try {
    const body: unknown = await res.json();
    if (
      body &&
      typeof body === 'object' &&
      'message' in body &&
      typeof body.message === 'string'
    ) {
      return body.message;
    }
  } catch {
    // Corps vide ou non JSON.
  }
  return '';
}

function toError(status: number, message: string): AuthResult {
  switch (message) {
    case 'invalid email or password':
      return {
        ok: false,
        title: 'Access denied',
        message: 'Email ou mot de passe invalide.',
      };
    case 'already logged in':
      return {
        ok: false,
        title: 'Already online',
        message: 'Tu es déjà connecté.',
      };
    case 'username already used':
      return {
        ok: false,
        title: 'Call-sign taken',
        message: "Ce nom d'utilisateur est déjà enregistré.",
      };
    case 'email already used':
      return {
        ok: false,
        title: 'Email taken',
        message: 'Cet email est déjà utilisé.',
      };
    case 'email or username already used':
      return {
        ok: false,
        title: 'Already enlisted',
        message: 'Cet email ou ce nom est déjà utilisé.',
      };
    case 'invalid password':
      return {
        ok: false,
        title: 'Access denied',
        message: 'Mot de passe actuel incorrect.',
      };
    default:
      if (status === 400) {
        return {
          ok: false,
          title: 'Invalid data',
          message: 'Vérifie les champs du formulaire.',
        };
      }
      if (status === 401) {
        return {
          ok: false,
          title: 'Access denied',
          message: 'Session expirée, reconnecte-toi.',
        };
      }
      // Route pas encore implémentée côté backend.
      if (status === 404 || status === 405) {
        return {
          ok: false,
          title: 'Module offline',
          message: "Cette fonction n'est pas encore disponible côté serveur.",
        };
      }
      return {
        ok: false,
        title: 'Uplink lost',
        message: 'Erreur serveur, réessaie plus tard.',
      };
  }
}

import { createRoot, createSignal } from 'solid-js';

export type AuthUser = { id: string; username: string; email: string };

// 1. Signal d'état global accessible par toute l'application (Header, Lobby, etc.)
// undefined : session pas encore vérifiée (SSR, ou getMe() en cours).
// null : vérifiée, personne n'est connecté.
export const [currentUser, setCurrentUser] = createRoot(() =>
  createSignal<AuthUser | null | undefined>(undefined),
);

type Method = 'POST' | 'PATCH' | 'PUT';

async function send(
  method: Method,
  path: string,
  payload: object,
): Promise<AuthResult> {
  try {
    const res = await fetch(path, {
      method,
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include', // Envoie et reçoit les cookies de session
      body: JSON.stringify(payload),
    });
    if (res.ok) return { ok: true };
    return toError(res.status, await readMessage(res));
  } catch {
    return {
      ok: false,
      title: 'Uplink lost',
      message: 'Impossible de joindre le serveur.',
    };
  }
}

const post = (path: string, payload: object) => send('POST', path, payload);

// Revérifie la session après l'échec d'une action réservée aux connectés.
// Si le backend l'a perdue (redémarrage, expiration), /me répond 401 et
// currentUser repasse à null : le header affiche LOG IN et les pages
// protégées renvoient au login. Serveur injoignable : on garde l'état connu.
async function refreshSession(): Promise<void> {
  try {
    const res = await fetch('/api/auth/me', { credentials: 'include' });
    if (res.status === 401) setCurrentUser(null);
    else if (res.ok) setCurrentUser((await res.json()) as AuthUser);
  } catch {
    // Hors ligne : rien ne prouve que la session est perdue.
  }
}

async function sendAuthenticated(
  method: Method,
  path: string,
  payload: object,
): Promise<AuthResult> {
  const result = await send(method, path, payload);
  if (!result.ok) await refreshSession();
  return result;
}

// 2. Récupération du profil connecté via /api/auth/me
export async function getMe(): Promise<AuthUser | null> {
  try {
    const res = await fetch('/api/auth/me', {
      credentials: 'include',
    });
    if (res.ok) {
      const user = (await res.json()) as AuthUser;
      setCurrentUser(user); // Met à jour le signal global
      return user;
    }
  } catch {
    // Non connecté ou indisponible
  }
  setCurrentUser(null);
  return null;
}

// 3. Login : synchronise immédiatement currentUser dès la réussite
export async function login(payload: LoginPayload): Promise<AuthResult> {
  const result = await post('/api/auth/login', payload);
  if (result.ok) {
    // Synchronise immédiatement la session dans l'app
    await getMe();
  }
  return result;
}

// 4. Signup : enchaîne login puis synchronise la session
export async function signup(payload: SignupPayload): Promise<AuthResult> {
  const created = await post('/api/auth/signup', payload);
  if (!created.ok) return created;
  return login({ email: payload.email, password: payload.password });
}

// 5. Logout
export async function logout(): Promise<void> {
  try {
    await fetch('/api/auth/logout', {
      method: 'POST',
      credentials: 'include',
    });
  } finally {
    setCurrentUser(null);
  }
}

// 6. Profil : PATCH /api/auth/me { username?, email? } -> 200 UserResponse,
// 400 validation, 409 "username already used" / "email already used".
// Resynchronise currentUser dès la réussite.
export async function updateProfile(
  payload: ProfilePayload,
): Promise<AuthResult> {
  const result = await sendAuthenticated('PATCH', '/api/auth/me', payload);
  if (result.ok) await getMe();
  return result;
}

// 7. Mot de passe (connecté) : POST /api/auth/change-password
// { oldpassword, newpassword } -> 200, 400 "invalid password" si l'ancien
// est faux, 400 validation (password_complexity).
export async function changePassword(
  payload: PasswordPayload,
): Promise<AuthResult> {
  return sendAuthenticated('POST', '/api/auth/change-password', {
    oldpassword: payload.currentPassword,
    newpassword: payload.newPassword,
  });
}
