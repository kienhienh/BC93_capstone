import { useMutation } from "@tanstack/react-query";
import { useAuthenticationContext } from "./context";
import type { RegistrationInput, SignInInput } from "./capability";

export function useRegistration() {
  const { capability } = useAuthenticationContext();
  return useMutation({
    mutationFn: (input: RegistrationInput) => capability.register(input),
    retry: false,
  });
}

export function useSignIn() {
  const { capability, acceptSession } = useAuthenticationContext();
  return useMutation({
    mutationFn: (input: SignInInput) => capability.signIn(input),
    onSuccess: acceptSession,
    retry: false,
  });
}
