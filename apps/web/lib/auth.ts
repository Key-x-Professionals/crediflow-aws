/**
 * Autenticación con Cognito desde el navegador (flujo USER_PASSWORD_AUTH).
 * El idToken se envía como "Authorization: Bearer <idToken>" a API Gateway.
 */
import {
  CognitoIdentityProviderClient,
  InitiateAuthCommand,
  RespondToAuthChallengeCommand,
} from '@aws-sdk/client-cognito-identity-provider';
import { config } from './config';

const STORAGE_KEY = 'crediflow.session';

export interface Session {
  email: string;
  idToken: string;
  expiresAt: number;
}

const client = () => new CognitoIdentityProviderClient({ region: config.region });

export async function login(email: string, password: string): Promise<Session> {
  const c = client();
  const res = await c.send(
    new InitiateAuthCommand({
      AuthFlow: 'USER_PASSWORD_AUTH',
      ClientId: config.clientId,
      AuthParameters: { USERNAME: email, PASSWORD: password },
    }),
  );

  let auth = res.AuthenticationResult;

  // Usuarios creados por CLI con contraseña temporal: se pide una definitiva
  if (res.ChallengeName === 'NEW_PASSWORD_REQUIRED') {
    const challenge = await c.send(
      new RespondToAuthChallengeCommand({
        ClientId: config.clientId,
        ChallengeName: 'NEW_PASSWORD_REQUIRED',
        Session: res.Session,
        ChallengeResponses: { USERNAME: email, NEW_PASSWORD: password },
      }),
    );
    auth = challenge.AuthenticationResult;
  }

  if (!auth?.IdToken) throw new Error('Cognito no devolvió un token');
  const session: Session = { email, idToken: auth.IdToken, expiresAt: Date.now() + (auth.ExpiresIn ?? 3600) * 1000 };
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  } catch {
    /* almacenamiento no disponible */
  }
  return session;
}

export function currentSession(): Session | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as Session;
    return s.expiresAt > Date.now() ? s : null;
  } catch {
    return null;
  }
}

export function logout(): void {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* noop */
  }
}
