import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { http, HttpResponse } from "msw";

import { usePosCheckout } from "@/hooks/use-pos-checkout";
import { server } from "@/__tests__/mocks/server";

const API = process.env.NEXT_PUBLIC_API_URL || "";

/**
 * Verifies the checkout page wiring: voucher_code on CheckoutRequest
 * reaches the server body. The page itself spreads `voucher_code` into
 * the payload when the cart has a voucher — this test exercises the
 * transport contract the page relies on.
 */
describe("usePosCheckout voucher_code forwarding", () => {
  it("sends voucher_code in the checkout body when provided", async () => {
    let captured: Record<string, unknown> | null = null;

    server.use(
      http.post(`${API}/api/v1/pos/transactions/:id/checkout`, async ({ request }) => {
        captured = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({
          transaction: {
            id: 42,
            tenant_id: 1,
            terminal_id: 1,
            staff_id: "s1",
            pharmacist_id: null,
            customer_id: null,
            site_code: "S1",
            subtotal: 200,
            discount_total: 50,
            tax_total: 0,
            grand_total: 150,
            payment_method: "cash",
            status: "completed",
            receipt_number: "R-0001",
            created_at: "2026-04-19T00:00:00Z",
          },
          change_amount: 0,
          receipt_number: "R-0001",
        });
      }),
    );

    const { result } = renderHook(() => usePosCheckout());

    await act(async () => {
      await result.current.checkout(42, {
        payment_method: "cash",
        voucher_code: "SUMMER25",
      });
    });

    expect(captured).not.toBeNull();
    expect(captured!.payment_method).toBe("cash");
    expect(captured!.voucher_code).toBe("SUMMER25");
  });

  it("omits voucher_code when not provided", async () => {
    let captured: Record<string, unknown> | null = null;

    server.use(
      http.post(`${API}/api/v1/pos/transactions/:id/checkout`, async ({ request }) => {
        captured = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({
          transaction: {
            id: 42,
            tenant_id: 1,
            terminal_id: 1,
            staff_id: "s1",
            pharmacist_id: null,
            customer_id: null,
            site_code: "S1",
            subtotal: 200,
            discount_total: 0,
            tax_total: 0,
            grand_total: 200,
            payment_method: "cash",
            status: "completed",
            receipt_number: "R-0002",
            created_at: "2026-04-19T00:00:00Z",
          },
          change_amount: 0,
          receipt_number: "R-0002",
        });
      }),
    );

    const { result } = renderHook(() => usePosCheckout());

    await act(async () => {
      await result.current.checkout(42, { payment_method: "cash" });
    });

    expect(captured).not.toBeNull();
    expect(captured!.voucher_code).toBeUndefined();
  });
});
