<?php

namespace Acme\B2b\Services;

use Acme\B2b\Models\ProductConfig;
use Acme\B2b\Repositories\CatalogProductRepository;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Pagination\LengthAwarePaginator;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Webkul\Category\Models\Category;
use Webkul\Category\Repositories\CategoryRepository;
use Webkul\Core\Models\Channel;
use Webkul\Product\Models\Product;
use Webkul\Product\Models\ProductAttributeValue;

class CatalogService
{
    private ?Channel $channel = null;

    /** @var array<int, int>|null */
    private ?array $visibleCategoryIds = null;

    public function __construct(
        private readonly CatalogProductRepository $catalogProductRepository,
        private readonly CategoryRepository $categoryRepository,
    ) {}

    /**
     * @param  array{q?: string|null, category?: string|null, page?: int, per_page?: int}  $filters
     */
    public function paginateProducts(array $filters): LengthAwarePaginator
    {
        $sortColumns = [
            'name' => 'catalog_name',
            'id' => 'products.id',
            'starting_price' => 'catalog_starting_price',
            'variant_count' => 'variant_count',
            'available_variant_count' => 'available_variant_count',
        ];
        $sort = $filters['sort'] ?? 'name';
        $direction = $filters['direction'] ?? 'asc';

        return $this->filteredQuery($filters)
            ->orderBy($sortColumns[$sort], $direction)
            ->when($sort !== 'id', fn (Builder $query) => $query->orderBy('products.id', $direction))
            ->paginate(
                perPage: $filters['per_page'] ?? 12,
                page: $filters['page'] ?? 1,
            )
            ->withQueryString();
    }

    /** @return array{product_parent_count: int, variant_count: int, available_variant_count: int, category_count: int} */
    public function summary(): array
    {
        $catalog = $this->publicQuery()
            ->withoutEagerLoads()
            ->reorder();
        $summary = DB::query()
            ->fromSub($catalog, 'b2b_catalog')
            ->selectRaw('COUNT(*) AS product_parent_count')
            ->selectRaw('COALESCE(SUM(variant_count), 0) AS variant_count')
            ->selectRaw('COALESCE(SUM(available_variant_count), 0) AS available_variant_count')
            ->first();

        return [
            'product_parent_count' => (int) $summary->product_parent_count,
            'variant_count' => (int) $summary->variant_count,
            'available_variant_count' => (int) $summary->available_variant_count,
            'category_count' => $this->categories()->count(),
        ];
    }

    public function findProduct(string $slug): ?Product
    {
        return $this->findProducts([$slug])->get($slug);
    }

    /** @param  array<int, string>  $slugs
     * @return Collection<string, Product>
     */
    public function findProducts(array $slugs): Collection
    {
        $slugs = collect($slugs)
            ->filter(fn ($slug) => is_string($slug) && $slug !== '')
            ->unique()
            ->values();

        if ($slugs->isEmpty()) {
            return collect();
        }

        $products = $this->publicQuery()
            ->whereHas('attribute_values', function (Builder $query) use ($slugs) {
                $query->whereIn('text_value', $slugs)
                    ->where('locale', $this->locale())
                    ->whereNull('channel')
                    ->whereHas('attribute', fn (Builder $query) => $query->where('code', 'url_key'));
            })
            ->get();

        $this->loadDetails($products);

        return $products->keyBy(fn (Product $product) => (string) $this->attributeValue($product, 'url_key')?->text_value);
    }

    /** @return Collection<int, Category> */
    public function categories(): Collection
    {
        $categoryIds = $this->publicQuery()
            ->withoutEagerLoads()
            ->join('product_categories', 'product_categories.product_id', '=', 'products.id')
            ->whereIn('product_categories.category_id', $this->visibleCategoryIds())
            ->reorder()
            ->select('product_categories.category_id')
            ->distinct()
            ->pluck('product_categories.category_id');

        return $this->categoryRepository->getModel()->newQuery()
            ->whereKey($categoryIds)
            ->with('translations')
            ->get()
            ->sortBy(fn (Category $category) => sprintf(
                "%s\0%010d",
                $category->translate($this->locale())?->name ?? '',
                $category->id,
            ))
            ->values();
    }

    public function channelCode(): string
    {
        return $this->channel()->code;
    }

    public function locale(): string
    {
        return $this->channel()->default_locale->code;
    }

