import { HeroSection }     from "@/components/marketing/hero-section";
import { TrustBar }        from "@/components/marketing/trust-bar";
import { FeaturesGrid }    from "@/components/marketing/features-grid";
import { HowItWorks }      from "@/components/marketing/how-it-works";
import { StatsBanner }     from "@/components/marketing/stats-banner";
import { UseCasesSection } from "@/components/marketing/use-cases-section";
import { PricingSection }  from "@/components/marketing/pricing-section";
import { FAQSection }      from "@/components/marketing/faq-section";
import { CTASection }      from "@/components/marketing/cta-section";
import { JsonLd }          from "@/components/marketing/json-ld";
import type { Metadata }   from "next";

export const metadata: Metadata = {
  title: "DataPulse — Pharma Sales and Operations Intelligence",
  description:
    "DataPulse helps pharma and retail operations teams turn messy sales and inventory data into daily decision-ready intelligence. Upload spreadsheets or connect sources, monitor revenue, track inventory and expiry, and act on what matters.",
  alternates: {
    canonical: "/",
  },
};

export default function LandingPage() {
  return (
    <>
      <JsonLd />
      <HeroSection />
      <TrustBar />
      <FeaturesGrid />
      <HowItWorks />
      <StatsBanner />
      <UseCasesSection />
      <PricingSection />
      <FAQSection />
      <CTASection />
    </>
  );
}
