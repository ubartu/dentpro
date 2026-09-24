import { ApiError, request } from "../src/lib/api";
afterEach(() => jest.restoreAllMocks());
it("sends a bearer token and idempotency key, with prices left as integer values", async () => {
  const fetcher = jest
    .spyOn(globalThis, "fetch")
    .mockResolvedValue({
      ok: true,
      json: async () => ({ total_minor: 650050 }),
    } as Response);
  const result = await request(
    "/cases",
    "secret",
    "POST",
    { consent: true },
    "request-key",
  );
  expect(result).toEqual({ total_minor: 650050 });
  expect(fetcher.mock.calls[0][1]?.headers).toEqual(
    expect.objectContaining({
      Authorization: "Bearer secret",
      "Idempotency-Key": "request-key",
    }),
  );
});
it("preserves API rejection status so expired sessions and stale proposals are handled", async () => {
  jest
    .spyOn(globalThis, "fetch")
    .mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ detail: "Session expired" }),
    } as Response);
  await expect(request("/patient/me", "old")).rejects.toMatchObject({
    status: 401,
    message: "Session expired",
  });
});
it("makes connection failures actionable without automatically retrying a mutation", async () => {
  const fetcher = jest
    .spyOn(globalThis, "fetch")
    .mockRejectedValue(new TypeError("Network request failed"));
  await expect(
    request("/appointments", "token", "POST", {}),
  ).rejects.toBeInstanceOf(ApiError);
  expect(fetcher).toHaveBeenCalledTimes(1);
});
