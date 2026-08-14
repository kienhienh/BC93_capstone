import { act, render } from "@testing-library/react";
import { MemoryRouter, useLocation, useNavigate, type NavigateFunction } from "react-router-dom";
import App from "../App";
import { composeApplication, type ApplicationComposition } from "../app/composition";
import type { SessionStore } from "../features/authentication/wiring";

const activeCompositions = new Set<ApplicationComposition>();

export function renderTestApplication(path = "/", sessionStore?: SessionStore) {
  let navigate: NavigateFunction | undefined;
  let currentLocation = path;
  function NavigationObserver() {
    navigate = useNavigate();
    const location = useLocation();
    currentLocation = location.pathname + location.search;
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
    composition.sessionStore = sessionStore ?? {
      read: () => null,
      save: () => undefined,
      clear: () => undefined,
      subscribe: () => () => undefined,
    };
  }

  const result = render(
    <MemoryRouter initialEntries={[path]}>
      <App composition={composition} />
      <NavigationObserver />
    </MemoryRouter>,
  );
  return Object.assign(result, {
    navigateHistory(delta: number) {
      act(() => navigate?.(delta));
    },
    currentLocation() {
      return currentLocation;
    },
  });
}

export function resetTestApplications() {
  for (const composition of activeCompositions) {
    if (composition.ok) {
      composition.queryClient.clear();
    }
  }
  activeCompositions.clear();
}
