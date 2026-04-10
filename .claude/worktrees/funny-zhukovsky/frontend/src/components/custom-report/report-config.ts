import type { LucideIcon } from "lucide-react";
import {
  TrendingUp,
  Package,
  MapPin,
  Users,
  UserCog,
  CreditCard,
  Calendar,
  RotateCcw,
  Plus,
} from "lucide-react";

// ---- Friendly label maps ----
// Keys MUST match the exact column/metric names from the Explore API
// (auto-discovered from dbt YAML: dbt/models/marts/*/_*__models.yml)

/** Map dimension API names to user-friendly labels */
export const DIMENSION_LABELS: Record<string, string> = {
  // Date (from dim_date)
  year_month: "Month",
  quarter_label: "Quarter",
  quarter: "Quarter #",
  year: "Year",
  month: "Month #",
  month_name: "Month Name",
  day_of_week: "Day of Week #",
  day_name: "Day Name",
  week_number: "Week #",
  year_week: "Year-Week",
  full_date: "Date",
  is_weekend: "Weekend?",
  // Product (from dim_product)
  drug_name: "Product Name",
  drug_code: "Product Code",
  drug_brand: "Brand",
  drug_category: "Category",
  drug_subcategory: "Sub-Category",
  drug_division: "Division",
  drug_segment: "Segment",
  drug_status: "Product Status",
  drug_cluster: "Cluster",
  buyer: "Buyer",
  is_temporary: "Temporary?",
  // Customer (from dim_customer)
  customer_name: "Customer",
  customer_id: "Customer ID",
  // Site (from dim_site)
  site_name: "Site",
  site_code: "Site Code",
  area_manager: "Area Manager",
  governorate: "Governorate",
  // Staff (from dim_staff)
  staff_name: "Staff",
  staff_id: "Staff ID",
  staff_position: "Position",
  // Billing (from dim_billing)
  billing_way: "Payment Type",
  billing_group: "Payment Group",
  is_return_type: "Return Type?",
  // Fact degenerate dims
  invoice_id: "Invoice #",
  is_return: "Return?",
  is_walk_in: "Walk-in?",
  has_insurance: "Has Insurance?",
};

/** Map metric API names to user-friendly labels */
export const METRIC_LABELS: Record<string, string> = {
  // From fct_sales (net_amount column)
  total_net_amount: "Total Revenue",
  avg_net_amount: "Avg. Order Value",
  // From fct_sales (sales column)
  total_sales: "Gross Sales",
  avg_sales: "Avg. Price per Unit",
  // From fct_sales (discount column)
  total_discount: "Total Discount",
  avg_discount: "Avg. Discount",
  // From fct_sales (quantity column)
  total_quantity: "Total Units",
  avg_quantity: "Avg. Quantity",
};

// ---- Dimension & Metric Groups ----

export interface FieldGroup {
  label: string;
  fields: string[];
}

export const DIMENSION_GROUPS: FieldGroup[] = [
  { label: "Time", fields: ["year_month", "quarter_label", "year", "month_name", "day_name"] },
  { label: "Product", fields: ["drug_name", "drug_brand", "drug_category", "drug_subcategory", "drug_division", "drug_segment"] },
  { label: "Customer", fields: ["customer_name"] },
  { label: "Location", fields: ["site_name", "area_manager", "governorate"] },
  { label: "Staff", fields: ["staff_name", "staff_position"] },
  { label: "Payment", fields: ["billing_way", "billing_group"] },
];

export const METRIC_GROUPS: FieldGroup[] = [
  { label: "Revenue", fields: ["total_net_amount", "total_sales", "total_discount"] },
  { label: "Volume", fields: ["total_quantity"] },
  { label: "Averages", fields: ["avg_net_amount", "avg_sales", "avg_quantity", "avg_discount"] },
];

// ---- Chart types ----

export type ChartType = "table" | "bar" | "line" | "pie";

// ---- Report Templates ----

export interface ReportTemplate {
  id: string;
  name: string;
  description: string;
  icon: LucideIcon;
  model: string;
  dimensions: string[];
  metrics: string[];
  chartType: ChartType;
}

export const REPORT_TEMPLATES: ReportTemplate[] = [
  {
    id: "sales-overview",
    name: "Sales Overview",
    description: "Monthly revenue trends",
    icon: TrendingUp,
    model: "fct_sales",
    dimensions: ["year_month"],
    metrics: ["total_net_amount", "total_quantity"],
    chartType: "line",
  },
  {
    id: "top-products",
    name: "Top Products",
    description: "Best sellers by revenue",
    icon: Package,
    model: "fct_sales",
    dimensions: ["drug_name"],
    metrics: ["total_net_amount", "total_quantity"],
    chartType: "bar",
  },
  {
    id: "by-location",
    name: "By Location",
    description: "Site-by-site comparison",
    icon: MapPin,
    model: "fct_sales",
    dimensions: ["site_name"],
    metrics: ["total_net_amount", "total_quantity"],
    chartType: "bar",
  },
  {
    id: "customer-analysis",
    name: "Customers",
    description: "Customer breakdown",
    icon: Users,
    model: "fct_sales",
    dimensions: ["customer_name"],
    metrics: ["total_net_amount", "total_quantity"],
    chartType: "table",
  },
  {
    id: "staff-performance",
    name: "Staff",
    description: "Performance ranking",
    icon: UserCog,
    model: "fct_sales",
    dimensions: ["staff_name"],
    metrics: ["total_net_amount", "total_quantity"],
    chartType: "bar",
  },
  {
    id: "payment-methods",
    name: "Payments",
    description: "Payment method split",
    icon: CreditCard,
    model: "fct_sales",
    dimensions: ["billing_group"],
    metrics: ["total_net_amount"],
    chartType: "pie",
  },
  {
    id: "monthly-trends",
    name: "Monthly",
    description: "Month-over-month growth",
    icon: Calendar,
    model: "fct_sales",
    dimensions: ["year_month", "year"],
    metrics: ["total_net_amount", "total_quantity"],
    chartType: "line",
  },
  {
    id: "returns-analysis",
    name: "Returns",
    description: "Return analysis",
    icon: RotateCcw,
    model: "fct_sales",
    dimensions: ["drug_name"],
    metrics: ["total_quantity"],
    chartType: "table",
  },
  {
    id: "from-scratch",
    name: "From Scratch",
    description: "Build your own",
    icon: Plus,
    model: "fct_sales",
    dimensions: [],
    metrics: [],
    chartType: "table",
  },
];

// ---- Helpers ----

/** Set of all dimension names covered by DIMENSION_GROUPS */
const _groupedDimensions = new Set(DIMENSION_GROUPS.flatMap((g) => g.fields));

/** Set of all metric names covered by METRIC_GROUPS */
const _groupedMetrics = new Set(METRIC_GROUPS.flatMap((g) => g.fields));

/** Check if a dimension is NOT in any predefined group */
export function isUngroupedDimension(name: string): boolean {
  return !_groupedDimensions.has(name);
}

/** Check if a metric is NOT in any predefined group */
export function isUngroupedMetric(name: string): boolean {
  return !_groupedMetrics.has(name);
}

export function friendlyDimensionLabel(name: string): string {
  return DIMENSION_LABELS[name] ?? name.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function friendlyMetricLabel(name: string): string {
  return METRIC_LABELS[name] ?? name.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function friendlyColumnLabel(name: string): string {
  return METRIC_LABELS[name] ?? DIMENSION_LABELS[name] ?? name.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
