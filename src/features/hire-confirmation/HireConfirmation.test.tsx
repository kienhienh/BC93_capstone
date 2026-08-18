import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { delay, http, HttpResponse } from "msw";
import { MemoryRouter, useNavigate } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import App from "../../App";
import { composeApplication } from "../../app/composition";
import { renderTestApplication } from "../../test/render-application";
import { server } from "../../test/server";
import type { SessionStore } from "../authentication/wiring";

const detailUrl = "http://api.example.test/api/cong-viec/lay-cong-viec-chi-tiet/42";
const hireUrl = "http://api.example.test/api/thue-cong-viec";
const hiredServicesUrl = "http://api.example.test/api/thue-cong-viec/lay-danh-sach-da-thue";

const encodeTokenPart = (value: object) =>
  btoa(JSON.stringify(value)).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");

function authenticatedSessionStore(userId = "700"): SessionStore {
  return {
    read: () => ({
      token: `${encodeTokenPart({ alg: "none", typ: "JWT" })}.${encodeTokenPart({ exp: 4_102_444_800 })}.signature`,
      user: {
        id: userId,
        name: "Alex Morgan",
        email: "alex@example.com",
        role: "USER",
        avatar: null,
      },
    }),
    save: () => undefined,
    clear: () => undefined,
    subscribe: () => () => undefined,
  };
}

function useViewport(width: number) {
  Object.defineProperty(window, "innerWidth", { configurable: true, value: width });
}

