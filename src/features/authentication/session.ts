import { useAuthenticationContext } from "./context";

export function useSession() {
  const { session, clearSession } = useAuthenticationContext();
  return { session, logout: clearSession };
}
