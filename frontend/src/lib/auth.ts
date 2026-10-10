// Appels /api/auth/* et traduction des erreurs du backend (backend/internal/auth).

export type AuthResult =
  | { ok: true }
  | { ok: false; title: string; message: string };

export type LoginPayload = { email: string; password: string };
export type SignupPayload = LoginPayload & { username: string };

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
    default:
      return status === 400
        ? {
            ok: false,
            title: 'Invalid data',
            message: 'Vérifie les champs du formulaire.',
          }
        : {
            ok: false,
            title: 'Uplink lost',
            message: 'Erreur serveur, réessaie plus tard.',
          };
  }
}

async function post(path: string, payload: object): Promise<AuthResult> {
  try {
    const res = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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

export const login = (payload: LoginPayload) =>
  post('/api/auth/login', payload);

// Le backend ne connecte pas après l'inscription : on enchaîne un login.
export async function signup(payload: SignupPayload): Promise<AuthResult> {
  const created = await post('/api/auth/signup', payload);
  if (!created.ok) return created;
  return login({ email: payload.email, password: payload.password });
}
