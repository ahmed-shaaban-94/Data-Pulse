import { useState } from "react";
import { postAPI } from "@/lib/api-client";
import type {
  TransactionCreateRequest,
  TransactionDetailResponse,
  AddItemRequest,
  UpdateItemRequest,
  CheckoutRequest,
  CheckoutResponse,
  VoidRequest,
  TransactionResponse,
} from "@/types/pos";

interface CheckoutState {
  transactionId: number | null;
  isLoading: boolean;
  error: string | null;
}

export function usePosCheckout() {
  const [state, setState] = useState<CheckoutState>({
    transactionId: null,
    isLoading: false,
    error: null,
  });

  function setLoading(isLoading: boolean) {
    setState((s) => ({ ...s, isLoading, error: null }));
  }

  function setError(error: string) {
    setState((s) => ({ ...s, isLoading: false, error }));
  }

  async function createTransaction(
    req: TransactionCreateRequest,
  ): Promise<TransactionDetailResponse> {
    setLoading(true);
    try {
      const txn = await postAPI<TransactionDetailResponse>("/api/v1/pos/transactions", req);
      setState({ transactionId: txn.id, isLoading: false, error: null });
      return txn;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create transaction");
      throw e;
    }
  }

  async function addItem(
    transactionId: number,
    req: AddItemRequest,
  ): Promise<TransactionDetailResponse> {
    setLoading(true);
    try {
      const txn = await postAPI<TransactionDetailResponse>(
        `/api/v1/pos/transactions/${transactionId}/items`,
        req,
      );
      setState((s) => ({ ...s, isLoading: false }));
      return txn;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to add item");
      throw e;
    }
  }

  async function updateItem(
    transactionId: number,
    itemIdx: number,
    req: UpdateItemRequest,
  ): Promise<TransactionDetailResponse> {
    return postAPI<TransactionDetailResponse>(
      `/api/v1/pos/transactions/${transactionId}/items/${itemIdx}`,
      req,
    );
  }

  async function removeItem(
    transactionId: number,
    itemIdx: number,
  ): Promise<TransactionDetailResponse> {
    // deleteAPI discards the response body; use _request via getAuthHeaders directly
    const { getSession } = await import("next-auth/react");
    const { API_BASE_URL } = await import("@/lib/constants");
    const session = await getSession();
    const token = session?.accessToken ?? null;
    const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
    const res = await fetch(
      `${API_BASE_URL}/api/v1/pos/transactions/${transactionId}/items/${itemIdx}`,
      { method: "DELETE", headers },
    );
    if (!res.ok) {
      const body = await res.text().catch(() => "Unknown error");
      throw new Error(`API error ${res.status}: ${body}`);
    }
    return res.json() as Promise<TransactionDetailResponse>;
  }

  async function checkout(
    transactionId: number,
    req: CheckoutRequest,
  ): Promise<CheckoutResponse> {
    setLoading(true);
    try {
      const res = await postAPI<CheckoutResponse>(
        `/api/v1/pos/transactions/${transactionId}/checkout`,
        req,
      );
      setState({ transactionId: null, isLoading: false, error: null });
      return res;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Checkout failed");
      throw e;
    }
  }

  async function voidTransaction(
    transactionId: number,
    req: VoidRequest,
  ): Promise<TransactionResponse> {
    return postAPI<TransactionResponse>(
      `/api/v1/pos/transactions/${transactionId}/void`,
      req,
    );
  }

  return {
    ...state,
    createTransaction,
    addItem,
    updateItem,
    removeItem,
    checkout,
    voidTransaction,
  };
}
