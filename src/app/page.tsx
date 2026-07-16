import { ContentFooterSections } from "@/components/ContentFooterSections";
import { HeroSection } from "@/components/HeroSection";
import { ServicesSection } from "@/components/ServicesSection";

export default function Home() {
  return (
    <main className="overflow-hidden bg-white">
      <HeroSection />
      <ServicesSection />
      <ContentFooterSections />
    </main>
  );
}
