/** Borne les appels d'authentification pour éviter l'expiration Vercel. */
export const fetchAuth: typeof fetch = (input, init) => {
  const limite = AbortSignal.timeout(5000);
  const signal = init?.signal ? AbortSignal.any([init.signal, limite]) : limite;
  return fetch(input, { ...init, signal });
};
