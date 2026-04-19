import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import {
  VoucherCodeModal,
  computeVoucherDiscount,
} from "@/components/pos/VoucherCodeModal";

describe("computeVoucherDiscount", () => {
  it("applies percent on subtotal", () => {
    expect(computeVoucherDiscount({ discount_type: "percent", value: 25 }, 200)).toBe(50);
  });

  it("caps percent discount at subtotal", () => {
    expect(
      computeVoucherDiscount({ discount_type: "percent", value: 150 }, 100),
    ).toBe(100);
  });

  it("caps fixed amount discount at subtotal", () => {
    expect(computeVoucherDiscount({ discount_type: "amount", value: 500 }, 200)).toBe(
      200,
    );
  });

  it("returns fixed amount when below subtotal", () => {
    expect(computeVoucherDiscount({ discount_type: "amount", value: 50 }, 200)).toBe(
      50,
    );
  });
});

describe("VoucherCodeModal", () => {
  it("validates a code and shows a discount preview", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    const onCancel = vi.fn();

    render(
      <VoucherCodeModal cartSubtotal={200} onConfirm={onConfirm} onCancel={onCancel} />,
    );

    const input = screen.getByLabelText(/^code$/i);
    await user.type(input, "summer25");
    await user.click(screen.getByRole("button", { name: /validate/i }));

    // Preview line "25% off" appears after validation
    await waitFor(() =>
      expect(screen.getByText(/25% off/i)).toBeInTheDocument(),
    );
    // Preview row labelled "Discount preview" appears after validation
    expect(screen.getByText(/discount preview/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /confirm/i }));
    expect(onConfirm).toHaveBeenCalledOnce();
    const [voucherArg, discountArg] = onConfirm.mock.calls[0];
    expect(voucherArg.code).toBe("SUMMER25");
    expect(discountArg).toBe(50);
  });

  it("shows voucher_not_found error for unknown code", async () => {
    const user = userEvent.setup();
    render(
      <VoucherCodeModal cartSubtotal={100} onConfirm={vi.fn()} onCancel={vi.fn()} />,
    );

    await user.type(screen.getByLabelText(/^code$/i), "nope");
    await user.click(screen.getByRole("button", { name: /validate/i }));

    await waitFor(() => {
      const alert = screen.getByRole("alert");
      expect(alert).toHaveTextContent(/not found/i);
    });
    // Confirm button never appears — validate button stays
    expect(screen.queryByRole("button", { name: /confirm/i })).not.toBeInTheDocument();
  });

  it("shows voucher_expired error", async () => {
    const user = userEvent.setup();
    render(
      <VoucherCodeModal cartSubtotal={100} onConfirm={vi.fn()} onCancel={vi.fn()} />,
    );

    await user.type(screen.getByLabelText(/^code$/i), "expired");
    await user.click(screen.getByRole("button", { name: /validate/i }));

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(/expired/i),
    );
  });

  it("submits on Enter key", async () => {
    const user = userEvent.setup();
    render(
      <VoucherCodeModal cartSubtotal={200} onConfirm={vi.fn()} onCancel={vi.fn()} />,
    );
    const input = screen.getByLabelText(/^code$/i);
    await user.type(input, "summer25");
    fireEvent.keyDown(input, { key: "Enter" });
    await waitFor(() => expect(screen.getByText(/25% off/i)).toBeInTheDocument());
  });

  it("Cancel fires onCancel", async () => {
    const onCancel = vi.fn();
    render(
      <VoucherCodeModal cartSubtotal={100} onConfirm={vi.fn()} onCancel={onCancel} />,
    );
    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it("resets state when the code is edited after an error", async () => {
    const user = userEvent.setup();
    render(
      <VoucherCodeModal cartSubtotal={100} onConfirm={vi.fn()} onCancel={vi.fn()} />,
    );

    const input = screen.getByLabelText(/^code$/i);
    await user.type(input, "nope");
    await user.click(screen.getByRole("button", { name: /validate/i }));
    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());

    await user.type(input, "x");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
