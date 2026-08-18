import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { delay, http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { renderTestApplication } from "../../test/render-application";
import { server } from "../../test/server";

describe("authentication routes", () => {
  it("registers a User and continues to Login without creating a Session", async () => {
    const user = userEvent.setup();
    renderTestApplication("/register");

    await user.type(screen.getByRole("textbox", { name: "Full name" }), "  Alex Morgan  ");
    await user.type(screen.getByRole("textbox", { name: "Email" }), "ALEX@EXAMPLE.COM");
    await user.type(screen.getByLabelText("Password", { selector: "input" }), "secret1");
    await user.type(screen.getByLabelText("Confirm password"), "secret1");
    await user.type(screen.getByRole("textbox", { name: "Phone" }), "+84 90-123-4567");
    await user.click(screen.getByRole("button", { name: "Create account" }));

    expect(await screen.findByRole("heading", { name: "Login" })).toBeVisible();
    expect(screen.getByRole("status")).toHaveTextContent(
      "Your account was created. Sign in to continue.",
    );
    expect(screen.getByRole("textbox", { name: "Email" })).toHaveValue("alex@example.com");
    expect(localStorage.getItem("token")).toBeNull();
  });

  it("explains every invalid registration field and focuses the first one", async () => {
    const user = userEvent.setup();
    renderTestApplication("/register");

    await user.type(screen.getByRole("textbox", { name: "Full name" }), "A");
    await user.type(screen.getByRole("textbox", { name: "Email" }), "not-an-email");
    await user.type(screen.getByLabelText("Password", { selector: "input" }), "123");
    await user.type(screen.getByLabelText("Confirm password"), "different");
    await user.type(screen.getByRole("textbox", { name: "Phone" }), "12-34");
    await user.click(screen.getByRole("button", { name: "Create account" }));

    expect(screen.getByRole("textbox", { name: "Full name" })).toHaveFocus();
    expect(screen.getByText("Full name must contain 2–50 characters.")).toBeVisible();
    expect(screen.getByText("Enter a valid email address.")).toBeVisible();
    expect(screen.getByText("Password must contain at least 6 characters.")).toBeVisible();
    expect(screen.getByText("Passwords must match.")).toBeVisible();
    expect(screen.getByText("Phone must contain 9–15 digits.")).toBeVisible();
    expect(screen.getByRole("heading", { name: "Create your account" })).toBeVisible();
  });

  it("attaches a duplicate registration email failure to Email", async () => {
    server.use(
      http.post("http://api.example.test/api/auth/signup", () =>
        HttpResponse.json({ content: "Email already exists" }, { status: 409 }),
      ),
    );
    const user = userEvent.setup();
    renderTestApplication("/register");

    await user.type(screen.getByRole("textbox", { name: "Full name" }), "Alex Morgan");
    await user.type(screen.getByRole("textbox", { name: "Email" }), "alex@example.com");
    await user.type(screen.getByLabelText("Password", { selector: "input" }), "secret1");
    await user.type(screen.getByLabelText("Confirm password"), "secret1");
    await user.type(screen.getByRole("textbox", { name: "Phone" }), "+84901234567");
    await user.click(screen.getByRole("button", { name: "Create account" }));

    expect(await screen.findByText("An account cannot be created with this email.")).toBeVisible();
    expect(screen.getByRole("textbox", { name: "Email" })).toHaveFocus();
    expect(screen.getByRole("textbox", { name: "Full name" })).toHaveValue("Alex Morgan");
  });

  it("keeps registration recoverable when the server is unavailable", async () => {
    server.use(
      http.post(
        "http://api.example.test/api/auth/signup",
        () => new HttpResponse(null, { status: 503 }),
      ),
    );
    const user = userEvent.setup();
    renderTestApplication("/register");

    await user.type(screen.getByRole("textbox", { name: "Full name" }), "Alex Morgan");
    await user.type(screen.getByRole("textbox", { name: "Email" }), "alex@example.com");
    await user.type(screen.getByLabelText("Password", { selector: "input" }), "secret1");
    await user.type(screen.getByLabelText("Confirm password"), "secret1");
    await user.type(screen.getByRole("textbox", { name: "Phone" }), "+84901234567");
    await user.click(screen.getByRole("button", { name: "Create account" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Account creation is temporarily unavailable. Try again.",
    );
    expect(screen.getByRole("button", { name: "Create account" })).toBeEnabled();
    expect(screen.getByRole("textbox", { name: "Email" })).toHaveValue("alex@example.com");
  });

  it("does not treat a malformed registration response as success", async () => {
    server.use(
      http.post("http://api.example.test/api/auth/signup", () =>
        HttpResponse.json({ content: "unexpected" }),
      ),
    );
    const user = userEvent.setup();
    renderTestApplication("/register");

    await user.type(screen.getByRole("textbox", { name: "Full name" }), "Alex Morgan");
    await user.type(screen.getByRole("textbox", { name: "Email" }), "alex@example.com");
    await user.type(screen.getByLabelText("Password", { selector: "input" }), "secret1");
    await user.type(screen.getByLabelText("Confirm password"), "secret1");
    await user.type(screen.getByRole("textbox", { name: "Phone" }), "+84901234567");
    await user.click(screen.getByRole("button", { name: "Create account" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Account creation returned an unsafe response. Try again later.",
    );
    expect(screen.getByRole("heading", { name: "Create your account" })).toBeVisible();
  });

  it("signs in and resumes a safe internal destination", async () => {
    const user = userEvent.setup();
    renderTestApplication("/login?returnTo=%2Fjobs");

    await user.type(screen.getByRole("textbox", { name: "Email" }), "alex@example.com");
    await user.type(screen.getByLabelText("Password", { selector: "input" }), "secret1");
    await user.click(screen.getByRole("button", { name: "Login" }));

    expect(await screen.findByRole("heading", { name: "Danh sách công việc" })).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Open your account menu" }));
    expect(screen.getByRole("menuitem", { name: "Logout" })).toBeVisible();
    expect(localStorage.getItem("token")).toBeNull();
  });

  it("reports invalid credentials without disclosing which field was wrong", async () => {
    server.use(
      http.post("http://api.example.test/api/auth/signin", () =>
        HttpResponse.json({ content: "Email is not found" }, { status: 401 }),
      ),
    );
    const user = userEvent.setup();
    renderTestApplication("/login");

    await user.type(screen.getByRole("textbox", { name: "Email" }), "alex@example.com");
    await user.type(screen.getByLabelText("Password", { selector: "input" }), "incorrect");
    await user.click(screen.getByRole("button", { name: "Login" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "We could not sign you in with those credentials.",
    );
    expect(screen.getByRole("heading", { name: "Login" })).toBeVisible();
  });

  it("keeps Login recoverable when the User is offline", async () => {
    Object.defineProperty(navigator, "onLine", { configurable: true, value: false });
    server.use(http.post("http://api.example.test/api/auth/signin", () => HttpResponse.error()));
    const user = userEvent.setup();
    renderTestApplication("/login");

    await user.type(screen.getByRole("textbox", { name: "Email" }), "alex@example.com");
    await user.type(screen.getByLabelText("Password", { selector: "input" }), "secret1");
    await user.click(screen.getByRole("button", { name: "Login" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "You are offline. Reconnect, then try again.",
    );
    expect(screen.getByRole("button", { name: "Login" })).toBeEnabled();
    expect(screen.getByRole("textbox", { name: "Email" })).toHaveValue("alex@example.com");
  });

  it("validates Login before sending credentials", async () => {
    const user = userEvent.setup();
    renderTestApplication("/login");

    await user.type(screen.getByRole("textbox", { name: "Email" }), "not-an-email");
    await user.click(screen.getByRole("button", { name: "Login" }));

    expect(screen.getByRole("textbox", { name: "Email" })).toHaveFocus();
    expect(screen.getByText("Enter a valid email address.")).toBeVisible();
    expect(screen.getByText("Enter your password.")).toBeVisible();
    expect(screen.getByRole("heading", { name: "Login" })).toBeVisible();
  });

  it("blocks duplicate Login submissions while the request is pending", async () => {
    server.use(
      http.post("http://api.example.test/api/auth/signin", async () => {
        await delay("infinite");
        return HttpResponse.json({});
      }),
    );
    const user = userEvent.setup();
    renderTestApplication("/login");

    await user.type(screen.getByRole("textbox", { name: "Email" }), "alex@example.com");
    await user.type(screen.getByLabelText("Password", { selector: "input" }), "secret1");
    await user.click(screen.getByRole("button", { name: "Login" }));

    expect(await screen.findByRole("button", { name: "Signing in..." })).toBeDisabled();
    expect(screen.getByRole("textbox", { name: "Email" })).toBeDisabled();
  });

  it("does not create a Session from a malformed sign-in response", async () => {
    server.use(
      http.post("http://api.example.test/api/auth/signin", () =>
        HttpResponse.json({ content: { token: "unsafe", user: { password: "exposed" } } }),
      ),
    );
    const user = userEvent.setup();
    renderTestApplication("/login");

    await user.type(screen.getByRole("textbox", { name: "Email" }), "alex@example.com");
    await user.type(screen.getByLabelText("Password", { selector: "input" }), "secret1");
    await user.click(screen.getByRole("button", { name: "Login" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Login returned an unsafe response. Try again later.",
    );
    expect(screen.queryByRole("button", { name: "Logout" })).not.toBeInTheDocument();
  });

  it("falls back to Home for an external return destination", async () => {
    const user = userEvent.setup();
    renderTestApplication("/login?returnTo=https%3A%2F%2Fevil.example");

    await user.type(screen.getByRole("textbox", { name: "Email" }), "alex@example.com");
    await user.type(screen.getByLabelText("Password", { selector: "input" }), "secret1");
    await user.click(screen.getByRole("button", { name: "Login" }));

    expect(
      await screen.findByRole("heading", {
        name: "Find the perfect freelance services for your business",
      }),
    ).toBeVisible();
  });
});
