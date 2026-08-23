export default function CatalogDetailLoading() {
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]" aria-busy="true" aria-label="Đang tải sản phẩm">
      <div>
        <div className="aspect-square w-full animate-pulse rounded-[5px] border border-commerce-border bg-commerce-card-surface" />
        <div className="mt-3 flex gap-2">
          {Array.from({ length: 3 }, (_, index) => (
            <div key={index} className="h-16 w-16 animate-pulse rounded-[5px] border border-commerce-border bg-commerce-card-surface" />
          ))}
        </div>
      </div>
      <div className="space-y-4">
        <div className="h-5 w-32 animate-pulse rounded bg-commerce-card-surface" />
        <div className="h-9 w-3/4 animate-pulse rounded bg-commerce-card-surface" />
        <div className="h-4 w-24 animate-pulse rounded bg-commerce-card-surface" />
        <div className="h-24 w-full animate-pulse rounded-[5px] border border-commerce-border bg-commerce-card-surface" />
        <div className="h-12 w-full animate-pulse rounded bg-commerce-card-surface" />
        <div className="flex gap-3">
          <div className="h-11 w-36 animate-pulse rounded bg-commerce-card-surface" />
          <div className="h-11 w-36 animate-pulse rounded bg-commerce-card-surface" />
        </div>
      </div>
    </div>
  );
}
