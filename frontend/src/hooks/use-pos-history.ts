import useSWR from "swr";
import { fetchAPI } from "@/lib/api-client";
import type { PaginatedResponse, TransactionResponse } from "@/types/pos";

interface HistoryParams {
  page?: number;
  limit?: number;
  status?: string;
}

export function usePosHistory(params: HistoryParams = {}) {
  const { page = 1, limit = 20, status } = params;

  const key = `/api/v1/pos/transactions?page=${page}&limit=${limit}${status ? `&status=${status}` : ""}`;

  const { data, error, isLoading, mutate } = useSWR<PaginatedResponse<TransactionResponse>>(
    key,
    () =>
      fetchAPI<PaginatedResponse<TransactionResponse>>("/api/v1/pos/transactions", {
        page,
        limit,
        ...(status ? { status } : {}),
      }),
  );

  return {
    transactions: data?.items ?? [],
    total: data?.total ?? 0,
    page: data?.page ?? page,
    limit: data?.limit ?? limit,
    isLoading,
    isError: !!error,
    mutate,
  };
}