    public function currency(): string
    {
        return $this->channel()->base_currency->code;
    }

    /** @param  Collection<int, Product>  $parents */
    private function loadDetails(Collection $parents): void
    {
        if ($parents->isEmpty()) {
            return;
        }

        $parentIds = $parents->modelKeys();
        $validVariantIds = $this->validVariantIds(false);
        $availableVariantIds = $this->validVariantIds(true)
            ->whereIn('variants.parent_id', $parentIds)
            ->pluck('variants.id');
        $guestCustomerGroupId = core()->getGuestCustomerGroup()->id;

        $parents->load([
            'super_attributes.options.translations',
            'variants' => fn ($query) => $query
                ->select('products.*')
                ->addSelect([
                    'b2b_unit' => ProductConfig::query()
                        ->select('unit')
                        ->whereColumn('product_id', 'products.id')
                        ->limit(1),
                    'b2b_moq' => ProductConfig::query()
                        ->select('moq')
                        ->whereColumn('product_id', 'products.id')
                        ->limit(1),
                    'b2b_quantity_step' => ProductConfig::query()
                        ->select('quantity_step')
                        ->whereColumn('product_id', 'products.id')
                        ->limit(1),
                    'b2b_contact_from_quantity' => ProductConfig::query()
                        ->select('contact_from_quantity')
                        ->whereColumn('product_id', 'products.id')
                        ->limit(1),
                    'b2b_base_price' => $this->basePriceQuery()
                        ->whereColumn('product_attribute_values.product_id', 'products.id')
                        ->limit(1),
                ])
                ->whereIn('products.id', $validVariantIds)
                ->orderBy('products.id'),
            'variants.attribute_values' => fn ($query) => $query
                ->whereHas('attribute', fn (Builder $query) => $query->whereIn('code', [
                    'sku', 'name', 'b2b_variant',
                ])),
            'variants.images',
            'variants.customer_group_prices' => fn ($query) => $query
                ->where('customer_group_id', $guestCustomerGroupId)
                ->where('value_type', 'fixed')
                ->orderBy('qty'),
        ]);

        $availableIds = $availableVariantIds->flip();

        foreach ($parents as $parent) {
            $attributes = $parent->attribute_values
                ->map(fn ($value) => $value->attribute)
                ->merge($parent->super_attributes)
                ->keyBy('id');

            foreach ($parent->variants as $variant) {
                foreach ($variant->attribute_values as $value) {
                    $value->setRelation('attribute', $attributes->get($value->attribute_id));
                }

                $variant->setRelation('b2b_config', new ProductConfig([
                    'product_id' => $variant->id,
                    'unit' => $variant->getAttribute('b2b_unit'),
                    'moq' => $variant->getAttribute('b2b_moq'),
                    'quantity_step' => $variant->getAttribute('b2b_quantity_step'),
                    'contact_from_quantity' => $variant->getAttribute('b2b_contact_from_quantity'),
                ]));
                $variant->setAttribute('b2b_is_available', $availableIds->has($variant->id));
            }
        }
    }

    private function attributeValue(Product $product, string $code): ?ProductAttributeValue
    {
        return $product->attribute_values->first(
            fn (ProductAttributeValue $value) => $value->attribute->code === $code
                && $value->locale === $this->locale()
                && $value->channel === null,
        );
    }

    private function channel(): Channel
    {
        return $this->channel ??= core()->getCurrentChannel() ?? core()->getDefaultChannel();
    }

