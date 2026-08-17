import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { delay, http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it } from "vitest";
import { renderTestApplication } from "../test/render-application";
import { server } from "../test/server";

const apiBaseUrl = "http://api.example.test/api";
const servicesListUrl = `${apiBaseUrl}/cong-viec/phan-trang-tim-kiem`;
const servicesUrl = `${apiBaseUrl}/cong-viec`;
const serviceUrl = (id: string) => `${servicesUrl}/${id}`;
const uploadImageUrl = (id: string) => `${servicesUrl}/upload-hinh-cong-viec/${id}`;
const usersUrl = `${apiBaseUrl}/users`;
const hiresUrl = `${apiBaseUrl}/thue-cong-viec`;

const alice = { id: 100, name: "Alice Seller", email: "alice@example.com", phone: "", birthday: "", avatar: null, gender: true, role: "USER", skill: [], certification: [] };
const bob = { id: 101, name: "Bob Seller", email: "bob@example.com", phone: "", birthday: "", avatar: null, gender: true, role: "USER", skill: [], certification: [] };

const serviceOne = {
  id: 1,
  tenCongViec: "Design a modern logo",
  moTa: "Full logo design description",
  moTaNgan: "Short logo pitch",
  giaTien: 25,
  hinhAnh: null,
  saoCongViec: 4,
  danhGia: 12,
  nguoiTao: 100,
  maChiTietLoaiCongViec: 100,
  tenNguoiTao: "Alice Seller",
};

const serviceTwo = {
  id: 2,
  tenCongViec: "Build a landing page",
  moTa: "Full landing page description",
  moTaNgan: "Short landing pitch",
  giaTien: 80,
  hinhAnh: null,
  saoCongViec: 5,
  danhGia: 3,
  nguoiTao: 101,
  maChiTietLoaiCongViec: 100,
  tenNguoiTao: "Bob Seller",
};

function listResponse(data = [serviceOne, serviceTwo], totalRow = 2) {
  return { content: { pageIndex: 1, pageSize: 10, totalRow, keywords: null, data } };
}

function installDefaultHandlers() {
  server.use(
    http.get(servicesListUrl, () => HttpResponse.json(listResponse())),
    http.get(servicesUrl, () => HttpResponse.json({ content: [serviceOne, serviceTwo] })),
    http.get(serviceUrl("1"), () => HttpResponse.json({ content: [serviceOne] })),
    http.get(serviceUrl("2"), () => HttpResponse.json({ content: [serviceTwo] })),
    http.get(usersUrl, () => HttpResponse.json({ content: [alice, bob] })),
    http.get(`${usersUrl}/search/:name`, ({ params }) => {
      const needle = decodeURIComponent(String(params.name)).toLowerCase();
      return HttpResponse.json({ content: [alice, bob].filter((seller) => seller.name.toLowerCase().includes(needle)) });
    }),
    http.get(hiresUrl, () => HttpResponse.json({ content: [] })),
  );
}

async function pickSeller(name: string) {
  const user = userEvent.setup();
  const picker = screen.getByRole("combobox", { name: /Seller/ });
  await user.click(picker);
  await user.type(picker, name);
  const option = await screen.findByRole("option", { name: new RegExp(name) });
  await user.click(option);
}

