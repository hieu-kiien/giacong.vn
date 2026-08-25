export default function CatalogListingLoading() {
  return (
    <div aria-busy="true" aria-label="Đang tải danh mục sản phẩm">
      <div className="h-8 w-56 animate-pulse rounded bg-commerce-card-surface" />
      <div className="mt-6 grid grid-cols-1 gap-3 min-[440px]:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 lg:gap-5">
        {Array.from({ length: 8 }, (_, index) => (
          <div key={index} className="rounded-[5px] border border-commerce-border p-3">
            <div className="aspect-[10/7] w-full animate-pulse rounded bg-commerce-card-surface" />
            <div className="mt-3 h-4 w-3/4 animate-pulse rounded bg-commerce-card-surface" />
            <div className="mt-2 h-4 w-1/3 animate-pulse rounded bg-commerce-card-surface" />
          </div>
        ))}
      </div>
    </div>
  );
}
