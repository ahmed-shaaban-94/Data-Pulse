// Typed POS transaction endpoints. Wraps ApiClient with placeholder
// request/response types until Sub-PR 5 regenerates the OpenAPI contract
// to include POS routes. Until then these types are intentionally loose
// so consumers can adopt the typed surface incrementally.

import type { ApiClient } from "@pos/api/client";

export interface CreateTransactionResponse {
  transaction_id: number;
  status: string;
}

export interface AddItemRequest {
  drug_code: string;
  quantity: number;
  unit_price?: number;
}

export interface AddItemResponse {
  transaction_id: number;
  item_id: number;
  line_total: number;
}

export interface CommitRequest {
  transaction_id: number;
  payment_method: string;
  amount_received: number;
}

export interface CommitResponse {
  transaction_id: number;
  receipt_number: string;
  change_due: number;
}

export interface TransactionEndpoints {
  create: () => Promise<CreateTransactionResponse>;
  addItem: (txnId: number, body: AddItemRequest) => Promise<AddItemResponse>;
  commit: (body: CommitRequest) => Promise<CommitResponse>;
}

export function createTransactionEndpoints(client: ApiClient): TransactionEndpoints {
  return {
    create: () => client.request("POST", "/api/v1/pos/transactions", {}),
    addItem: (txnId, body) =>
      client.request("POST", `/api/v1/pos/transactions/${txnId}/items`, body),
    commit: (body) => client.request("POST", "/api/v1/pos/transactions/commit", body),
  };
}
