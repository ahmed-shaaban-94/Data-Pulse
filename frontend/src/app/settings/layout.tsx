import V2Layout from "@/components/dashboard-v2/v2-layout";
/** /settings layout — covers promotions/vouchers and any future settings children. */
export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return <V2Layout>{children}</V2Layout>;
}
