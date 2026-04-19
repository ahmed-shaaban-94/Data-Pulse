"use client";

import { useState } from "react";
import { Ticket, Loader2, X } from "lucide-react";
import { useVoucherValidate } from "@/hooks/use-voucher-validate";
import { cn } from "@/lib/utils";
import type { VoucherValidateResponse } from "@/types/vouchers";

interface VoucherCodeModalProps {
  /** Current cart subtotal — forwarded to the validate endpoint so the
   * server can enforce min_purchase and so the modal can preview the
   * resulting discount before the cashier commits. */
  cartSubtotal: number;
  /** Invoked with the validated voucher payload once the cashier clicks
   * Confirm. Caller is responsible for storing it on the cart / navigating. */
  onConfirm: (voucher: VoucherValidateResponse, discount: number) => void;
  onCancel: () => void;
}

function fmt(n: number): string {
  return n.toLocaleString("ar-EG", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Compute the preview discount without committing. Kept exported for tests
 * and for the cart context so both sides agree on rounding. */
export function computeVoucherDiscount(
  voucher: Pick<VoucherValidateResponse, "discount_type" | "value">,
  cartSubtotal: number,
): number {
  if (voucher.discount_type === "percent") {
    const raw = (cartSubtotal * voucher.value) / 100;
    const capped = Math.min(raw, cartSubtotal);
    return Math.round(capped * 100) / 100;
  }
  // amount: never exceed the subtotal (no negative totals)
  return Math.min(voucher.value, cartSubtotal);
}

export function VoucherCodeModal({ cartSubtotal, onConfirm, onCancel }: VoucherCodeModalProps) {
  const [code, setCode] = useState("");
  const { data, error, isLoading, validate, reset } = useVoucherValidate();

  async function handleValidate() {
    await validate({ code, cart_subtotal: cartSubtotal });
  }

  function handleConfirm() {
    if (!data) return;
    onConfirm(data, computeVoucherDiscount(data, cartSubtotal));
  }

  const discountPreview = data ? computeVoucherDiscount(data, cartSubtotal) : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div
        role="dialog"
        aria-label="Enter voucher code"
        className="w-full max-w-sm rounded-2xl border border-border bg-surface shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="flex items-center gap-2">
            <Ticket className="h-4 w-4 text-amber-400" />
            <span className="text-sm font-semibold text-text-primary">Voucher Code</span>
          </div>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Close"
            className="rounded-lg p-1 text-text-secondary hover:bg-surface-raised"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="space-y-4 p-4">
          {/* Cart subtotal line — gives the cashier something to anchor the preview */}
          <div className="flex items-center justify-between rounded-xl border border-border/50 bg-surface-raised px-3 py-2">
            <span className="text-xs text-text-secondary">Cart Subtotal</span>
            <span className="text-sm font-semibold tabular-nums text-text-primary">
              EGP {fmt(cartSubtotal)}
            </span>
          </div>

          {/* Code input */}
          <div>
            <label htmlFor="voucher-code-input" className="mb-1 block text-xs font-medium text-text-secondary">
              Code
            </label>
            <input
              id="voucher-code-input"
              type="text"
              value={code}
              onChange={(e) => {
                setCode(e.target.value.toUpperCase());
                if (data || error) reset();
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !data) handleValidate();
              }}
              disabled={isLoading || Boolean(data)}
              placeholder="e.g. SUMMER25"
              autoFocus
              className={cn(
                "w-full rounded-xl border border-border bg-surface px-3 py-2.5",
                "font-mono text-base tracking-wider text-text-primary placeholder:text-text-secondary",
                "focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent",
                "disabled:opacity-60",
              )}
            />
          </div>

          {/* Error */}
          {error && (
            <p role="alert" className="text-xs text-destructive">
              {error}
            </p>
          )}

          {/* Preview */}
          {data && (
            <div className="space-y-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-amber-200">
                  {data.discount_type === "percent"
                    ? `${data.value}% off`
                    : `EGP ${fmt(data.value)} off`}
                </span>
                <span className="rounded-full bg-amber-500/30 px-2 py-0.5 text-[10px] font-semibold text-amber-200">
                  {data.remaining_uses} use{data.remaining_uses === 1 ? "" : "s"} left
                </span>
              </div>
              <div className="flex items-center justify-between border-t border-amber-500/20 pt-2">
                <span className="text-xs text-text-secondary">Discount preview</span>
                <span className="text-base font-bold tabular-nums text-amber-200">
                  -EGP {fmt(discountPreview)}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs text-text-secondary">
                <span>New total</span>
                <span className="tabular-nums">
                  EGP {fmt(Math.max(cartSubtotal - discountPreview, 0))}
                </span>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 rounded-xl border border-border py-2.5 text-sm font-medium text-text-secondary hover:bg-surface-raised"
            >
              Cancel
            </button>
            {!data ? (
              <button
                type="button"
                onClick={handleValidate}
                disabled={isLoading || code.trim().length === 0}
                className={cn(
                  "flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5",
                  "bg-amber-500/20 text-sm font-semibold text-amber-200",
                  "hover:bg-amber-500/30 disabled:pointer-events-none disabled:opacity-40",
                )}
              >
                {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                Validate
              </button>
            ) : (
              <button
                type="button"
                onClick={handleConfirm}
                className={cn(
                  "flex flex-1 items-center justify-center rounded-xl py-2.5",
                  "bg-accent text-sm font-semibold text-accent-foreground",
                  "shadow-[0_8px_24px_rgba(0,199,242,0.2)] hover:bg-accent/90",
                )}
              >
                Confirm
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
