export type AuthorizationFailureStatus = 401 | 403;

const listeners = new Set<(status: AuthorizationFailureStatus) => void>();

export function reportAuthorizationFailure(status: AuthorizationFailureStatus) {
  for (const listener of listeners) listener(status);
}

export function subscribeToAuthorizationFailures(
  listener: (status: AuthorizationFailureStatus) => void,
) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
