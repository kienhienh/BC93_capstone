import { fireEvent, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it, vi } from "vitest";
import { renderTestApplication } from "../../test/render-application";
import { server } from "../../test/server";

const userUrl = "http://api.example.test/api/users/700";
const avatarUrl = "http://api.example.test/api/users/upload-avatar";
const hiredUrl = "http://api.example.test/api/thue-cong-viec/lay-danh-sach-da-thue";

function sessionStore() {
  const encode = (value: object) => btoa(JSON.stringify(value)).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
  return {
    read: () => ({ token: `${encode({ alg: "none" })}.${encode({ exp: 4_102_444_800 })}.signature`, user: { id: "700", name: "Persisted name", email: "alex@example.com", role: "USER", avatar: null } }),
    save: vi.fn(), clear: vi.fn(), subscribe: () => () => undefined,
  };
}

const currentUser = {
  id: 700, name: "Alex Morgan", email: "alex@example.com", phone: "+84901234567",
  birthday: "1995-04-18", avatar: null, gender: true, role: "USER",
  skill: ["React", "Accessibility"], certification: ["WCAG"],
};

describe("Current Profile", () => {
  it("refetches only the Session User and presents Profile with Hired Services", async () => {
    const requested: string[] = [];
    server.use(
      http.get(userUrl, ({ request }) => { requested.push(request.url); return HttpResponse.json({ content: currentUser }); }),
      http.get(hiredUrl, () => HttpResponse.json({ content: [{ id: 9, ngayThue: "2026-08-14", hoanThanh: false, congViec: { id: 42, tenCongViec: "Accessible logo", giaTien: 120, nguoiTao: 810 } }] })),
    );
    renderTestApplication("/profile", sessionStore());

    expect(await screen.findByRole("heading", { name: "Your Profile" })).toHaveFocus();
    expect(screen.getByDisplayValue("Alex Morgan")).toBeVisible();
    expect(screen.getByText("alex@example.com")).toBeVisible();
    expect(screen.getByText("USER")).toBeVisible();
    expect(screen.queryByDisplayValue("Persisted name")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open your account menu" })).toBeVisible();
    expect(await screen.findByRole("article", { name: "Accessible logo" })).toBeVisible();
    const summary = screen.getByLabelText("Hired Service summary");
    expect(within(summary).getByText("Total").previousElementSibling).toHaveTextContent("1");
    expect(within(summary).getByText("In progress").previousElementSibling).toHaveTextContent("1");
    expect(within(summary).getByText("Completed").previousElementSibling).toHaveTextContent("0");
    expect(screen.getByRole("link", { name: "View Accessible logo" })).toHaveAttribute("href", "/services/42");
    expect(requested).toEqual([userUrl]);
  });

  it("validates safe fields, normalizes tags, saves Profile, then updates Session identity", async () => {
    let body: unknown;
    const store = sessionStore();
    server.use(
      http.get(userUrl, () => HttpResponse.json({ content: currentUser })),
      http.get(hiredUrl, () => HttpResponse.json({ content: [] })),
      http.put(userUrl, async ({ request }) => { body = await request.json(); return HttpResponse.json({ content: { ...currentUser, name: "Alex Updated", skill: ["React", "Vue"] } }); }),
    );
    const user = userEvent.setup();
    renderTestApplication("/profile", store);
    const name = await screen.findByLabelText("Full name");
    await user.clear(name); await user.type(name, "A");
    await user.click(screen.getByRole("button", { name: "Save Profile" }));
    expect(await screen.findByText("Full name must contain 2–50 characters.")).toBeVisible();
    expect(name).toHaveFocus();

    await user.clear(name); await user.type(name, "Alex Updated");
    const skills = screen.getByLabelText("Skills");
    await user.clear(skills); await user.type(skills, "React, react, Vue");
    await user.click(screen.getByRole("button", { name: "Save Profile" }));
    expect(await screen.findByRole("status")).toHaveTextContent("Profile saved successfully");
    expect(body).toMatchObject({ name: "Alex Updated", skill: ["React", "Vue"], email: "alex@example.com", role: "USER" });
    expect(body).not.toHaveProperty("password");
    expect(store.save).toHaveBeenCalledWith(expect.objectContaining({ user: expect.objectContaining({ name: "Alex Updated" }) }));
  });

  it("keeps avatar upload separate and accepts only JPEG, PNG, or WebP", async () => {
    let uploads = 0;
    server.use(
      http.get(userUrl, () => HttpResponse.json({ content: currentUser })),
      http.get(hiredUrl, () => HttpResponse.json({ content: [] })),
      http.post(avatarUrl, () => { uploads += 1; return HttpResponse.json({ content: { ...currentUser, avatar: "https://images.example.test/avatar.webp" } }); }),
    );
    const user = userEvent.setup();
    renderTestApplication("/profile", sessionStore());
    const input = await screen.findByLabelText("Choose Profile image");
    fireEvent.change(input, { target: { files: [new File(["x"], "avatar.gif", { type: "image/gif" })] } });
    expect(await screen.findByRole("alert")).toHaveTextContent("Choose a JPEG, PNG, or WebP image");
    expect(uploads).toBe(0);
    fireEvent.change(input, { target: { files: { 0: new File(["x"], "avatar.webp", { type: "image/webp" }), length: 1, item: (index: number) => index === 0 ? new File(["x"], "avatar.webp", { type: "image/webp" }) : null } } });
    await user.click(screen.getByRole("button", { name: "Upload Avatar" }));
    expect(await screen.findByRole("status")).toHaveTextContent("Avatar uploaded successfully");
    expect(uploads).toBe(1);
  });

  it("fails closed when Profile data changes before Save", async () => {
    let reads = 0;
    let updates = 0;
    server.use(
      http.get(userUrl, () => {
        reads += 1;
        return HttpResponse.json({ content: reads === 1 ? currentUser : { ...currentUser, phone: "+84908888888" } });
      }),
      http.get(hiredUrl, () => HttpResponse.json({ content: [] })),
      http.put(userUrl, () => {
        updates += 1;
        return HttpResponse.json({ content: currentUser });
      }),
    );
    const user = userEvent.setup();
    renderTestApplication("/profile", sessionStore());
    const name = await screen.findByLabelText("Full name");
    await user.clear(name);
    await user.type(name, "Alex Updated");
    await user.click(screen.getByRole("button", { name: "Save Profile" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Profile changed elsewhere");
    expect(updates).toBe(0);
  });

  it("reports avatar failure separately without undoing a successful Profile Save", async () => {
    server.use(
      http.get(userUrl, () => HttpResponse.json({ content: currentUser })),
      http.get(hiredUrl, () => HttpResponse.json({ content: [] })),
      http.put(userUrl, () => HttpResponse.json({ content: { ...currentUser, name: "Alex Saved" } })),
      http.post(avatarUrl, () => HttpResponse.json({ message: "Unavailable" }, { status: 503 })),
    );
    const user = userEvent.setup();
    renderTestApplication("/profile", sessionStore());
    const name = await screen.findByLabelText("Full name");
    await user.clear(name);
    await user.type(name, "Alex Saved");
    await user.click(screen.getByRole("button", { name: "Save Profile" }));
    expect(await screen.findByText("Profile saved successfully.")).toBeVisible();
    const input = screen.getByLabelText("Choose Profile image");
    const image = new File(["x"], "avatar.webp", { type: "image/webp" });
    fireEvent.change(input, { target: { files: { 0: image, length: 1, item: () => image } } });
    await user.click(screen.getByRole("button", { name: "Upload Avatar" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Avatar was not uploaded. Your saved Profile changes are unchanged.");
    expect(screen.getByText("Profile saved successfully.")).toBeVisible();
  });

  it("sends a visitor to Login with a return path", async () => {
    const app = renderTestApplication("/profile");
    expect(await screen.findByRole("heading", { name: "Login" })).toBeVisible();
    expect(app.currentLocation()).toBe("/login?returnTo=%2Fprofile");
  });

  it("shows a focused unavailable state for a missing own Profile", async () => {
    server.use(http.get(userUrl, () => HttpResponse.json({ message: "Missing" }, { status: 404 })), http.get(hiredUrl, () => HttpResponse.json({ content: [] })));
    renderTestApplication("/profile", sessionStore());
    const unavailableHeading = await screen.findByRole("heading", { name: "Profile unavailable" });
    expect(unavailableHeading).toHaveFocus();
    expect(screen.getByRole("link", { name: "Home" })).toHaveAttribute("href", "/");
    expect(within(unavailableHeading.closest("main") as HTMLElement).getByRole("button", { name: "Logout" })).toBeVisible();
    expect(screen.queryByLabelText("Full name")).not.toBeInTheDocument();
  });

  it.each([375, 768, 1440])("keeps Profile sections in logical order at %i px", async (width) => {
    Object.defineProperty(window, "innerWidth", { configurable: true, value: width });
    window.dispatchEvent(new Event("resize"));
    server.use(http.get(userUrl, () => HttpResponse.json({ content: currentUser })), http.get(hiredUrl, () => HttpResponse.json({ content: [] })));
    renderTestApplication("/profile", sessionStore());
    const profile = await screen.findByRole("region", { name: "Profile details" });
    const hired = screen.getByRole("region", { name: "Hired Services" });
    expect(profile.compareDocumentPosition(hired) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(within(profile).getByLabelText("Full name")).toBeVisible();
  });
});
