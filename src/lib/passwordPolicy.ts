/** Minimum password length enforced client-side and in edge functions. */
export const MIN_PASSWORD_LENGTH = 12;

export const MAX_PASSWORD_LENGTH = 128;

export function validatePasswordLength(password: string): boolean {
  return (
    typeof password === 'string' &&
    password.length >= MIN_PASSWORD_LENGTH &&
    password.length <= MAX_PASSWORD_LENGTH
  );
}

export const PASSWORD_LENGTH_HINT = `Le mot de passe doit contenir entre ${MIN_PASSWORD_LENGTH} et ${MAX_PASSWORD_LENGTH} caractères`;
