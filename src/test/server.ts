import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";

const initialServiceDtos = Array.from({ length: 7 }, (_, index) => ({
  id: index + 1,
  tenCongViec: `Service ${index + 1}`,
  moTa: `Description ${index + 1}`,
  giaTien: (index + 1) * 10,
  hinhAnh: `https://images.example.test/service-${index + 1}.jpg`,
  saoCongViec: 5,
  nguoiTao: 100 + index,
}));

let serviceDtos = structuredClone(initialServiceDtos);

export function resetTestData() {
  serviceDtos = structuredClone(initialServiceDtos);
}

export const handlers = [
  http.get("http://api.example.test/api/cong-viec", ({ request }) => {
    if (request.headers.get("tokenCybersoft") !== "deterministic-test-token") {
      return HttpResponse.json({ message: "Missing test token" }, { status: 401 });
    }

    return HttpResponse.json({
      statusCode: 200,
      message: "Success",
      content: serviceDtos,
      dateTime: "2026-08-12T00:00:00.000Z",
    });
  }),
];

export const server = setupServer(...handlers);
