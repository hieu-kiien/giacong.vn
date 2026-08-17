import type { Metadata } from "next";

import { CapturedNewsFrame } from "@/components/CapturedNewsFrame";
import { NewsArchive } from "@/components/news/NewsArchive";
import { getNewsList } from "@/lib/news-data";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Tin tức | Giacong.vn",
  description: "Tin tức, kiến thức và cập nhật về gia công thực phẩm, đồ uống, nông sản, dược liệu và đóng gói.",
};

export default async function NewsPage({ searchParams }: PageProps<"/tin-tuc">) {
  const params = await searchParams;
  const query = readParam(params.q, 120);
  const category = readParam(params.category, 120);
  const page = readPositiveInteger(params.page);
  const data = await getNewsList({ category, page, perPage: 12, query });

  return (
    <CapturedNewsFrame activePath="/tin-tuc" title="Tin tức">
      <NewsArchive category={category} data={data} query={query} />
    </CapturedNewsFrame>
  );
}

function readParam(value: string | string[] | undefined, maxLength: number): string {
  const raw = Array.isArray(value) ? value[0] : value;
  return typeof raw === "string" ? raw.trim().slice(0, maxLength) : "";
}

function readPositiveInteger(value: string | string[] | undefined): number {
  const raw = readParam(value, 10);
  const parsed = Number(raw);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
}