describe("routed Hire confirmation", () => {
  it("returns a Visitor from Login to a fresh confirmation without creating a Hire", async () => {
    let submissions = 0;
    server.use(
      http.get(detailUrl, () => HttpResponse.json({
        content: [{
          congViec: {
            id: 42,
            tenCongViec: "Accessible marketplace design",
            giaTien: 220,
            nguoiTao: 810,
            moTa: "A complete accessible marketplace experience.",
          },
          tenNguoiTao: "Alex Seller",
        }],
      })),
      http.post(hireUrl, () => {
        submissions += 1;
        return HttpResponse.json({ content: { id: 901 } }, { status: 201 });
      }),
    );
    const user = userEvent.setup();
    const application = renderTestApplication("/services/42/hire");

    expect(await screen.findByRole("heading", { name: "Login" })).toBeVisible();
    expect(application.currentLocation()).toBe("/login?returnTo=%2Fservices%2F42%2Fhire");

    await user.type(screen.getByRole("textbox", { name: "Email" }), "alex@example.com");
    await user.type(screen.getByLabelText("Password", { selector: "input" }), "secret1");
    await user.click(screen.getByRole("button", { name: "Login" }));

    expect(await screen.findByRole("heading", { name: "Confirm your Hire" })).toBeVisible();
    expect(application.currentLocation()).toBe("/services/42/hire");
    expect(screen.getByRole("button", { name: "Confirm Hire" })).toBeEnabled();
    expect(submissions).toBe(0);
  });

  it("shows a safe terminal state when the requested Service is missing", async () => {
    server.use(http.get(detailUrl, () => HttpResponse.json({ content: [] })));

    renderTestApplication("/services/42/hire", authenticatedSessionStore());

    expect(await screen.findByRole("heading", { name: "Service not found" })).toBeVisible();
    expect(screen.getByText("This Service is no longer available to hire.")).toBeVisible();
    expect(screen.queryByRole("button", { name: "Confirm Hire" })).not.toBeInTheDocument();
  });

  it("refetches current evidence, submits once, and shows the confirmed Hired Service", async () => {
    let detailRequests = 0;
    let submissions = 0;
    let receivedBody: unknown;
    vi.spyOn(Date, "now").mockReturnValue(Date.parse("2026-08-14T08:15:00.000Z"));
    server.use(
      http.get(detailUrl, () => {
        detailRequests += 1;
        return HttpResponse.json({
          content: [{
            congViec: {
              id: 42,
              tenCongViec: "Accessible marketplace design",
              giaTien: 220,
              nguoiTao: 810,
              moTa: "A complete accessible marketplace experience.",
            },
            tenNguoiTao: "Alex Seller",
          }],
        });
      }),
      http.post(hireUrl, async ({ request }) => {
        submissions += 1;
        receivedBody = await request.json();
        await delay(50);
        return HttpResponse.json({ content: { id: 901 } }, { status: 201 });
      }),
      http.get(hiredServicesUrl, () => HttpResponse.json({
        content: [{
          id: 901,
          ngayThue: "2026-08-14T08:15:00.000Z",
          hoanThanh: false,
          congViec: {
            id: 42,
            tenCongViec: "Accessible marketplace design",
            giaTien: 220,
            nguoiTao: 810,
          },
        }],
      })),
    );
    const user = userEvent.setup();
    const application = renderTestApplication("/services/42/hire", authenticatedSessionStore());

    const heading = await screen.findByRole("heading", { name: "Confirm your Hire" });
    expect(heading).toHaveFocus();
    expect(screen.getByText("Accessible marketplace design")).toBeVisible();
    expect(screen.getByText("Seller: Alex Seller")).toBeVisible();
    expect(screen.getByText("Current price: $220")).toBeVisible();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();

    const firstConfirmation = user.click(screen.getByRole("button", { name: "Confirm Hire" }));
    expect(await screen.findByRole("status")).toHaveTextContent("Confirming Hire");
    await user.click(screen.getByRole("button", { name: "Confirming Hire..." }));
    await firstConfirmation;

    expect(await screen.findByRole("heading", { name: "Hired Services" })).toBeVisible();
    expect(
      screen.getByText("Accessible marketplace design was hired successfully.").closest('[role="status"]'),
    ).toBeVisible();
    expect(
      await screen.findByRole("article", { name: "Accessible marketplace design" }),
    ).toBeVisible();
    expect(application.currentLocation()).toBe("/hired-services");
    expect(detailRequests).toBe(2);
    expect(submissions).toBe(1);
    expect(receivedBody).toEqual({
      id: 0,
      maCongViec: 42,
      maNguoiThue: 700,
      ngayThue: "2026-08-14T08:15:00.000Z",
      hoanThanh: false,
    });
  });

  it("syncs the hired-services cache so the Profile page shows the new Hire without reload", async () => {
    let hiredList: Array<Record<string, unknown>> = [];
    const session = authenticatedSessionStore();
    const composition = composeApplication({
      mode: "production",
      environment: {
        VITE_API_BASE_URL: "http://api.example.test/api",
        VITE_CYBERSOFT_TOKEN: "deterministic-test-token",
      },
    });
    expect(composition.ok).toBe(true);
    if (!composition.ok) throw new Error("composition is unavailable");
    composition.sessionStore = session;

    function GoToProfile() {
      const navigate = useNavigate();
      return <button type="button" onClick={() => navigate("/profile")}>Open profile</button>;
    }

    server.use(
      http.get(detailUrl, () => HttpResponse.json({
        content: [{
          congViec: {
            id: 42,
            tenCongViec: "Accessible marketplace design",
            giaTien: 220,
            nguoiTao: 810,
            moTa: "A complete accessible marketplace experience.",
          },
          tenNguoiTao: "Alex Seller",
        }],
      })),
      http.get("http://api.example.test/api/users/700", () => HttpResponse.json({
        content: {
          id: 700,
          name: "Alex Morgan",
          email: "alex@example.com",
          phone: "+84901234567",
          birthday: "1995-04-18",
          avatar: null,
          gender: true,
          role: "USER",
          skill: ["React"],
          certification: ["WCAG"],
        },
      })),
      http.post(hireUrl, async () => {
        hiredList = [{
          id: 901,
          ngayThue: "2026-08-14T08:15:00.000Z",
          hoanThanh: false,
          congViec: { id: 42, tenCongViec: "Accessible marketplace design", giaTien: 220, nguoiTao: 810 },
        }];
        return HttpResponse.json({ content: { id: 901 } }, { status: 201 });
      }),
      http.get(hiredServicesUrl, () => HttpResponse.json({ content: hiredList })),
    );

    const user = userEvent.setup();
    const { unmount } = render(
      <MemoryRouter initialEntries={["/services/42/hire"]}>
        <App composition={composition} />
        <GoToProfile />
      </MemoryRouter>,
    );

    await user.click(await screen.findByRole("button", { name: "Confirm Hire" }));
    expect(await screen.findByRole("heading", { name: "Hired Services" })).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Open profile" }));
    expect(await screen.findByRole("heading", { name: "Your Profile" })).toBeVisible();
    expect(await screen.findByRole("article", { name: "Accessible marketplace design" })).toBeVisible();
    unmount();
  });

  it("blocks a proven self-Hire before mutation", async () => {
    let submissions = 0;
    server.use(
      http.get(detailUrl, () => HttpResponse.json({
        content: [{
          congViec: {
            id: 42,
            tenCongViec: "My own Service",
            giaTien: 90,
            nguoiTao: 700,
            moTa: "Owned by the current User.",
          },
          tenNguoiTao: "Alex Morgan",
        }],
      })),
      http.post(hireUrl, () => {
        submissions += 1;
        return HttpResponse.json({ content: { id: 902 } }, { status: 201 });
      }),
    );
    const user = userEvent.setup();
    renderTestApplication("/services/42/hire", authenticatedSessionStore());

    await user.click(await screen.findByRole("button", { name: "Confirm Hire" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "You cannot hire your own Service.",
    );
    expect(submissions).toBe(0);
  });

  it("blocks changed Service data until the Client reloads the latest review", async () => {
    let detailRequests = 0;
    let submissions = 0;
    server.use(
      http.get(detailUrl, () => {
        detailRequests += 1;
        const price = detailRequests === 1 ? 90 : 120;
        return HttpResponse.json({
          content: [{
            congViec: {
              id: 42,
              tenCongViec: "Current design Service",
              giaTien: price,
              nguoiTao: 810,
              moTa: "Price may change.",
            },
            tenNguoiTao: "Alex Seller",
          }],
        });
      }),
      http.post(hireUrl, () => {
        submissions += 1;
        return HttpResponse.json({ content: { id: 903 } }, { status: 201 });
      }),
    );
    const user = userEvent.setup();
    renderTestApplication("/services/42/hire", authenticatedSessionStore());

    expect(await screen.findByText("Current price: $90")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Confirm Hire" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Service details changed. Review the latest information before hiring.",
    );
    expect(submissions).toBe(0);
    await user.click(screen.getByRole("button", { name: "Reload latest" }));

    expect(await screen.findByText("Current price: $120")).toBeVisible();
    expect(screen.getByRole("button", { name: "Confirm Hire" })).toBeEnabled();
  });

  it("blocks the mutation when the Service disappears before confirmation", async () => {
    let detailRequests = 0;
    let submissions = 0;
    server.use(
      http.get(detailUrl, () => {
        detailRequests += 1;
        return HttpResponse.json({
          content: detailRequests === 1 ? [{
            congViec: {
              id: 42,
              tenCongViec: "Service removed before Hire",
              giaTien: 75,
              nguoiTao: 810,
              moTa: "May become unavailable.",
            },
            tenNguoiTao: "Alex Seller",
          }] : [],
        });
      }),
      http.post(hireUrl, () => {
        submissions += 1;
        return HttpResponse.json({ content: { id: 904 } }, { status: 201 });
      }),
    );
    const user = userEvent.setup();
    renderTestApplication("/services/42/hire", authenticatedSessionStore());

    await user.click(await screen.findByRole("button", { name: "Confirm Hire" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "This Service is no longer available to hire.",
    );
    expect(submissions).toBe(0);
  });

  it("does not offer confirmation without trustworthy Seller evidence", async () => {
    let submissions = 0;
    server.use(
      http.get(detailUrl, () => HttpResponse.json({
        content: [{
          congViec: {
            id: 42,
            tenCongViec: "Service without ownership evidence",
            giaTien: 75,
            moTa: "The Seller cannot be verified.",
          },
        }],
      })),
      http.post(hireUrl, () => {
        submissions += 1;
        return HttpResponse.json({ content: { id: 905 } }, { status: 201 });
      }),
    );
    renderTestApplication("/services/42/hire", authenticatedSessionStore());

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Seller information is unavailable, so this Service cannot be hired safely.",
    );
    expect(screen.getByRole("button", { name: "Confirm Hire" })).toBeDisabled();
    expect(submissions).toBe(0);
  });

  it("offers a deliberate Retry after a confirmed server failure", async () => {
    let submissions = 0;
    let hiredServiceRequests = 0;
    server.use(
      http.get(detailUrl, () => HttpResponse.json({
        content: [{
          congViec: {
            id: 42,
            tenCongViec: "Recoverable Hire",
            giaTien: 65,
            nguoiTao: 810,
            moTa: "Retry only when requested.",
          },
          tenNguoiTao: "Alex Seller",
        }],
      })),
      http.post(hireUrl, () => {
        submissions += 1;
        return HttpResponse.json({ message: "Unavailable" }, { status: 503 });
      }),
      http.get(hiredServicesUrl, () => {
        hiredServiceRequests += 1;
        return HttpResponse.json({ content: [] });
      }),
    );
    const user = userEvent.setup();
    renderTestApplication("/services/42/hire", authenticatedSessionStore());

    await user.click(await screen.findByRole("button", { name: "Confirm Hire" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Hire is temporarily unavailable. No Hire was created.",
    );
    expect(screen.getByRole("button", { name: "Retry Hire" })).toBeEnabled();
    expect(submissions).toBe(1);
    expect(hiredServiceRequests).toBe(0);
  });

  it("reports an offline failure without attempting reconciliation or automatic Retry", async () => {
    let submissions = 0;
    let hiredServiceRequests = 0;
    vi.spyOn(window.navigator, "onLine", "get").mockReturnValue(false);
    server.use(
      http.get(detailUrl, () => HttpResponse.json({
        content: [{
          congViec: {
            id: 42,
            tenCongViec: "Offline Hire",
            giaTien: 85,
            nguoiTao: 810,
            moTa: "Reconnect before Retry.",
          },
          tenNguoiTao: "Alex Seller",
        }],
      })),
      http.post(hireUrl, () => {
        submissions += 1;
        return HttpResponse.error();
      }),
      http.get(hiredServicesUrl, () => {
        hiredServiceRequests += 1;
        return HttpResponse.json({ content: [] });
      }),
    );
    const user = userEvent.setup();
    renderTestApplication("/services/42/hire", authenticatedSessionStore());

    await user.click(await screen.findByRole("button", { name: "Confirm Hire" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "You are offline. Reconnect before trying this Hire again.",
    );
    expect(screen.getByRole("button", { name: "Retry Hire" })).toBeEnabled();
    expect(submissions).toBe(1);
    expect(hiredServiceRequests).toBe(0);
  });

  it("clears an unauthorized Session and returns to Login without resubmitting", async () => {
    let submissions = 0;
    const clear = vi.fn();
    const sessionStore = { ...authenticatedSessionStore(), clear };
    server.use(
      http.get(detailUrl, () => HttpResponse.json({
        content: [{
          congViec: {
            id: 42,
            tenCongViec: "Session-aware Hire",
            giaTien: 95,
            nguoiTao: 810,
            moTa: "Sign in again after 401.",
          },
          tenNguoiTao: "Alex Seller",
        }],
      })),
      http.post(hireUrl, () => {
        submissions += 1;
        return HttpResponse.json({ message: "Unauthorized" }, { status: 401 });
      }),
    );
    const user = userEvent.setup();
    const application = renderTestApplication("/services/42/hire", sessionStore);

    await user.click(await screen.findByRole("button", { name: "Confirm Hire" }));

    expect(await screen.findByRole("heading", { name: "Login" })).toBeVisible();
    expect(application.currentLocation()).toBe("/login?returnTo=%2Fservices%2F42%2Fhire");
    expect(clear).toHaveBeenCalledTimes(1);
    expect(submissions).toBe(1);
  });

  it("retains the Session while applying the common 403 permission contract", async () => {
    let submissions = 0;
    const clear = vi.fn();
    const sessionStore = { ...authenticatedSessionStore(), clear };
    server.use(
      http.get(detailUrl, () => HttpResponse.json({
        content: [{
          congViec: {
            id: 42,
            tenCongViec: "Permission-aware Hire",
            giaTien: 105,
            nguoiTao: 810,
            moTa: "Retain Session after 403.",
          },
          tenNguoiTao: "Alex Seller",
        }],
      })),
      http.post(hireUrl, () => {
        submissions += 1;
        return HttpResponse.json({ message: "Forbidden" }, { status: 403 });
      }),
    );
    const user = userEvent.setup();
    renderTestApplication("/services/42/hire", sessionStore);

    await user.click(await screen.findByRole("button", { name: "Confirm Hire" }));

    expect(await screen.findByRole("heading", { name: "Insufficient permission" })).toBeVisible();
    expect(clear).not.toHaveBeenCalled();
    expect(submissions).toBe(1);
  });

  it.each([
    { width: 375, navigationName: "Open menu" },
    { width: 768, navigationName: "Browse categories" },
    { width: 1440, navigationName: "Service Categories" },
  ])("keeps a keyboard-operable, non-editable confirmation in logical order at $width px", async ({ width, navigationName }) => {
    useViewport(width);
    server.use(http.get(detailUrl, () => HttpResponse.json({
      content: [{
        congViec: {
          id: 42,
          tenCongViec: "Responsive Hire confirmation",
          giaTien: 125,
          nguoiTao: 810,
          moTa: "Review without editing trusted fields.",
        },
        tenNguoiTao: "Alex Seller",
      }],
    })));
    renderTestApplication("/services/42/hire", authenticatedSessionStore());

    const heading = await screen.findByRole("heading", { name: "Confirm your Hire" });
    const summary = screen.getByRole("region", { name: "Hire summary" });
    const action = screen.getByRole("complementary", { name: "Hire action" });
    expect(heading).toHaveFocus();
    expect(summary.compareDocumentPosition(action) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.queryByRole("spinbutton")).not.toBeInTheDocument();
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    expect(within(action).getByRole("button", { name: "Confirm Hire" })).toBeEnabled();
    if (width === 1440) {
      expect(screen.getByRole("navigation", { name: navigationName })).toBeVisible();
    } else {
      expect(screen.getByRole("button", { name: navigationName })).toBeVisible();
    }
  });
});