describe("Admin Service Management", () => {
  beforeEach(() => {
    Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
    installDefaultHandlers();
  });

  it("renders Service rows with seller, price and rating, and exactly the supported page sizes", async () => {
    const application = renderTestApplication({ initialPath: "/admin/services", isAdmin: true });
    const user = userEvent.setup();
    const heading = await screen.findByRole("heading", { name: "Service Management" }, { timeout: 5_000 });
    expect(heading).toHaveFocus();
    expect(document.title).toBe("Service Management | Administrator");

    const table = await screen.findByRole("grid", { name: "Service list" });
    const rows = within(table).getAllByRole("row");
    expect(rows).toHaveLength(3);
    expect(within(rows[1]).getByText("Design a modern logo")).toBeVisible();
    expect(within(rows[1]).getByText("Alice Seller")).toBeVisible();
    expect(within(rows[1]).getByText("$25")).toBeVisible();
    expect(within(rows[1]).getByRole("link", { name: "View Design a modern logo" })).toBeVisible();

    const pageSize = screen.getByRole("combobox", { name: "Page size" });
    expect(within(pageSize).getAllByRole("option").map((option) => option.getAttribute("value"))).toEqual(["10", "25", "50"]);
    await user.selectOptions(pageSize, "25");
    expect(application.currentLocation()).toBe("/admin/services?page=1&pageSize=25");
  });

  it("normalizes q/page/pageSize in the URL and sends the search keyword", async () => {
    let keyword: string | null = null;
    server.use(http.get(servicesListUrl, ({ request }) => {
      keyword = new URL(request.url).searchParams.get("keyword");
      return HttpResponse.json(listResponse(keyword ? [serviceOne] : [serviceOne, serviceTwo], keyword ? 1 : 2));
    }));
    const application = renderTestApplication({ initialPath: "/admin/services?page=0&pageSize=999", isAdmin: true });
    await screen.findByRole("grid", { name: "Service list" }, { timeout: 5_000 });
    expect(application.currentLocation()).toBe("/admin/services?page=1&pageSize=10");

    const user = userEvent.setup();
    await user.type(screen.getByRole("searchbox", { name: "Search Services by title" }), "logo");
    await waitFor(() => expect(keyword).toBe("logo"));
    expect(application.currentLocation()).toBe("/admin/services?q=logo&page=1&pageSize=10");
  });

  it("distinguishes loading, refreshing, empty and query-empty states", async () => {
    let requestCount = 0;
    server.use(http.get(servicesListUrl, async ({ request }) => {
      requestCount += 1;
      if (requestCount === 1) await delay(40);
      if (requestCount === 2) await delay(80);
      const keyword = new URL(request.url).searchParams.get("keyword");
      return HttpResponse.json(keyword ? listResponse([], 0) : listResponse());
    }));
    const user = userEvent.setup();
    const application = renderTestApplication({ initialPath: "/admin/services", isAdmin: true });

    expect(await screen.findByText("Loading Services...")).toHaveAttribute("data-state", "loading");
    await screen.findByRole("grid", { name: "Service list" });
    await user.click(screen.getByRole("button", { name: "Refresh Services" }));
    expect(await screen.findByText("Refreshing Services...")).toHaveAttribute("data-state", "refreshing");
    await waitFor(() => expect(screen.getByRole("button", { name: "Refresh Services" })).toBeEnabled());

    await user.type(screen.getByRole("searchbox", { name: "Search Services by title" }), "missing");
    expect(await screen.findByText(/No Services match your search/)).toHaveAttribute("data-state", "query-empty");
    application.unmount();

    server.use(http.get(servicesListUrl, () => HttpResponse.json(listResponse([], 0))));
    const empty = renderTestApplication({ initialPath: "/admin/services", isAdmin: true });
    expect(await screen.findByText("No Services found.")).toHaveAttribute("data-state", "empty");
    empty.unmount();
  });

  it("falls back to the complete Service API snapshot when the paging response cannot be parsed", async () => {
    server.use(
      http.get(servicesListUrl, () => HttpResponse.json({ content: "bad-shape" })),
      http.get(servicesUrl, () => HttpResponse.json({ content: [serviceOne, serviceTwo] })),
    );

    renderTestApplication({ initialPath: "/admin/services", isAdmin: true });

    const table = await screen.findByRole("grid", { name: "Service list" });
    expect(within(table).getByText("Design a modern logo")).toBeVisible();
    expect(screen.getByText(/client-filtered view of the complete Service API snapshot/)).toHaveAttribute("data-scope", "client-fallback");
    expect(screen.queryByText("The server returned an invalid response.")).not.toBeInTheDocument();
  });

  it("distinguishes malformed, offline, forbidden and not-found failures", async () => {
    server.use(http.get(servicesListUrl, () => HttpResponse.json({ content: "bad-shape" })), http.get(servicesUrl, () => HttpResponse.json({ content: "also-bad" })));
    const malformed = renderTestApplication({ initialPath: "/admin/services", isAdmin: true });
    expect(await screen.findByRole("alert")).toHaveTextContent("invalid response");
    malformed.unmount();

    Object.defineProperty(navigator, "onLine", { configurable: true, value: false });
    server.use(http.get(servicesListUrl, () => HttpResponse.error()));
    const offline = renderTestApplication({ initialPath: "/admin/services", isAdmin: true });
    expect(await screen.findByRole("alert")).toHaveTextContent("You are offline");
    offline.unmount();
    Object.defineProperty(navigator, "onLine", { configurable: true, value: true });

    server.use(http.get(servicesListUrl, () => HttpResponse.json({ message: "Forbidden" }, { status: 403 })));
    const forbidden = renderTestApplication({ initialPath: "/admin/services", isAdmin: true });
    expect(await screen.findByRole("alert")).toHaveTextContent("Access forbidden");
    forbidden.unmount();

    server.use(http.get(serviceUrl("999"), () => HttpResponse.json({ message: "Not found" }, { status: 404 })));
    renderTestApplication({ initialPath: "/admin/services/999", isAdmin: true });
    expect(await screen.findByRole("alert")).toHaveTextContent("Service not found");
  });

  it("creates a Service via the Seller picker and Taxonomy cascade, starting review count at 0", async () => {
    let body: Record<string, unknown> | undefined;
    server.use(http.post(servicesUrl, async ({ request }) => {
      body = await request.json() as Record<string, unknown>;
      return HttpResponse.json({ content: { ...serviceOne, id: 5, tenCongViec: body.tenCongViec, danhGia: 0 } });
    }));
    const application = renderTestApplication({ initialPath: "/admin/services/new", isAdmin: true });
    const user = userEvent.setup();
    await screen.findByRole("heading", { name: "Create Service" });

    await user.type(screen.getByRole("textbox", { name: /Title/ }), "New Service Title");
    await user.type(screen.getByRole("textbox", { name: /Short Description/ }), "Short desc");
    await user.type(screen.getByRole("textbox", { name: /^Description/ }), "Full desc");
    await user.clear(screen.getByRole("spinbutton", { name: /Price/ }));
    await user.type(screen.getByRole("spinbutton", { name: /Price/ }), "40");
    await pickSeller("Alice");
    await screen.findByRole("option", { name: "Graphics & Design" });
    await user.selectOptions(screen.getByRole("combobox", { name: /Category/ }), "1");
    await user.selectOptions(screen.getByRole("combobox", { name: /Group/ }), "10");
    await user.selectOptions(screen.getByRole("combobox", { name: /Subcategory/ }), "100");

    await user.click(screen.getByRole("button", { name: "Create Service" }));
    await waitFor(() => expect(body).toBeDefined());
    expect(body).toMatchObject({ tenCongViec: "New Service Title", nguoiTao: 100, danhGia: 0 });
    expect(body).not.toHaveProperty("password");
    await waitFor(() => expect(application.currentLocation()).toBe("/admin/services"));
    expect(screen.getByText(/created successfully/)).toHaveAttribute("data-state", "confirmed-success");
    expect(screen.getByRole("link", { name: "Add an image now" })).toHaveAttribute("href", "/admin/services/5/edit");
  });

  it("requires a Seller selection and a Subcategory before Create submits", async () => {
    renderTestApplication({ initialPath: "/admin/services/new", isAdmin: true });
    const user = userEvent.setup();
    await screen.findByRole("heading", { name: "Create Service" });
    await user.type(screen.getByRole("textbox", { name: /Title/ }), "New Service Title");
    await user.type(screen.getByRole("textbox", { name: /Short Description/ }), "Short desc");
    await user.type(screen.getByRole("textbox", { name: /^Description/ }), "Full desc");
    await user.clear(screen.getByRole("spinbutton", { name: /Price/ }));
    await user.type(screen.getByRole("spinbutton", { name: /Price/ }), "40");

    await user.click(screen.getByRole("button", { name: "Create Service" }));
    expect(await screen.findByText("Choose a Seller from existing Users.")).toBeVisible();
  });

  it("loads Service Detail with review count read-only and an empty image state", async () => {
    renderTestApplication({ initialPath: "/admin/services/1", isAdmin: true });
    const heading = await screen.findByRole("heading", { name: "Service Detail" });
    expect(heading).toHaveFocus();
    expect(document.title).toBe("Service Detail | Administrator");
    expect(await screen.findByText("Design a modern logo")).toBeVisible();
    expect(screen.getByText(/12 \(server-tracked, not editable\)/)).toBeVisible();
    expect(screen.getByText("No image uploaded.")).toBeVisible();
    const actions = screen.getByRole("navigation", { name: "Service detail actions" });
    expect(within(actions).getByRole("link", { name: "Back to list" })).toBeVisible();
    expect(within(actions).getByRole("link", { name: "Edit Service" })).toBeVisible();
  });

  it("edits a Service without opening the transfer dialog when Seller is unchanged, and preserves review count", async () => {
    let body: Record<string, unknown> | undefined;
    server.use(http.put(serviceUrl("1"), async ({ request }) => {
      body = await request.json() as Record<string, unknown>;
      return HttpResponse.json({ content: { ...serviceOne, tenCongViec: body.tenCongViec } });
    }));
    const application = renderTestApplication({ initialPath: "/admin/services/1/edit", isAdmin: true });
    const user = userEvent.setup();
    const title = await screen.findByRole("textbox", { name: /Title/ });
    await user.clear(title);
    await user.type(title, "Design a refreshed logo");
    await user.click(screen.getByRole("button", { name: "Save Changes" }));

    await waitFor(() => expect(body).toBeDefined());
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(body).toMatchObject({ id: 1, tenCongViec: "Design a refreshed logo", nguoiTao: 100, danhGia: 12 });
    await waitFor(() => expect(application.currentLocation()).toBe("/admin/services/1"));
  });

  it("reports image upload failure independently, without affecting the metadata form", async () => {
    server.use(http.post(uploadImageUrl("1"), () => HttpResponse.json({ message: "Unavailable" }, { status: 503 })));
    renderTestApplication({ initialPath: "/admin/services/1/edit", isAdmin: true });
    const title = await screen.findByRole("textbox", { name: /Title/ });

    const fileInput = screen.getByLabelText(/Upload a new image/);
    fireEvent.change(fileInput, { target: { files: [new File(["fake-bytes"], "logo.png", { type: "image/png" })] } });
    const uploadAlert = await screen.findByRole("alert");
    expect(uploadAlert).toHaveTextContent("Server error");
    expect(screen.queryByText("Image uploaded successfully.")).not.toBeInTheDocument();
    expect(title).toHaveValue("Design a modern logo");
    expect(screen.getByRole("button", { name: "Save Changes" })).toBeEnabled();
  });

  it("uploads a Service image successfully, independent of the metadata form", async () => {
    server.use(http.post(uploadImageUrl("1"), () => HttpResponse.json({
      content: { ...serviceOne, hinhAnh: "https://images.example.test/new-logo.jpg" },
    })));
    renderTestApplication({ initialPath: "/admin/services/1/edit", isAdmin: true });
    const title = await screen.findByRole("textbox", { name: /Title/ });

    const fileInput = screen.getByLabelText(/Upload a new image/);
    fireEvent.change(fileInput, { target: { files: [new File(["fake-bytes"], "logo.png", { type: "image/png" })] } });
    expect(await screen.findByText("Image uploaded successfully.")).toHaveAttribute("data-state", "confirmed-success");
    expect(title).toHaveValue("Design a modern logo");
  });

  it("rejects an unsupported image type and an oversized image locally without a network call", async () => {
    let uploads = 0;
    server.use(http.post(uploadImageUrl("1"), () => { uploads += 1; return HttpResponse.json({ content: serviceOne }); }));
    renderTestApplication({ initialPath: "/admin/services/1/edit", isAdmin: true });
    const fileInput = await screen.findByLabelText(/Upload a new image/);

    fireEvent.change(fileInput, { target: { files: [new File(["fake"], "notes.txt", { type: "text/plain" })] } });
    expect(await screen.findByText("Choose a JPEG, PNG, or WebP image.")).toBeVisible();
    expect(uploads).toBe(0);

    fireEvent.change(fileInput, { target: { files: [new File([new Uint8Array(6 * 1024 * 1024)], "big.png", { type: "image/png" })] } });
    expect(await screen.findByText("Choose an image 5 MB or smaller.")).toBeVisible();
    expect(uploads).toBe(0);
  });

  it("deletes a Service after typed title confirmation", async () => {
    let deletedUrl: string | undefined;
    server.use(http.delete(serviceUrl("1"), ({ request }) => { deletedUrl = request.url; return HttpResponse.json({ content: null }); }));
    renderTestApplication({ initialPath: "/admin/services", isAdmin: true });
    const user = userEvent.setup();
    await screen.findByRole("grid", { name: "Service list" });
    await user.click(screen.getByRole("button", { name: "Delete Design a modern logo" }));
    const dialog = screen.getByRole("dialog", { name: "Delete Design a modern logo?" });
    expect(within(dialog).getByRole("textbox", { name: "Type Design a modern logo to confirm" })).toBeVisible();
    await user.type(within(dialog).getByRole("textbox"), "Design a modern logo");
    await user.click(within(dialog).getByRole("button", { name: /Confirm Delete/ }));
    await waitFor(() => expect(deletedUrl).toBe(serviceUrl("1")));
    expect(await screen.findByText(/deleted successfully/)).toHaveAttribute("data-state", "confirmed-success");
  });
});
