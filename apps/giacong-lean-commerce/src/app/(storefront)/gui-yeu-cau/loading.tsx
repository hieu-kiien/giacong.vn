export default function RequestCartLoading() {
  return (
    <div className="mx-auto w-full max-w-2xl space-y-4" aria-busy="true" aria-label="Đang tải giỏ yêu cầu">
      <div className="h-8 w-64 animate-pulse rounded bg-commerce-card-surface" />
      {Array.from({ length: 2 }, (_, index) => (
        <div key={index} className="flex gap-3 rounded-[5px] border border-commerce-border p-3">
          <div className="h-20 w-20 shrink-0 animate-pulse rounded bg-commerce-card-surface" />
          <div className="flex-1 space-y-2 py-1">
            <div className="h-4 w-3/4 animate-pulse rounded bg-commerce-card-surface" />
            <div className="h-4 w-1/2 animate-pulse rounded bg-commerce-card-surface" />
            <div className="h-8 w-28 animate-pulse rounded border border-commerce-border" />
          </div>
        </div>
      ))}
      <div className="h-40 w-full animate-pulse rounded-[5px] border border-commerce-border bg-commerce-card-surface" />
      <div className="h-11 w-full animate-pulse rounded bg-commerce-card-surface" />
    </div>
  );
}
