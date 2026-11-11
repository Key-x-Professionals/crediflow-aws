/** Configuración pública del frontend: TODO se lee de variables NEXT_PUBLIC_* */
export const config = {
  apiUrl: (process.env.NEXT_PUBLIC_API_URL ?? '').replace(/\/$/, ''),
  precalUrl: (process.env.NEXT_PUBLIC_PRECAL_URL ?? '').replace(/\/$/, ''),
  region: process.env.NEXT_PUBLIC_AWS_REGION ?? 'us-east-1',
  userPoolId: process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID ?? '',
  clientId: process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID ?? '',
  student: process.env.NEXT_PUBLIC_STUDENT ?? 'local',
};

export const hasApi = () => config.apiUrl.length > 0;
export const hasPrecal = () => config.precalUrl.length > 0;
export const hasCognito = () => config.userPoolId.length > 0 && config.clientId.length > 0;
