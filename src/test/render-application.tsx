import { act, render } from "@testing-library/react";
import { MemoryRouter, useLocation, useNavigate, type NavigateFunction } from "react-router-dom";
import App from "../App";
import { composeApplication, type ApplicationComposition } from "../app/composition";
import type { SessionStore } from "../features/authentication/wiring";

const activeCompositions = new Set<ApplicationComposition>();

type RenderTestApplicationOptions = {
  initialPath?: string;
  isAuthenticated?: boolean;
  isAdmin?: boolean;
  sessionStore?: SessionStore;
};

const encodeTokenPart = (value: object) =>
  btoa(JSON.stringify(value)).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");

function sessionStoreForRole(role: "USER" | "ADMIN"): SessionStore {
  return {
    read: () => ({
      token: `${encodeTokenPart({ alg: "none", typ: "JWT" })}.${encodeTokenPart({ exp: 4_102_444_800 })}.signature`,
      user: {
        id: role === "ADMIN" ? "900" : "700",
        name: role === "ADMIN" ? "Admin User" : "Regular User",
        email: role === "ADMIN" ? "admin@example.com" : "user@example.com",
        role,
        avatar: null,
      },
    }),
    save: () => undefined,
    clear: () => undefined,
    subscribe: () => () => undefined,
  };
}

export function renderTestApplication(
  pathOrOptions: string | RenderTestApplicationOptions = "/",
  suppliedSessionStore?: SessionStore,
) {
  const options = typeof pathOrOptions === "string"
    ? { initialPath: pathOrOptions, sessionStore: suppliedSessionStore }
    : pathOrOptions;
  const path = options.initialPath ?? "/";
  let navigate: NavigateFunction | undefined;
  let currentLocation = path;

  function NavigationObserver() {
    navigate = useNavigate();
    const location = useLocation();
    currentLocation = location.pathname + location.search + location.hash;
    return null;
  }

  const composition = composeApplication({
    mode: "production",
    environment: {
      VITE_API_BASE_URL: "http://api.example.test/api",
      VITE_CYBERSOFT_TOKEN: "deterministic-test-token",
    },
  });
  activeCompositions.add(composition);

  if (composition.ok) {
    if (options.sessionStore) composition.sessionStore = options.sessionStore;
    else if (typeof pathOrOptions !== "string" && options.isAuthenticated !== false) {
      composition.sessionStore = sessionStoreForRole(options.isAdmin ? "ADMIN" : "USER");
    } else {
      composition.sessionStore = {
        read: () => null,
        save: () => undefined,
        clear: () => undefined,
        subscribe: () => () => undefined,
      };
    }
  }

  const result = render(
    <MemoryRouter initialEntries={[path]}>
      <App composition={composition} />
      <NavigationObserver />
    </MemoryRouter>,
  );
  return Object.assign(result, {
    navigateHistory(delta: number) { act(() => navigate?.(delta)); },
    currentLocation() { return currentLocation; },
  });
}

export function resetTestApplications() {
  for (const composition of activeCompositions) if (composition.ok) composition.queryClient.clear();
  activeCompositions.clear();
}
