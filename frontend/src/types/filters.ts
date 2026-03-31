export interface FilterParams {
  start_date?: string; // "YYYY-MM-DD"
  end_date?: string; // "YYYY-MM-DD"
  target_date?: string; // "YYYY-MM-DD" — used by /summary endpoint
  category?: string;
  brand?: string;
  site_key?: number;
  staff_key?: number;
  limit?: number;
}

export interface FilterOption {
  key: number;
  label: string;
}

export interface FilterOptions {
  categories: string[];
  brands: string[];
  sites: FilterOption[];
  staff: FilterOption[];
}
