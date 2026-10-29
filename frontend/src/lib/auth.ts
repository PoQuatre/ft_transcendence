// Appels /api/auth/* et traduction des erreurs du backend (backend/internal/auth).

export type AuthResult =
  | { ok: true }
  | { ok: false; title: string; message: string };

export type LoginPayload = { email: string; password: string };
export type SignupPayload = LoginPayload & { username: string };
export type ProfilePayload = { username?: string; email?: string };
export type PasswordPayload = { currentPassword: string; newPassword: string };
export type ResetPayload = { password: string; token: string };

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
    case 'email already verified':
      return {
        ok: false,
        title: 'Already verified',
        message: 'Ton email est déjà vérifié.',
      };
    case 'invalid code':
      return {
        ok: false,
        title: 'Invalid code',
        message: 'Code incorrect, vérifie le mail reçu.',
      };
    case 'timeout':
      return {
        ok: false,
        title: 'Code expired',
        message: 'Code expiré, demande-en un nouveau.',
      };
    case 'mails are disabled':
      return {
        ok: false,
        title: 'Mail offline',
        message: "L'envoi d'emails est désactivé sur ce serveur.",
      };
    case 'invalid password':
      return {
        ok: false,
        title: 'Access denied',
        message: 'Mot de passe actuel incorrect.',
      };
    case 'invalid or expired token':
    case 'token expired':
      return {
        ok: false,
        title: 'Link expired',
        message: 'Ce lien est invalide ou a expiré. Demande un nouveau lien.',
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

// verified : absent tant que le backend ne gère pas la vérification d'email.
export type AuthUser = {
  id: string;
  username: string;
  email: string;
  verified?: boolean;
};

// 1. Signal d'état global accessible par toute l'application (Header, Lobby, etc.)
// undefined : session pas encore vérifiée (SSR, ou getMe() en cours).
// null : vérifiée, personne n'est connecté.
export const [currentUser, setCurrentUser] = createRoot(() =>
  createSignal<AuthUser | null | undefined>(undefined),
);

type Method = 'POST' | 'PATCH' | 'PUT';

// Réponse brute du backend, ou null si le serveur est injoignable.
type Reply = { ok: boolean; status: number; message: string };

async function call(
  method: Method,
  path: string,
  payload: object,
): Promise<Reply | null> {
  try {
    const res = await fetch(path, {
      method,
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include', // Envoie et reçoit les cookies de session
      body: JSON.stringify(payload),
    });
    if (res.ok) return { ok: true, status: res.status, message: '' };
    return { ok: false, status: res.status, message: await readMessage(res) };
  } catch {
    return null;
  }
}

function toResult(reply: Reply | null): AuthResult {
  if (!reply) {
    return {
      ok: false,
      title: 'Uplink lost',
      message: 'Impossible de joindre le serveur.',
    };
  }
  return reply.ok ? { ok: true } : toError(reply.status, reply.message);
}

async function send(
  method: Method,
  path: string,
  payload: object,
): Promise<AuthResult> {
  return toResult(await call(method, path, payload));
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

// 8. Vérification d'email, en deux temps et connecté. Le code fait 6 chiffres,
// vaut 10 minutes, et une nouvelle demande remplace l'ancien code.
// POST /api/auth/verify-email/request -> 200, 400 "email already verified".
// Sans envoi de mails côté serveur, la demande vérifie l'email directement :
// on relit le profil pour le savoir.
export type VerificationRequest =
  | { ok: true; verified: boolean }
  | Extract<AuthResult, { ok: false }>;

export async function requestEmailVerification(): Promise<VerificationRequest> {
  const result = await sendAuthenticated(
    'POST',
    '/api/auth/verify-email/request',
    {},
  );
  if (!result.ok) return result;
  const user = await getMe();
  return { ok: true, verified: user?.verified === true };
}

// POST /api/auth/verify-email/confirm { code } -> 200, 400 "invalid code" ou
// "timeout". Resynchronise currentUser dès la réussite.
export async function confirmEmailVerification(
  code: string,
): Promise<AuthResult> {
  const result = await sendAuthenticated(
    'POST',
    '/api/auth/verify-email/confirm',
    { code },
  );
  if (result.ok) await getMe();
  return result;
}

// 9. Mot de passe oublié (déconnecté) : POST /api/auth/forgot-password
// { email } -> 200 lien envoyé (valable 15 minutes), 404 "user not found",
// 400 "email not verified", 500 "mails are disabled". Compte inconnu ou non
// vérifié : même réponse qu'un envoi, pour ne pas révéler quels emails ont un
// compte. Un 404 sans ce message reste une route absente (Module offline).
const UNDISCLOSED = new Set(['user not found', 'email not verified']);

export async function requestPasswordReset(email: string): Promise<AuthResult> {
  const reply = await call('POST', '/api/auth/forgot-password', { email });
  if (reply && (reply.ok || UNDISCLOSED.has(reply.message))) {
    return { ok: true };
  }
  return toResult(reply);
}

// 10. Nouveau mot de passe depuis le lien du mail : POST
// /api/auth/reset-password { password, token } -> 200, 400 validation
// (password_complexity). Le jeton sert une seule fois. Jeton invalide ou
// expiré : le backend répond pour l'instant 500 sans message utile, qu'on
// présente comme un lien expiré.
export async function resetPassword(
  payload: ResetPayload,
): Promise<AuthResult> {
  const reply = await call('POST', '/api/auth/reset-password', payload);
  if (reply?.status === 500) {
    return toError(reply.status, 'invalid or expired token');
  }
  return toResult(reply);
}
