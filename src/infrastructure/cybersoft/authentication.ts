import axios from "axios";
import { z } from "zod";
import type { RuntimeConfig } from "../../app/runtime-config";
import type {
  AuthenticationCapability,
  RegistrationInput,
} from "../../features/authentication/wiring";
import { AuthenticationFailure } from "../../features/authentication/wiring";

const signInResponseSchema = z.object({
  content: z.object({
    token: z.string().min(1),
    user: z.object({
      id: z.union([z.string(), z.number()]),
      name: z.string(),
      email: z.email(),
      role: z.string().nullable().optional(),
      avatar: z.string().nullable().optional(),
    }),
  }),
});

const registrationResponseSchema = z.object({
  content: z.object({
    id: z.union([z.string(), z.number()]),
    name: z.string(),
    email: z.email(),
  }),
});

export function createCybersoftAuthenticationCapability(
  config: RuntimeConfig,
): AuthenticationCapability {
  const client = axios.create({
    baseURL: config.apiBaseUrl,
    headers: { tokenCybersoft: config.cybersoftToken },
  });

  return {
    async register(input: RegistrationInput, signal?: AbortSignal) {
      try {
        const response = await client.post("/auth/signup", input, { signal });
        registrationResponseSchema.parse(response.data);
      } catch (error) {
        if (
          axios.isAxiosError(error) &&
          (error.response?.status === 400 || error.response?.status === 409)
        ) {
          throw new AuthenticationFailure("duplicate-email");
        }
        throw mapAuthenticationFailure(error);
      }
    },
    async signIn(input, signal) {
      try {
        const response = await client.post("/auth/signin", input, { signal });
        const result = signInResponseSchema.parse(response.data);
        return {
          token: result.content.token,
          user: {
            id: String(result.content.user.id),
            name: result.content.user.name,
            email: result.content.user.email,
            role: result.content.user.role ?? null,
            avatar: result.content.user.avatar ?? null,
          },
        };
      } catch (error) {
        throw mapAuthenticationFailure(error);
      }
    },
  };
}

function mapAuthenticationFailure(error: unknown) {
  if (error instanceof z.ZodError) {
    return new AuthenticationFailure("malformed");
  }
  if (axios.isAxiosError(error)) {
    if (error.response?.status === 401) {
      return new AuthenticationFailure("invalid-credentials");
    }
    if (error.response && error.response.status >= 500) {
      return new AuthenticationFailure("server");
    }
    if (!error.response) {
      return new AuthenticationFailure(navigator.onLine ? "network" : "offline");
    }
  }
  return new AuthenticationFailure("unknown");
}
