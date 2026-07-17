import { GiacongInteractions } from "@/components/GiacongInteractions";

interface CapturedPageProps {
  markup: string;
  pageStyles: string;
}

export function CapturedPage({ markup, pageStyles }: CapturedPageProps) {
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: pageStyles }} />
      <div suppressHydrationWarning dangerouslySetInnerHTML={{ __html: markup }} />
      <GiacongInteractions />
    </>
  );
}
