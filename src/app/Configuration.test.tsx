import { screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import App from "../App";
import { composeApplication } from "./composition";

describe("runtime configuration", () => {
  it("fails startup with a safe message when production configuration is missing", () => {
    const composition = composeApplication({ mode: "production", environment: {} });

    render(
      <MemoryRouter>
        <App composition={composition} />
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { name: "Application unavailable" })).toBeVisible();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Application configuration is unavailable.",
    );
    expect(document.body).not.toHaveTextContent("VITE_CYBERSOFT_TOKEN");
  });
});
