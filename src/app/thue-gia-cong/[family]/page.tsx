import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ServiceFamilyDetail } from "@/components/services/ServiceFamilyDetail";
import { getServiceFamily, serviceFamilies } from "@/data/service-families";

interface ServiceFamilyPageProps { params: Promise<{ family: string }> }

export function generateStaticParams() { return serviceFamilies.map(({ slug }) => ({ family: slug })); }

export async function generateMetadata({ params }: ServiceFamilyPageProps): Promise<Metadata> {
  const family = getServiceFamily((await params).family);
  if (!family) return {};
  return { title: `${family.name} | Thuê gia công`, description: family.description };
}

export default async function ServiceFamilyPage({ params }: ServiceFamilyPageProps) {
  const family = getServiceFamily((await params).family);
  if (!family) notFound();
  return <ServiceFamilyDetail family={family} />;
}
