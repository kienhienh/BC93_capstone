import { fireEvent, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { delay, http, HttpResponse } from "msw";
import { describe, expect, it, vi } from "vitest";
import { renderTestApplication } from "../../test/render-application";
import { server } from "../../test/server";
import type { SessionStore } from "../authentication/wiring";

const detailUrl = "http://api.example.test/api/cong-viec/lay-cong-viec-chi-tiet/42";
const commentsUrl = "http://api.example.test/api/binh-luan/lay-binh-luan-theo-cong-viec/42";

function useViewport(width: number) {
  Object.defineProperty(window, "innerWidth", { configurable: true, value: width });
}

const encodeTokenPart = (value: object) =>
  btoa(JSON.stringify(value)).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");

function authenticatedSessionStore(): SessionStore {
  return {
    read: () => ({
      token: `${encodeTokenPart({ alg: "none", typ: "JWT" })}.${encodeTokenPart({ exp: 4_102_444_800 })}.signature`,
      user: {
        id: "700",
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

describe("routed Service Detail", () => {
  it("returns a Visitor from Login without automatically submitting a Comment", async () => {
    let submissions = 0;
    server.use(
      http.get(detailUrl, () => HttpResponse.json({
        content: [{ congViec: { id: 42, tenCongViec: "Protected feedback", giaTien: 50, moTa: "Login first." } }],
      })),
      http.get(commentsUrl, () => HttpResponse.json({ content: [] })),
      http.post("http://api.example.test/api/binh-luan", () => {
        submissions += 1;
        return HttpResponse.json({ content: { id: 900 } }, { status: 201 });
      }),
    );
    const user = userEvent.setup();
    const application = renderTestApplication("/services/42");

    await user.click(await screen.findByRole("link", { name: "Add a Comment" }));

    expect(application.currentLocation()).toBe("/login?returnTo=%2Fservices%2F42");
    await user.type(screen.getByRole("textbox", { name: "Email" }), "alex@example.com");
    await user.type(screen.getByLabelText("Password", { selector: "input" }), "secret1");
    await user.click(screen.getByRole("button", { name: "Login" }));

    expect(await screen.findByRole("form", { name: "Add a Comment" })).toBeVisible();
    expect(application.currentLocation()).toBe("/services/42");
    expect(submissions).toBe(0);
  });

  it("validates a persistently labelled Comment form and focuses the first invalid field", async () => {
    server.use(
      http.get(detailUrl, () => HttpResponse.json({
        content: [{
          congViec: {
            id: 42,
            tenCongViec: "Service ready for feedback",
            giaTien: 75,
            moTa: "Authenticated Users can leave feedback.",
          },
        }],
      })),
      http.get(commentsUrl, () => HttpResponse.json({ content: [] })),
    );
    const user = userEvent.setup();

    renderTestApplication("/services/42", authenticatedSessionStore());

    const form = await screen.findByRole("form", { name: "Add a Comment" });
    const rating = within(form).getByRole("radiogroup", { name: "Rating" });
    const content = within(form).getByRole("textbox", { name: "Comment" });
    expect(within(rating).getAllByRole("radio")).toHaveLength(5);
    expect(within(form).getByText("0 out of 5 stars selected")).toBeVisible();
    expect(content).toHaveAttribute("maxlength", "1000");

    await user.click(within(form).getByRole("button", { name: "Add Comment" }));

    expect(within(form).getByText("Enter a Comment between 1 and 1000 characters.")).toBeVisible();
    expect(rating).toHaveAttribute("aria-invalid", "false");
    expect(content).toHaveAttribute("aria-invalid", "true");
    expect(content).toHaveFocus();

    await user.click(within(rating).getByRole("radio", { name: "5 stars" }));
    expect(
      within(rating).getAllByRole("radio").map((radio) => radio.closest("label")),
    ).toEqual([
      expect.objectContaining({ className: "is-filled" }),
      expect.objectContaining({ className: "is-filled" }),
      expect.objectContaining({ className: "is-filled" }),
      expect.objectContaining({ className: "is-filled" }),
      expect.objectContaining({ className: "is-filled" }),
    ]);
    expect(within(form).getByText("5 out of 5 stars selected")).toBeVisible();
    await user.click(within(form).getByRole("button", { name: "Clear rating" }));
    expect(within(form).getByText("0 out of 5 stars selected")).toBeVisible();
    expect(
      within(rating)
        .getAllByRole("radio")
        .every((radio) => !(radio as HTMLInputElement).checked),
    ).toBe(true);
    fireEvent.change(content, { target: { value: "A".repeat(1001) } });
    await user.click(within(form).getByRole("button", { name: "Add Comment" }));

    expect(content).toHaveFocus();
    expect(within(form).getByText("Enter a Comment between 1 and 1000 characters.")).toBeVisible();
  });

  it("submits once from route and Session identity, then clears the draft only after the Comment is observed", async () => {
    let submissions = 0;
    let commentsRequests = 0;
    let submitted = false;
    let receivedBody: unknown;
    vi.spyOn(Date, "now").mockReturnValue(Date.parse("2026-08-14T04:30:00.000Z"));
    server.use(
      http.get(detailUrl, () => HttpResponse.json({
        content: [{ congViec: { id: 42, tenCongViec: "Observable feedback", giaTien: 90, moTa: "Confirm first." } }],
      })),
      http.get(commentsUrl, () => {
        commentsRequests += 1;
        return HttpResponse.json({
          content: submitted ? [{
            id: 901,
            ngayBinhLuan: "2026-08-14T04:30:00.000Z",
            noiDung: "Clear and helpful delivery.",
            saoBinhLuan: 0,
            tenNguoiBinhLuan: "Alex Morgan",
          }] : [],
        });
      }),
      http.post("http://api.example.test/api/binh-luan", async ({ request }) => {
        submissions += 1;
        receivedBody = await request.json();
        submitted = true;
        await delay(50);
        return HttpResponse.json({ content: { id: 901 } }, { status: 201 });
      }),
    );
    const user = userEvent.setup();
    renderTestApplication("/services/42", authenticatedSessionStore());
    const form = await screen.findByRole("form", { name: "Add a Comment" });

    await user.type(within(form).getByRole("textbox", { name: "Comment" }), "Clear and helpful delivery.");
    const firstSubmit = user.click(within(form).getByRole("button", { name: "Add Comment" }));

    expect(await within(form).findByRole("status")).toHaveTextContent("Submitting Comment");
    const pendingButton = within(form).getByRole("button", { name: "Submitting Comment..." });
    expect(pendingButton).toBeDisabled();
    await user.click(pendingButton);
    await firstSubmit;
    expect(await within(form).findByText("Your Comment was added.")).toHaveAttribute("role", "status");

    expect(submissions).toBe(1);
    expect(commentsRequests).toBe(2);
    expect(receivedBody).toEqual({
      maCongViec: 42,
      maNguoiBinhLuan: 700,
      ngayBinhLuan: "2026-08-14T04:30:00.000Z",
      noiDung: "Clear and helpful delivery.",
      saoBinhLuan: 0,
    });
    expect(within(form).getByRole("textbox", { name: "Comment" })).toHaveValue("");
    expect(within(form).getByText("0 out of 5 stars selected")).toBeVisible();
    expect(
      within(form)
        .getAllByRole("radio")
        .every((radio) => !(radio as HTMLInputElement).checked),
    ).toBe(true);
    expect(screen.getByText("Clear and helpful delivery.")).toBeVisible();
  });

  it("checks Comments again without resubmitting when an accepted Comment is not yet visible", async () => {
    let submissions = 0;
    let commentsRequests = 0;
    server.use(
      http.get(detailUrl, () => HttpResponse.json({
        content: [{ congViec: { id: 42, tenCongViec: "Eventually visible feedback", giaTien: 90, moTa: "Observe before clearing." } }],
      })),
      http.get(commentsUrl, () => {
        commentsRequests += 1;
        return HttpResponse.json({
          content: commentsRequests >= 3 ? [{
            id: 901,
            ngayBinhLuan: "2026-08-14T04:30:00.000Z",
            noiDung: "Visible after another check.",
            saoBinhLuan: 5,
            tenNguoiBinhLuan: "Alex Morgan",
          }] : [],
        });
      }),
      http.post("http://api.example.test/api/binh-luan", () => {
        submissions += 1;
        return HttpResponse.json({ content: { id: 901 } }, { status: 201 });
      }),
    );
    const user = userEvent.setup();
    renderTestApplication("/services/42", authenticatedSessionStore());
    const form = await screen.findByRole("form", { name: "Add a Comment" });

    await user.click(within(form).getByRole("radio", { name: "5 stars" }));
    await user.type(within(form).getByRole("textbox", { name: "Comment" }), "Visible after another check.");
    await user.click(within(form).getByRole("button", { name: "Add Comment" }));

    expect(await within(form).findByRole("alert")).toHaveTextContent(
      "The server accepted your Comment, but it is not visible yet. Your draft is safe.",
    );
    expect(within(form).getByRole("button", { name: "Comment awaiting confirmation" })).toBeDisabled();
    await user.click(within(form).getByRole("button", { name: "Check Comments again" }));

    expect(await within(form).findByText("Your Comment was added.")).toBeVisible();
    expect(submissions).toBe(1);
    expect(commentsRequests).toBe(3);
    expect(within(form).getByRole("textbox", { name: "Comment" })).toHaveValue("");
  });

  it("preserves the Comment draft after a recoverable submission failure", async () => {
    server.use(
      http.get(detailUrl, () => HttpResponse.json({
        content: [{ congViec: { id: 42, tenCongViec: "Recoverable feedback", giaTien: 90, moTa: "Drafts remain safe." } }],
      })),
      http.get(commentsUrl, () => HttpResponse.json({ content: [] })),
      http.post("http://api.example.test/api/binh-luan", () =>
        HttpResponse.json({ message: "Temporarily unavailable" }, { status: 503 })),
    );
    const user = userEvent.setup();
    renderTestApplication("/services/42", authenticatedSessionStore());
    const form = await screen.findByRole("form", { name: "Add a Comment" });

    await user.click(within(form).getByRole("radio", { name: "4 stars" }));
    await user.type(within(form).getByRole("textbox", { name: "Comment" }), "Please keep this draft.");
    await user.click(within(form).getByRole("button", { name: "Add Comment" }));

    expect(await within(form).findByRole("alert")).toHaveTextContent(
      "Comment submission is temporarily unavailable. Your draft is safe.",
    );
    expect(within(form).getByRole("radio", { name: "4 stars" })).toBeChecked();
    expect(within(form).getByRole("textbox", { name: "Comment" })).toHaveValue("Please keep this draft.");
    expect(within(form).getByRole("button", { name: "Try adding Comment again" })).toBeEnabled();
  });

  it("reports an offline Comment failure locally while preserving the draft", async () => {
    vi.spyOn(window.navigator, "onLine", "get").mockReturnValue(false);
    server.use(
      http.get(detailUrl, () => HttpResponse.json({
        content: [{ congViec: { id: 42, tenCongViec: "Offline feedback", giaTien: 90, moTa: "Reconnect safely." } }],
      })),
      http.get(commentsUrl, () => HttpResponse.json({ content: [] })),
      http.post("http://api.example.test/api/binh-luan", () => HttpResponse.error()),
    );
    const user = userEvent.setup();
    renderTestApplication("/services/42", authenticatedSessionStore());
    const form = await screen.findByRole("form", { name: "Add a Comment" });

    await user.click(within(form).getByRole("radio", { name: "4 stars" }));
    await user.type(within(form).getByRole("textbox", { name: "Comment" }), "Keep while offline.");
    await user.click(within(form).getByRole("button", { name: "Add Comment" }));

    expect(await within(form).findByRole("alert")).toHaveTextContent(
      "You are offline. Reconnect before trying again. Your draft is safe.",
    );
    expect(within(form).getByRole("textbox", { name: "Comment" })).toHaveValue("Keep while offline.");
  });

  it("reconciles an unknown outcome before offering a manual Retry without resending", async () => {
    let submissions = 0;
    let commentsRequests = 0;
    server.use(
      http.get(detailUrl, () => HttpResponse.json({
        content: [{ congViec: { id: 42, tenCongViec: "Uncertain feedback", giaTien: 90, moTa: "Reconcile first." } }],
      })),
      http.get(commentsUrl, () => {
        commentsRequests += 1;
        return HttpResponse.json({ content: [] });
      }),
      http.post("http://api.example.test/api/binh-luan", () => {
        submissions += 1;
        return HttpResponse.json({ content: { unexpected: true } }, { status: 201 });
      }),
    );
    const user = userEvent.setup();
    renderTestApplication("/services/42", authenticatedSessionStore());
    const form = await screen.findByRole("form", { name: "Add a Comment" });

    await user.click(within(form).getByRole("radio", { name: "3 stars" }));
    await user.type(within(form).getByRole("textbox", { name: "Comment" }), "Check before retrying.");
    await user.click(within(form).getByRole("button", { name: "Add Comment" }));

    expect(await within(form).findByRole("alert")).toHaveTextContent(
      "We could not confirm whether your Comment was added. The Comments were checked before Retry.",
    );
    expect(submissions).toBe(1);
    expect(commentsRequests).toBe(2);
    expect(within(form).getByRole("radio", { name: "3 stars" })).toBeChecked();
    expect(within(form).getByRole("textbox", { name: "Comment" })).toHaveValue("Check before retrying.");
    expect(within(form).getByRole("button", { name: "Retry Comment" })).toBeEnabled();
  });

  it("does not offer Comment Retry while unknown-outcome reconciliation is unavailable", async () => {
    let submissions = 0;
    let commentsRequests = 0;
    server.use(
      http.get(detailUrl, () => HttpResponse.json({
        content: [{ congViec: { id: 42, tenCongViec: "Safe uncertain feedback", giaTien: 90, moTa: "No premature Retry." } }],
      })),
      http.get(commentsUrl, () => {
        commentsRequests += 1;
        return commentsRequests === 1
          ? HttpResponse.json({ content: [] })
          : HttpResponse.json({ message: "Unavailable" }, { status: 503 });
      }),
      http.post("http://api.example.test/api/binh-luan", () => {
        submissions += 1;
        return HttpResponse.json({ content: { unexpected: true } }, { status: 201 });
      }),
    );
    const user = userEvent.setup();
    renderTestApplication("/services/42", authenticatedSessionStore());
    const form = await screen.findByRole("form", { name: "Add a Comment" });

    await user.click(within(form).getByRole("radio", { name: "3 stars" }));
    await user.type(within(form).getByRole("textbox", { name: "Comment" }), "Wait for reconciliation.");
    await user.click(within(form).getByRole("button", { name: "Add Comment" }));

    expect(await within(form).findByRole("alert")).toHaveTextContent(
      "We could not check whether your Comment was added. Check Comments before Retry.",
    );
    expect(within(form).queryByRole("button", { name: "Retry Comment" })).not.toBeInTheDocument();
    expect(within(form).getByRole("button", { name: "Comment awaiting confirmation" })).toBeDisabled();
    expect(within(form).getByRole("button", { name: "Check Comments again" })).toBeEnabled();
    expect(submissions).toBe(1);
    expect(commentsRequests).toBe(2);
  });

  it("retains the Session and restores a safe Comment draft after a 403 response", async () => {
    server.use(
      http.get(detailUrl, () => HttpResponse.json({
        content: [{ congViec: { id: 42, tenCongViec: "Permission-aware feedback", giaTien: 90, moTa: "Keep the draft." } }],
      })),
      http.get(commentsUrl, () => HttpResponse.json({ content: [] })),
      http.post("http://api.example.test/api/binh-luan", () =>
        HttpResponse.json({ message: "Forbidden" }, { status: 403 })),
    );
    const user = userEvent.setup();
    renderTestApplication("/services/42", authenticatedSessionStore());
    const form = await screen.findByRole("form", { name: "Add a Comment" });

    await user.click(within(form).getByRole("radio", { name: "2 stars" }));
    await user.type(within(form).getByRole("textbox", { name: "Comment" }), "Keep after forbidden.");
    await user.click(within(form).getByRole("button", { name: "Add Comment" }));

    const permissionHeading = await screen.findByRole("heading", { name: "Insufficient permission" });
    expect(permissionHeading).toHaveFocus();
    await user.click(screen.getByRole("button", { name: "Return to current page" }));

    const restored = await screen.findByRole("form", { name: "Add a Comment" });
    expect(within(restored).getByRole("radio", { name: "2 stars" })).toBeChecked();
    expect(within(restored).getByRole("textbox", { name: "Comment" })).toHaveValue("Keep after forbidden.");
    expect(screen.getByRole("button", { name: "Logout" })).toBeVisible();
  });

  it("restores a safe draft after 401 reauthentication without replaying the Comment", async () => {
    let submissions = 0;
    server.use(
      http.get(detailUrl, () => HttpResponse.json({
        content: [{ congViec: { id: 42, tenCongViec: "Session-aware feedback", giaTien: 90, moTa: "Sign in again." } }],
      })),
      http.get(commentsUrl, () => HttpResponse.json({ content: [] })),
      http.post("http://api.example.test/api/binh-luan", () => {
        submissions += 1;
        return HttpResponse.json({ message: "Unauthorized" }, { status: 401 });
      }),
    );
    const user = userEvent.setup();
    const application = renderTestApplication("/services/42", authenticatedSessionStore());
    const form = await screen.findByRole("form", { name: "Add a Comment" });

    await user.click(within(form).getByRole("radio", { name: "5 stars" }));
    await user.type(within(form).getByRole("textbox", { name: "Comment" }), "Keep after reauthentication.");
    await user.click(within(form).getByRole("button", { name: "Add Comment" }));

    expect(await screen.findByRole("heading", { name: "Login" })).toBeVisible();
    expect(application.currentLocation()).toBe("/login?returnTo=%2Fservices%2F42");
    await user.type(screen.getByRole("textbox", { name: "Email" }), "alex@example.com");
    await user.type(screen.getByLabelText("Password", { selector: "input" }), "secret1");
    await user.click(screen.getByRole("button", { name: "Login" }));

    const restored = await screen.findByRole("form", { name: "Add a Comment" });
    expect(within(restored).getByRole("radio", { name: "5 stars" })).toBeChecked();
    expect(within(restored).getByRole("textbox", { name: "Comment" })).toHaveValue(
      "Keep after reauthentication.",
    );
    expect(screen.getByText(/Confirm before trying the action again/).closest('[role="status"]')).toBeVisible();
    expect(submissions).toBe(1);
  });

  it("renders canonical Service, taxonomy, private Seller summary, and Hire entry independently of Comments", async () => {
    server.use(
      http.get(detailUrl, () => HttpResponse.json({
        content: [{
          id: 42,
          congViec: {
            id: 42,
            tenCongViec: "Accessible marketplace design",
            danhGia: 17,
            giaTien: 220,
            nguoiTao: 700,
            hinhAnh: "https://images.example.test/service-detail.jpg",
            moTa: "A complete accessible marketplace experience.",
            moTaNgan: "Responsive design package",
            saoCongViec: 4.8,
          },
          tenLoaiCongViec: "Graphics & Design",
          tenNhomChiTietLoai: "Web & App Design",
          tenChiTietLoai: "Website Design",
          tenNguoiTao: "Alex Seller",
          avatar: "https://images.example.test/alex.jpg",
          email: "private@example.test",
          phone: "+84900000000",
        }],
      })),
      http.get(commentsUrl, async () => {
        await delay("infinite");
        return HttpResponse.json({ content: [] });
      }),
    );

    renderTestApplication("/services/42");

    const heading = await screen.findByRole("heading", {
      level: 1,
      name: "Accessible marketplace design",
    });
    expect(heading).toHaveFocus();
    expect(screen.getByText("A complete accessible marketplace experience.")).toBeVisible();
    expect(screen.getByText("$220")).toBeVisible();
    expect(screen.getByRole("img", { name: "Accessible marketplace design" })).toBeVisible();
    expect(screen.getByRole("heading", { level: 2, name: "About this Service" })).toBeVisible();
    expect(screen.getByRole("region", { name: "Common Service questions" })).toBeVisible();
    expect(screen.getByText("What should I review before hiring?")).toBeVisible();

    const breadcrumb = screen.getByRole("navigation", { name: "Service breadcrumb" });
    expect(within(breadcrumb).getByText("Graphics & Design")).toBeVisible();
    expect(within(breadcrumb).getByText("Web & App Design")).toBeVisible();
    expect(within(breadcrumb).getByText("Website Design")).toBeVisible();

    const seller = screen.getByRole("region", { name: "About the Seller" });
    expect(within(seller).getByText("Alex Seller")).toBeVisible();
    expect(within(seller).getByRole("img", { name: "Alex Seller" })).toBeVisible();
    expect(screen.queryByText("private@example.test")).not.toBeInTheDocument();
    expect(screen.queryByText("+84900000000")).not.toBeInTheDocument();

    const hire = screen.getByRole("complementary", { name: "Hire this Service" });
    expect(within(hire).getByText("Responsive design package")).toBeVisible();
    expect(within(hire).getByRole("link", { name: "Continue to Hire for $220" })).toHaveAttribute(
      "href",
      "/services/42/hire",
    );
    expect(screen.getByRole("status", { name: "Loading Comments" })).toBeVisible();
  });

  it("orders valid Comment dates newest-first, reveals ten initially, and progressively reveals safe fallbacks", async () => {
    server.use(
      http.get(detailUrl, () => HttpResponse.json({
        content: [{
          congViec: {
            id: 42,
            tenCongViec: "Service with Comments",
            giaTien: 80,
            moTa: "Comment ordering matters.",
          },
        }],
      })),
      http.get(commentsUrl, () => HttpResponse.json({
        content: [
          ...Array.from({ length: 11 }, (_, index) => ({
            id: index + 1,
            ngayBinhLuan: `2026-01-${String(index + 1).padStart(2, "0")}T12:00:00.000Z`,
            noiDung: `Comment ${index + 1}`,
            saoBinhLuan: 5,
            tenNguoiBinhLuan: `Author ${index + 1}`,
            avatar: null,
          })),
          {
            id: 12,
            ngayBinhLuan: "not-a-date",
            noiDung: "",
            saoBinhLuan: null,
            tenNguoiBinhLuan: null,
            avatar: null,
          },
        ],
      })),
    );
    const user = userEvent.setup();

    renderTestApplication("/services/42");

    const comments = await screen.findByRole("region", { name: "Comments" });
    const initialItems = await within(comments).findAllByRole("article");
    expect(initialItems).toHaveLength(10);
    expect(initialItems[0]).toHaveTextContent("Comment 11");
    expect(initialItems[9]).toHaveTextContent("Comment 2");
    expect(within(comments).queryByText("Comment 1")).not.toBeInTheDocument();

    await user.click(within(comments).getByRole("button", { name: "Show 2 more Comments" }));

    expect(within(comments).getAllByRole("article")).toHaveLength(12);
    expect(within(comments).getByText("12 Comments")).toBeVisible();
    expect(within(comments).getByText("5.0 average rating")).toBeVisible();
    expect(within(comments).getByRole("progressbar", { name: "0 stars: 0 Comments" })).toBeVisible();
    expect(within(comments).getByText("Comment 1")).toBeVisible();
    expect(within(comments).getByText("Anonymous commenter")).toBeVisible();
    expect(within(comments).getByRole("img", { name: "Anonymous commenter" })).toBeVisible();
    expect(within(comments).getByText("Rating unavailable")).toBeVisible();
    expect(within(comments).getByText("Date unavailable")).toBeVisible();
    expect(within(comments).getByText("Comment unavailable.")).toBeVisible();
  });

  it("keeps valid Service content when Comments fail and retries only the Comments region", async () => {
    let commentsRequests = 0;
    server.use(
      http.get(detailUrl, () => HttpResponse.json({
        content: [{
          congViec: {
            id: 42,
            tenCongViec: "Independent Service",
            giaTien: 95,
            moTa: "This Service remains readable.",
          },
        }],
      })),
      http.get(commentsUrl, () => {
        commentsRequests += 1;
        return commentsRequests === 1
          ? new HttpResponse(null, { status: 503 })
          : HttpResponse.json({ content: [] });
      }),
    );
    const user = userEvent.setup();

    renderTestApplication("/services/42");

    expect(await screen.findByRole("heading", { level: 1, name: "Independent Service" })).toBeVisible();
    const comments = screen.getByRole("region", { name: "Comments" });
    const alert = await within(comments).findByRole("alert");
    expect(alert).toHaveTextContent("Comments are temporarily unavailable.");
    expect(screen.getByText("This Service remains readable.")).toBeVisible();

    await user.click(within(alert).getByRole("button", { name: "Try loading Comments again" }));

    expect(await within(comments).findByText("No Comments have been posted yet.")).toBeVisible();
    expect(commentsRequests).toBe(2);
  });

  it("distinguishes a confirmed missing Service from a recoverable server failure", async () => {
    server.use(
      http.get(detailUrl, () => HttpResponse.json({ content: [] })),
      http.get(commentsUrl, () => HttpResponse.json({ content: [] })),
    );
    const missing = renderTestApplication("/services/42");

    const notFound = await screen.findByRole("heading", { level: 1, name: "Service not found" });
    expect(notFound).toHaveFocus();
    expect(screen.getByText("The requested Service does not exist.")).toBeVisible();
    missing.unmount();

    server.use(
      http.get(detailUrl, () => new HttpResponse(null, { status: 503 })),
      http.get(commentsUrl, () => HttpResponse.json({ content: [] })),
    );
    renderTestApplication("/services/42");

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Service is temporarily unavailable.");
    expect(within(alert).getByRole("button", { name: "Try loading Service again" })).toBeEnabled();
    expect(screen.queryByText("The requested Service does not exist.")).not.toBeInTheDocument();
  });

  it("omits missing taxonomy levels and uses neutral Service and Seller fallbacks", async () => {
    server.use(
      http.get(detailUrl, () => HttpResponse.json({
        content: [{
          congViec: {
            id: 42,
            tenCongViec: "Minimal Service",
            giaTien: 40,
            moTa: "Only canonical fields are available.",
          },
        }],
      })),
      http.get(commentsUrl, () => HttpResponse.json({ content: [] })),
    );

    renderTestApplication("/services/42");

    expect(await screen.findByRole("heading", { level: 1, name: "Minimal Service" })).toBeVisible();
    expect(screen.queryByRole("navigation", { name: "Service breadcrumb" })).not.toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Image unavailable for Minimal Service" })).toBeVisible();
    expect(screen.getByText("Service rating unavailable")).toBeVisible();
    const seller = screen.getByRole("region", { name: "About the Seller" });
    expect(within(seller).getByText("Marketplace Seller")).toBeVisible();
    expect(within(seller).getByRole("img", { name: "Marketplace Seller" })).toBeVisible();
  });

  it("keeps Service content stable while refreshing it", async () => {
    let detailRequests = 0;
    server.use(
      http.get(detailUrl, async () => {
        detailRequests += 1;
        if (detailRequests > 1) await delay(100);
        return HttpResponse.json({
          content: [{
            congViec: {
              id: 42,
              tenCongViec: "Stable Service",
              giaTien: 60,
              moTa: "Visible during refresh.",
            },
          }],
        });
      }),
      http.get(commentsUrl, () => HttpResponse.json({ content: [] })),
    );
    const user = userEvent.setup();

    renderTestApplication("/services/42");
    expect(await screen.findByRole("heading", { level: 1, name: "Stable Service" })).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Refresh Service details" }));

    expect(screen.getByRole("heading", { level: 1, name: "Stable Service" })).toBeVisible();
    expect(screen.getByText("Visible during refresh.")).toBeVisible();
    expect(screen.getByRole("status", { name: "Refreshing Service" })).toBeVisible();
    expect(detailRequests).toBe(2);
  });

  it("reports malformed and offline Service failures without exposing transport details", async () => {
    server.use(
      http.get(detailUrl, () => HttpResponse.json({ content: [{ unexpected: true }] })),
      http.get(commentsUrl, () => HttpResponse.json({ content: [] })),
    );
    const malformed = renderTestApplication("/services/42");
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Service returned an unsafe response.",
    );
    malformed.unmount();

    vi.spyOn(window.navigator, "onLine", "get").mockReturnValue(false);
    server.use(
      http.get(detailUrl, () => HttpResponse.error()),
      http.get(commentsUrl, () => HttpResponse.json({ content: [] })),
    );
    renderTestApplication("/services/42");
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "You are offline. Reconnect to load this Service.",
    );
  });

  it("contains malformed Comments failures inside the Comments region", async () => {
    server.use(
      http.get(detailUrl, () => HttpResponse.json({
        content: [{
          congViec: {
            id: 42,
            tenCongViec: "Safe Service content",
            giaTien: 75,
            moTa: "The Service remains available.",
          },
        }],
      })),
      http.get(commentsUrl, () => HttpResponse.json({ content: "unsafe" })),
    );

    renderTestApplication("/services/42");

    expect(await screen.findByRole("heading", { level: 1, name: "Safe Service content" })).toBeVisible();
    const comments = screen.getByRole("region", { name: "Comments" });
    expect(await within(comments).findByRole("alert")).toHaveTextContent(
      "Comments returned an unsafe response.",
    );
    expect(screen.getByText("The Service remains available.")).toBeVisible();
  });

  it("keeps existing Comments visible while refreshing only the Comments region", async () => {
    let commentsRequests = 0;
    server.use(
      http.get(detailUrl, () => HttpResponse.json({
        content: [{
          congViec: {
            id: 42,
            tenCongViec: "Service with refreshable Comments",
            giaTien: 50,
            moTa: "Comments refresh independently.",
          },
        }],
      })),
      http.get(commentsUrl, async () => {
        commentsRequests += 1;
        if (commentsRequests > 1) await delay(100);
        return HttpResponse.json({
          content: [{
            id: 1,
            ngayBinhLuan: "2026-08-14T01:00:00.000Z",
            noiDung: "Still readable while refreshing",
            saoBinhLuan: 4,
            tenNguoiBinhLuan: "Reader",
          }],
        });
      }),
    );
    const user = userEvent.setup();

    renderTestApplication("/services/42");
    const comments = await screen.findByRole("region", { name: "Comments" });
    expect(await within(comments).findByText("Still readable while refreshing")).toBeVisible();

    await user.click(within(comments).getByRole("button", { name: "Refresh Comments" }));

    expect(within(comments).getByText("Still readable while refreshing")).toBeVisible();
    expect(within(comments).getByRole("status", { name: "Refreshing Comments" })).toBeVisible();
    expect(commentsRequests).toBe(2);
  });

  it.each([
    { width: 375, navigationName: "Open menu" },
    { width: 768, navigationName: "Browse categories" },
    { width: 1440, navigationName: "Service Categories" },
  ])("preserves Service, Hire, Comments, and keyboard-usable Comment form at $width px", async ({ width, navigationName }) => {
    useViewport(width);
    server.use(
      http.get(detailUrl, () => HttpResponse.json({
        content: [{
          congViec: {
            id: 42,
            tenCongViec: "Responsive Service",
            giaTien: 130,
            moTa: "Logical at every viewport.",
          },
        }],
      })),
      http.get(commentsUrl, () => HttpResponse.json({ content: [] })),
    );

    renderTestApplication("/services/42", authenticatedSessionStore());

    const heading = await screen.findByRole("heading", { level: 1, name: "Responsive Service" });
    const hire = screen.getByRole("complementary", { name: "Hire this Service" });
    const comments = screen.getByRole("region", { name: "Comments" });
    const form = screen.getByRole("form", { name: "Add a Comment" });
    expect(heading).toHaveFocus();
    expect(hire.compareDocumentPosition(comments) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(within(form).getByRole("radiogroup", { name: "Rating" })).toBeVisible();
    expect(within(form).getByRole("textbox", { name: "Comment" })).toBeVisible();
    expect(within(form).getByRole("button", { name: "Add Comment" })).toBeEnabled();
    if (width === 1440) {
      expect(screen.getByRole("navigation", { name: navigationName })).toBeVisible();
    } else {
      expect(screen.getByRole("button", { name: navigationName })).toBeVisible();
    }
  });
});
