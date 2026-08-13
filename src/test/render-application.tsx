import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import App from "../App";
import { composeApplication, type ApplicationComposition } from "../app/composition";
import type { SessionStore } from "../features/authentication/wiring";

const activeCompositions = new Set<ApplicationComposition>();

export function renderTestApplication(path = "/", sessionStore?: SessionStore) {
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

  return render(
    <MemoryRouter initialEntries={[path]}>
      <App composition={composition} />
    </MemoryRouter>,
  );
}

export function resetTestApplications() {
  for (const composition of activeCompositions) {
    if (composition.ok) {
      composition.queryClient.clear();
    }
  }
  activeCompositions.clear();
}
