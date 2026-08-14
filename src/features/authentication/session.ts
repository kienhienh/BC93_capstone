import { useAuthenticationContext } from "./context";

export function useSession() {
  const { session, clearSession, acceptSession } = useAuthenticationContext();
  return { session, logout: clearSession, acceptSession };
}
