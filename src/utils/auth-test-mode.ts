/**
 * Modo prueba: permite correr E2E sin pasar por Auth0.
 *
 * Falla cerrado a proposito. Devuelve un usuario solo si:
 *   - AUTH_TEST_MODE === 'true'          (apagado por defecto)
 *   - NODE_ENV !== 'production'          (nunca en produccion, aunque la env este prendida)
 *   - AUTH_TEST_MODE_USER_ID esta seteado (sin id no hay usuario que suplantar)
 *
 * Cualquier otra combinacion devuelve null y el guard cae en la validacion
 * normal de JWT.
 */
export interface AuthTestModeUser {
  internalId: string;
  sub: string;
  email: string;
  name: string;
  picture: string | null;
  globalRole: string;
}

export function getAuthTestModeUser(): AuthTestModeUser | null {
  if (process.env.AUTH_TEST_MODE !== 'true') return null;

  if (process.env.NODE_ENV === 'production') {
    console.error(
      '[auth-test-mode] AUTH_TEST_MODE=true IGNORADO porque NODE_ENV=production',
    );
    return null;
  }

  const internalId = process.env.AUTH_TEST_MODE_USER_ID;
  if (!internalId) {
    console.error(
      '[auth-test-mode] AUTH_TEST_MODE=true pero falta AUTH_TEST_MODE_USER_ID; se exige JWT normal',
    );
    return null;
  }

  return {
    internalId,
    sub: 'auth-test-mode',
    email: process.env.AUTH_TEST_MODE_EMAIL ?? 'test-mode@local',
    name: 'Auth Test Mode',
    picture: null,
    globalRole: process.env.AUTH_TEST_MODE_ROLE ?? 'superadmin',
  };
}
