import { postAPI } from "@/lib/api-client";
import type { ReturnResponse } from "@/types/pos";

interface ProcessReturnRequest {
  original_transaction_id: number;
  reason: string;
  refund_method: "cash" | "credit_note";
  notes?: string;
}

export async function processReturn(req: ProcessReturnRequest): Promise<ReturnResponse> {
  return postAPI<ReturnResponse>("/api/v1/pos/returns", req);
}

export async function voidTransaction(
  transactionId: number,
  reason: string,
): Promise<void> {
  await postAPI(`/api/v1/pos/transactions/${transactionId}/void`, { reason });
}