    /**
     * @param  array{q?: string|null, category?: string|null}  $filters
     */
    private function filteredQuery(array $filters): Builder
    {
        $query = $this->publicQuery();

        if ($search = $filters['q'] ?? null) {
            $like = '%'.addcslashes($search, '\\%_').'%';
            $matchingVariants = $this->validVariantIds(false)
                ->whereColumn('variants.parent_id', 'products.id')
                ->where(function ($query) use ($like) {
                    $query->where('variants.sku', 'like', $like)
                        ->orWhereExists(function ($query) use ($like) {
                            $query->selectRaw('1')
                                ->from('product_attribute_values as searched_variant_name')
                                ->join('attributes as searched_name_attribute', 'searched_name_attribute.id', '=', 'searched_variant_name.attribute_id')
                                ->whereColumn('searched_variant_name.product_id', 'variants.id')
                                ->where('searched_name_attribute.code', 'name')
                                ->where('searched_variant_name.locale', $this->locale())
                                ->whereNull('searched_variant_name.channel')
                                ->where('searched_variant_name.text_value', 'like', $like);
                        });
                });

            $query->where(function (Builder $query) use ($like, $matchingVariants) {
                $query->where('products.sku', 'like', $like)
                    ->orWhereHas('attribute_values', function (Builder $query) use ($like) {
                        $query->where('text_value', 'like', $like)
                            ->where('locale', $this->locale())
                            ->whereNull('channel')
                            ->whereHas('attribute', fn (Builder $query) => $query->where('code', 'name'));
                    })
                    ->orWhereExists($matchingVariants);
            });
        }

        if ($categorySlug = $filters['category'] ?? null) {
            $categoryId = $this->categoryRepository->getModel()->newQuery()
                ->whereKey($this->visibleCategoryIds())
                ->whereHas('translations', function (Builder $query) use ($categorySlug) {
                    $query->where('locale', $this->locale())
                        ->where('slug', $categorySlug);
                })
                ->value('id');

            $categoryId === null
                ? $query->whereRaw('1 = 0')
                : $query->whereHas('categories', fn (Builder $query) => $query->whereKey($categoryId));
        }

        return $query;
    }

    private function publicQuery(): Builder
    {
        $guestCustomerGroupId = core()->getGuestCustomerGroup()?->id;
        $query = $this->catalogProductRepository->publicParentQuery(
            $this->channel()->id,
            $this->channelCode(),
            $this->locale(),
            $guestCustomerGroupId,
            $this->visibleCategoryIds(),
            $this->backordersAllowed(),
        );

        if ($this->currency() !== 'VND' || $guestCustomerGroupId === null) {
            return $query->whereRaw('1 = 0');
        }

        $validVariants = $this->validVariantIds(false)
            ->whereColumn('variants.parent_id', 'products.id');
        $availableVariants = $this->validVariantIds(true)
            ->whereColumn('variants.parent_id', 'products.id');
        $startingPrice = $this->validVariantIds(true)
            ->leftJoin('product_customer_group_prices as starting_tier', function ($join) use ($guestCustomerGroupId) {
                $join->on('starting_tier.product_id', '=', 'variants.id')
                    ->on('starting_tier.qty', '=', 'configs.moq')
                    ->where('starting_tier.customer_group_id', $guestCustomerGroupId)
                    ->where('starting_tier.value_type', 'fixed');
            })
            ->whereColumn('variants.parent_id', 'products.id');

        $basePrice = $this->basePriceQuery()
            ->select([
                'product_attribute_values.product_id',
                'product_attribute_values.float_value',
            ]);

        $startingPrice->leftJoinSub($basePrice, 'base_price', function ($join) {
            $join->on('base_price.product_id', '=', 'variants.id');
        });

        return $query
            ->selectSub($validVariants->select([])->selectRaw('COUNT(DISTINCT variants.id)'), 'variant_count')
            ->selectSub($availableVariants->select([])->selectRaw('COUNT(DISTINCT variants.id)'), 'available_variant_count')
            ->selectSub(
                $startingPrice->select([])->selectRaw('MIN(COALESCE(starting_tier.value, NULLIF(base_price.float_value, 0)))'),
                'catalog_starting_price',
            );
    }

    private function basePriceQuery(): Builder
    {
        return ProductAttributeValue::query()
            ->select('product_attribute_values.float_value')
            ->join('attributes', 'attributes.id', '=', 'product_attribute_values.attribute_id')
            ->where('attributes.code', 'price')
            ->whereNull('product_attribute_values.channel')
            ->whereNull('product_attribute_values.locale');
    }

    private function validVariantIds(bool $availableOnly)
    {
        return $this->catalogProductRepository->validVariantIdsQuery(
            $this->channel()->id,
            $this->channelCode(),
            $this->locale(),
            core()->getGuestCustomerGroup()->id,
            $availableOnly,
            $this->backordersAllowed(),
        );
    }

    private function backordersAllowed(): bool
    {
        return (bool) core()->getConfigData('catalog.inventory.stock_options.back_orders');
    }

    /** @return array<int, int> */
    private function visibleCategoryIds(): array
    {
        return $this->visibleCategoryIds ??= $this->categoryRepository
            ->getVisibleCategoryIds($this->channel()->root_category_id);
    }
}
