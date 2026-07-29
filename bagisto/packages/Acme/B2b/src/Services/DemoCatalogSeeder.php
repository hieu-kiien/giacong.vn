<?php

namespace Acme\B2b\Services;

use Acme\B2b\Repositories\ProductConfigRepository;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Schema;
use JsonException;
use RuntimeException;
use Webkul\Attribute\Models\Attribute;
use Webkul\Attribute\Models\AttributeFamily;
use Webkul\Attribute\Models\AttributeOption;
use Webkul\Attribute\Repositories\AttributeFamilyRepository;
use Webkul\Category\Repositories\CategoryRepository;
use Webkul\Core\Models\Channel;
use Webkul\Customer\Models\CustomerGroup;
use Webkul\Customer\Repositories\CustomerGroupRepository;
use Webkul\Inventory\Models\InventorySource;
use Webkul\Product\Models\Product;
use Webkul\Product\Repositories\ProductAttributeValueRepository;
use Webkul\Product\Repositories\ProductImageRepository;
use Webkul\Product\Repositories\ProductRepository;

class DemoCatalogSeeder
{
    private const VARIANT_ATTRIBUTE_CODE = 'b2b_variant';

    private const REQUIRED_ATTRIBUTES = [
        'description',
        'featured',
        'guest_checkout',
        'manage_stock',
        'name',
        'new',
        'price',
        'short_description',
        'sku',
        'status',
        'url_key',
        'visible_individually',
        'weight',
    ];

    /**
     * @var array<int, array{slug: string, name: string, description: string}>
     */
    private const CATEGORIES = [
        [
            'slug' => 'b2b-legacy-sua-dinh-duong',
            'name' => 'Sữa và dinh dưỡng',
            'description' => 'Danh mục sữa và dinh dưỡng được kế thừa từ dữ liệu sản phẩm gốc.',
        ],
        [
            'slug' => 'b2b-legacy-tra-thao-moc',
            'name' => 'Trà và thảo mộc',
            'description' => 'Danh mục trà được kế thừa từ dữ liệu sản phẩm gốc.',
        ],
    ];

    private const SUPERSEDED_DEMO_CATEGORY_SLUGS = [
        'b2b-demo-sua-dinh-duong-nguoi-lon-tuoi',
        'b2b-demo-dinh-duong-tien-loi',
    ];

    /**
     * @var array<int, array{sku: string, slug: string, name: string, description: string, category: string}>
     */
    private const PARENTS = [
        [
            'sku' => 'B2B-DEMO-BOT-DINH-DUONG',
            'slug' => 'b2b-demo-bot-dinh-duong',
            'name' => 'Bột dinh dưỡng',
            'description' => 'Bột dinh dưỡng đóng thùng với nhiều lựa chọn hương vị cho khách hàng doanh nghiệp.',
            'category' => 'b2b-demo-sua-dinh-duong-nguoi-lon-tuoi',
            'image' => 'demo-powder-pouches.png',
        ],
        [
            'sku' => 'B2B-DEMO-THUC-UONG-DINH-DUONG',
            'slug' => 'b2b-demo-thuc-uong-dinh-duong',
            'name' => 'Thức uống dinh dưỡng',
            'description' => 'Thức uống dinh dưỡng đóng thùng dành cho phân phối và mua hàng doanh nghiệp.',
            'category' => 'b2b-demo-sua-dinh-duong-nguoi-lon-tuoi',
            'image' => 'demo-fruit-drinks.png',
        ],
        [
            'sku' => 'B2B-DEMO-NGU-COC-DINH-DUONG',
            'slug' => 'b2b-demo-ngu-coc-dinh-duong',
            'name' => 'Ngũ cốc dinh dưỡng',
            'description' => 'Ngũ cốc dinh dưỡng tiện lợi với nhiều lựa chọn đóng gói cho đơn hàng số lượng lớn.',
            'category' => 'b2b-demo-dinh-duong-tien-loi',
            'image' => 'demo-dried-fruit-pouches.png',
        ],
    ];

    /**
     * @var array<int, array{
     *     sku: string, slug: string, name: string, description: string,
     *     category: string, unit: string, moq: int, step: int, contact_from: int,
     *     parent: string, option: string, price: int, tiers: array<int, array{qty: int, value: int}>
     * }>
     */
    private const PRODUCTS = [
        [
            'sku' => 'B2B-DEMO-BOT-VANI',
            'slug' => 'b2b-demo-bot-dinh-duong-vi-vani',
            'name' => 'Bột dinh dưỡng vị vani',
            'description' => 'Bột dinh dưỡng vị vani, đóng hộp phù hợp cho nhu cầu mua số lượng lớn.',
            'category' => 'b2b-demo-sua-dinh-duong-nguoi-lon-tuoi',
            'parent' => 'B2B-DEMO-BOT-DINH-DUONG',
            'option' => 'Vani',
            'unit' => 'thùng',
            'moq' => 10,
            'step' => 5,
            'contact_from' => 100,
            'price' => 720000,
            'image' => 'demo-powder-pouches.png',
            'tiers' => [['qty' => 10, 'value' => 720000], ['qty' => 25, 'value' => 690000]],
        ],
        [
            'sku' => 'B2B-DEMO-BOT-IT-NGOT',
            'slug' => 'b2b-demo-bot-dinh-duong-vi-it-ngot',
            'name' => 'Bột dinh dưỡng vị ít ngọt',
            'description' => 'Bột dinh dưỡng có vị nhẹ, quy cách thùng dành cho khách hàng doanh nghiệp.',
            'category' => 'b2b-demo-sua-dinh-duong-nguoi-lon-tuoi',
            'parent' => 'B2B-DEMO-BOT-DINH-DUONG',
            'option' => 'Ít ngọt',
            'unit' => 'thùng',
            'moq' => 10,
            'step' => 5,
            'contact_from' => 100,
            'price' => 735000,
            'image' => 'demo-powder-pouches.png',
            'tiers' => [['qty' => 10, 'value' => 735000], ['qty' => 25, 'value' => 705000]],
        ],
        [
            'sku' => 'B2B-DEMO-LUA-MACH',
            'slug' => 'b2b-demo-thuc-uong-dinh-duong-lua-mach',
            'name' => 'Thức uống dinh dưỡng lúa mạch',
            'description' => 'Thức uống lúa mạch đóng chai theo thùng, thuận tiện cho việc phân phối.',
            'category' => 'b2b-demo-sua-dinh-duong-nguoi-lon-tuoi',
            'parent' => 'B2B-DEMO-THUC-UONG-DINH-DUONG',
            'option' => 'Lúa mạch',
            'unit' => 'thùng',
            'moq' => 12,
            'step' => 6,
            'contact_from' => 120,
            'price' => 480000,
            'image' => 'demo-fruit-drinks.png',
            'tiers' => [['qty' => 12, 'value' => 480000], ['qty' => 30, 'value' => 455000]],
        ],
        [
            'sku' => 'B2B-DEMO-NGU-COC-HAT',
            'slug' => 'b2b-demo-ngu-coc-dinh-duong-hat',
            'name' => 'Ngũ cốc dinh dưỡng hạt',
            'description' => 'Ngũ cốc phối trộn từ nhiều loại hạt, đóng gói theo hộp cho đơn hàng số lượng lớn.',
            'category' => 'b2b-demo-dinh-duong-tien-loi',
            'parent' => 'B2B-DEMO-NGU-COC-DINH-DUONG',
            'option' => 'Hạt',
            'unit' => 'thùng',
            'moq' => 10,
            'step' => 5,
            'contact_from' => 100,
            'price' => 560000,
            'image' => 'demo-dried-fruit-pouches.png',
            'tiers' => [['qty' => 10, 'value' => 560000], ['qty' => 25, 'value' => 535000]],
        ],
        [
            'sku' => 'B2B-DEMO-YEN-MACH',
            'slug' => 'b2b-demo-bot-yen-mach-hoa-tan',
            'name' => 'Bột yến mạch hòa tan',
            'description' => 'Bột yến mạch hòa tan đóng gói riêng, cung cấp theo thùng cho kênh doanh nghiệp.',
            'category' => 'b2b-demo-dinh-duong-tien-loi',
            'parent' => 'B2B-DEMO-NGU-COC-DINH-DUONG',
            'option' => 'Yến mạch',
            'unit' => 'thùng',
            'moq' => 12,
            'step' => 6,
            'contact_from' => 120,
            'price' => 420000,
            'image' => 'demo-dried-fruit-pouches.png',
            'tiers' => [['qty' => 12, 'value' => 420000], ['qty' => 30, 'value' => 398000]],
        ],
        [
            'sku' => 'B2B-DEMO-SUA-HAT',
            'slug' => 'b2b-demo-sua-hat-pha-san',
            'name' => 'Sữa hạt pha sẵn',
            'description' => 'Sữa hạt pha sẵn đóng hộp theo thùng, phù hợp cho hoạt động bán buôn.',
            'category' => 'b2b-demo-dinh-duong-tien-loi',
            'parent' => 'B2B-DEMO-THUC-UONG-DINH-DUONG',
            'option' => 'Sữa hạt',
            'unit' => 'thùng',
            'moq' => 12,
            'step' => 6,
            'contact_from' => 120,
            'price' => 510000,
            'image' => 'demo-fruit-drinks.png',
            'tiers' => [['qty' => 12, 'value' => 510000], ['qty' => 30, 'value' => 485000]],
        ],
    ];

    /**
     * Imports the catalogue that originally powered the frontend demo.
     *
     * The JSON is a transport snapshot of that frontend fixture.  After the
     * first import, Bagisto is intentionally the single editable source.
     *
     * @return array{categories: array<int, array<string, mixed>>, parents: array<int, array<string, mixed>>, variants: array<int, array<string, mixed>>}
     */
    private function frontendCatalogDefinitions(): array
    {
        $path = base_path('packages/Acme/B2b/src/Resources/catalog/frontend-products.json');

        try {
            $definitions = json_decode(File::get($path), true, 512, JSON_THROW_ON_ERROR);
        } catch (JsonException $exception) {
            throw new RuntimeException('Frontend product catalogue is invalid.', previous: $exception);
        }

        if (! is_array($definitions)
            || count($definitions['categories'] ?? []) !== 4
            || count($definitions['parents'] ?? []) !== 9
            || count($definitions['variants'] ?? []) !== 17) {
            throw new RuntimeException('Frontend product catalogue must contain 4 categories, 9 products and 17 variants.');
        }

        foreach (['categories', 'parents', 'variants'] as $key) {
            foreach ($definitions[$key] as $definition) {
                if (! is_array($definition)) {
                    throw new RuntimeException('Frontend product catalogue contains an incomplete definition.');
                }
            }
        }

        return $definitions;
    }

    public function __construct(
        private readonly CategoryRepository $categoryRepository,
        private readonly ProductRepository $productRepository,
        private readonly ProductConfigRepository $productConfigRepository,
        private readonly AttributeFamilyRepository $attributeFamilyRepository,
        private readonly CustomerGroupRepository $customerGroupRepository,
        private readonly ProductAttributeValueRepository $attributeValueRepository,
        private readonly ProductImageRepository $productImageRepository,
    ) {}

    /**
     * @return array{categories: int, parents: int, variants: int, channel: string, locale: string, currency: string}
     */
    public function seed(): array
    {
        $context = $this->resolveContext();
        $definitions = $this->frontendCatalogDefinitions();

        $touchedProductIds = DB::transaction(function () use ($context, $definitions) {
            $this->removeSupersededDemoCatalog();
            $this->assertOwnedProductGraphIsSafe($definitions);

            $categories = [];

            foreach ($definitions['categories'] as $position => $definition) {
                $category = $this->categoryRepository->findBySlug($definition['slug']);
                $data = [
                    'locale' => $context['locale'],
                    $context['locale'] => [
                        'name' => $definition['name'],
                        'slug' => $definition['slug'],
                        'description' => $definition['description'],
                    ],
                    'parent_id' => $context['channel']->root_category_id,
                    'position' => $position + 1,
                    'status' => 1,
                ];

                $categories[$definition['slug']] = $category
                    ? $this->categoryRepository->update($data, $category->id)
                    : $this->categoryRepository->create($data);
            }

            $variantAttribute = $this->upsertVariantAttribute($context['family'], $context['locale'], $definitions);
            $parents = [];

            foreach ($definitions['parents'] as $definition) {
                $parent = $this->upsertParent($definition, $categories, $variantAttribute, $context);
                $parents[$definition['sku']] = $parent;
            }

            $touchedProductIds = collect($parents)->pluck('id')->all();

            foreach ($definitions['variants'] as $definition) {
                $product = $this->productRepository->findOneByField('sku', $definition['sku']);

                if (! $product) {
                    Event::dispatch('catalog.product.create.before');

                    $product = $this->productRepository->create([
                        'type' => 'simple',
                        'sku' => $definition['sku'],
                        'attribute_family_id' => $context['family']->id,
                    ]);

                    Event::dispatch('catalog.product.create.after', $product);
                }

                $product->update([
                    'type' => 'simple',
                    'attribute_family_id' => $context['family']->id,
                    'parent_id' => $parents[$definition['parent']]->id,
                ]);

                $existingTierIds = $product->customer_group_prices()
                    ->orderBy('qty')
                    ->pluck('id')
                    ->values();
                $tierRows = [];

                foreach ($definition['tiers'] as $index => $tier) {
                    $key = $existingTierIds->get($index, 'price_'.$index);
                    $tierRows[$key] = [
                        'customer_group_id' => $context['guestGroup']->id,
                        'qty' => $tier['qty'],
                        'value_type' => 'fixed',
                        'value' => $tier['value'],
                    ];
                }

                Event::dispatch('catalog.product.update.before', $product->id);

                $product = $this->productRepository->update([
                    'channel' => $context['channel']->code,
                    'locale' => $context['locale'],
                    'sku' => $definition['sku'],
                    'name' => $definition['name'],
                    'url_key' => $definition['slug'],
                    'short_description' => $definition['short_description'] ?? $definition['description'],
                    'description' => $definition['description'],
                    'new' => false,
                    'featured' => false,
                    'visible_individually' => false,
                    'status' => true,
                    'guest_checkout' => true,
                    'price' => $definition['price'],
                    'weight' => '1.0000',
                    'manage_stock' => true,
                    'channels' => [$context['channel']->id],
                    'categories' => [],
                    'inventories' => [$context['inventorySource']->id => $definition['is_available'] ? 1000 : 0],
                    'customer_group_prices' => $tierRows,
                    'images' => ['files' => $this->existingImageFiles($product)],
                    'videos' => ['files' => []],
                ], $product->id);

                $this->attachDemoImageIfMissing($product, $definition['image'], $definition['fallback_image']);

                $product->inventories()
                    ->where(function ($query) use ($context) {
                        $query->where('inventory_source_id', '<>', $context['inventorySource']->id)
                            ->orWhere('vendor_id', '<>', 0);
                    })
                    ->delete();
                $product->inventories()->updateOrCreate([
                    'inventory_source_id' => $context['inventorySource']->id,
                    'vendor_id' => 0,
                ], [
                    'qty' => $definition['is_available'] ? 1000 : 0,
                ]);

                $product->unsetRelation('attribute_values')->load('attribute_values');
                $this->attributeValueRepository->saveValues(
                    [self::VARIANT_ATTRIBUTE_CODE => $variantAttribute->options
                        ->firstWhere('admin_name', $definition['option'])
                        ?->id],
                    $product,
                    collect([$variantAttribute]),
                );

                $this->productConfigRepository->updateOrCreate([
                    'product_id' => $product->id,
                ], [
                    'unit' => $definition['unit'],
                    'moq' => $definition['moq'],
                    'quantity_step' => $definition['step'],
                    'contact_from_quantity' => $definition['contact_from'],
                ]);

                $touchedProductIds[] = $product->id;
            }

            return $touchedProductIds;
        });

        Product::query()->whereKey($touchedProductIds)->get()
            ->each(fn (Product $product) => Event::dispatch('catalog.product.update.after', $product));

        return [
            'categories' => count($definitions['categories']),
            'parents' => count($definitions['parents']),
            'variants' => count($definitions['variants']),
            'channel' => $context['channel']->code,
            'locale' => $context['locale'],
            'currency' => $context['currency'],
        ];
    }

    private function removeSupersededDemoCatalog(): void
    {
        $skus = collect(self::PARENTS)->pluck('sku')
            ->merge(collect(self::PRODUCTS)->pluck('sku'));
        $products = Product::query()
            ->where(function ($query) use ($skus) {
                $query->whereIn('sku', $skus)
                    ->orWhere('sku', 'like', 'B2B-LEGACY-%');
            })
            ->get()
            ->sortByDesc(fn (Product $product) => $product->parent_id === null ? 0 : 1);

        foreach ($products as $product) {
            $this->productRepository->delete($product->id);
        }

        foreach (array_merge(self::SUPERSEDED_DEMO_CATEGORY_SLUGS, [
            'b2b-legacy-sua-dinh-duong',
            'b2b-legacy-tra-thao-moc',
        ]) as $slug) {
            $category = $this->categoryRepository->findBySlug($slug);

            if ($category) {
                $this->categoryRepository->delete($category->id);
            }
        }
    }

    /** @param array{parents: array<int, array<string, mixed>>, variants: array<int, array<string, mixed>>} $definitions */
    private function assertOwnedProductGraphIsSafe(array $definitions): void
    {
        $parentSkus = collect($definitions['parents'])->pluck('sku');
        $ownedProducts = Product::query()
            ->whereIn('sku', $parentSkus->merge(collect($definitions['variants'])->pluck('sku')))
            ->lockForUpdate()
            ->get()
            ->keyBy('sku');

        foreach ($definitions['parents'] as $definition) {
            $parent = $ownedProducts->get($definition['sku']);

            if ($parent && ($parent->type !== 'configurable' || $parent->parent_id !== null)) {
                throw new RuntimeException("Owned parent SKU {$definition['sku']} has an incompatible product graph.");
            }
        }

        $ownedParentIds = $ownedProducts->whereIn('sku', $parentSkus)->modelKeys();

        foreach ($definitions['variants'] as $definition) {
            $variant = $ownedProducts->get($definition['sku']);

            if (! $variant) {
                continue;
            }

            if ($variant->type !== 'simple') {
                throw new RuntimeException("Owned variant SKU {$definition['sku']} is not a simple product.");
            }

            if ($variant->parent_id !== null && ! in_array($variant->parent_id, $ownedParentIds, true)) {
                throw new RuntimeException("Owned variant SKU {$definition['sku']} belongs to a product outside the owned demo catalog.");
            }
        }

        $variantAttribute = Attribute::query()
            ->where('code', self::VARIANT_ATTRIBUTE_CODE)
            ->lockForUpdate()
            ->first();

        if (! $variantAttribute) {
            return;
        }

        $ownedProductIds = $ownedProducts->modelKeys();
        $foreignAttributeValueExists = DB::table('product_attribute_values')
            ->where('attribute_id', $variantAttribute->id)
            ->when(
                $ownedProductIds !== [],
                fn ($query) => $query->whereNotIn('product_id', $ownedProductIds),
            )
            ->exists();
        $foreignSuperAttributeExists = DB::table('product_super_attributes')
            ->where('attribute_id', $variantAttribute->id)
            ->when(
                $ownedProductIds !== [],
                fn ($query) => $query->whereNotIn('product_id', $ownedProductIds),
            )
            ->exists();

        if ($foreignAttributeValueExists || $foreignSuperAttributeExists) {
            throw new RuntimeException('The owned b2b_variant attribute is used by a foreign product.');
        }
    }

    /** @param array{variants: array<int, array<string, mixed>>} $definitions */
    private function upsertVariantAttribute(AttributeFamily $family, string $locale, array $definitions): Attribute
    {
        $attribute = Attribute::query()->firstOrCreate(
            ['code' => self::VARIANT_ATTRIBUTE_CODE],
            [
                'admin_name' => 'Phiên bản',
                'type' => 'select',
                'position' => 100,
                'is_configurable' => true,
                'is_user_defined' => true,
                'is_visible_on_front' => true,
                'value_per_locale' => false,
                'value_per_channel' => false,
            ],
        );

        if ($attribute->type !== 'select') {
            throw new RuntimeException('The owned b2b_variant attribute has an incompatible type.');
        }

        $attribute->update([
            'admin_name' => 'Phiên bản',
            'is_configurable' => true,
            'is_visible_on_front' => true,
            'value_per_locale' => false,
            'value_per_channel' => false,
        ]);

        $group = $family->attribute_groups()->first();

        if (! $group) {
            throw new RuntimeException('The default attribute family has no attribute group.');
        }

        $group->custom_attributes()->syncWithoutDetaching([
            $attribute->id => ['position' => 100],
        ]);

        $canonicalOptionIds = [];

        foreach (collect($definitions['variants'])->pluck('option')->unique()->values() as $position => $label) {
            $option = AttributeOption::query()->firstOrCreate([
                'attribute_id' => $attribute->id,
                'admin_name' => $label,
            ], [
                'sort_order' => $position + 1,
            ]);
            $option->update(['sort_order' => $position + 1]);
            DB::table('attribute_option_translations')->updateOrInsert([
                'attribute_option_id' => $option->id,
                'locale' => $locale,
            ], [
                'label' => $label,
            ]);
            $canonicalOptionIds[] = $option->id;
        }

        AttributeOption::query()
            ->where('attribute_id', $attribute->id)
            ->whereNotIn('id', $canonicalOptionIds)
            ->delete();

        return $attribute->fresh(['options.translations']);
    }

    /**
     * @param  array{sku: string, slug: string, name: string, description: string, category: string}  $definition
     * @param  array<string, mixed>  $categories
     * @param  array<string, mixed>  $context
     */
    private function upsertParent(array $definition, array $categories, Attribute $variantAttribute, array $context): Product
    {
        $parent = $this->productRepository->findOneByField('sku', $definition['sku']);

        if (! $parent) {
            Event::dispatch('catalog.product.create.before');
            $parent = $this->productRepository->create([
                'type' => 'configurable',
                'sku' => $definition['sku'],
                'attribute_family_id' => $context['family']->id,
            ]);
            Event::dispatch('catalog.product.create.after', $parent);
        }

        $parent->update([
            'type' => 'configurable',
            'attribute_family_id' => $context['family']->id,
            'parent_id' => null,
        ]);
        $parent->channels()->sync([$context['channel']->id]);
        $parent->categories()->sync([$categories[$definition['category']]->id]);
        $parent->super_attributes()->sync([$variantAttribute->id]);
        $parent->inventories()->delete();
        $parent->customer_group_prices()->delete();
        $this->productConfigRepository->deleteWhere(['product_id' => $parent->id]);

        $parent->unsetRelation('attribute_values')->load('attribute_values');
        $attributes = $context['family']->custom_attributes()
            ->whereIn('attributes.code', [
                'sku', 'name', 'url_key', 'short_description', 'description', 'new', 'featured',
                'visible_individually', 'status', 'guest_checkout',
            ])
            ->get();
        $this->attributeValueRepository->saveValues([
            'channel' => $context['channel']->code,
            'locale' => $context['locale'],
            'sku' => $definition['sku'],
            'name' => $definition['name'],
            'url_key' => $definition['slug'],
            'short_description' => $definition['short_description'] ?? $definition['description'],
            'description' => $definition['description'],
            'new' => false,
            'featured' => false,
            'visible_individually' => true,
            'status' => true,
            'guest_checkout' => true,
        ], $parent, $attributes);

        $this->attachDemoImageIfMissing($parent, $definition['image'], $definition['fallback_image']);

        return $parent->refresh();
    }

    /** @return array<int, null> */
    private function existingImageFiles(Product $product): array
    {
        return $product->images()
            ->orderBy('position')
            ->pluck('id')
            ->mapWithKeys(fn (int $id) => [$id => null])
            ->all();
    }

    private function attachDemoImageIfMissing(Product $product, string $asset, string $fallbackAsset): void
    {
        if ($product->images()->exists()) {
            return;
        }

        $paths = [
            rtrim((string) config('b2b.demo_assets_path', '/opt/b2b-demo-assets'), '/').'/'.$asset,
            rtrim((string) config('b2b.demo_assets_path', '/opt/b2b-demo-assets'), '/').'/'.$fallbackAsset,
        ];
        $path = collect($paths)->first(fn (string $candidate) => is_file($candidate));

        if (! is_string($path)) {
            return;
        }

        $this->productImageRepository->upload([
            'images' => [
                'files' => [new UploadedFile(
                    $path,
                    $asset,
                    mime_content_type($path) ?: 'image/png',
                    null,
                    true,
                )],
            ],
        ], $product, 'images');
    }

    /**
     * @return array{
     *     channel: Channel, locale: string, currency: string, family: AttributeFamily,
     *     guestGroup: CustomerGroup, inventorySource: InventorySource
     * }
     */
    private function resolveContext(): array
    {
        if (! Schema::hasTable('b2b_product_configs')) {
            throw new RuntimeException('The B2B product configuration migration has not been run.');
        }

        $channel = core()->getCurrentChannel();

        if (! $channel) {
            throw new RuntimeException('No current sales channel is configured.');
        }

        $locale = $channel->default_locale?->code;

        if (! $locale) {
            throw new RuntimeException('The current channel has no default locale.');
        }

        $currency = $channel->base_currency?->code;

        if ($currency !== 'VND') {
            throw new RuntimeException('The current channel must use VND as its base currency.');
        }

        $guestGroup = $this->customerGroupRepository->findOneByField('code', 'guest');

        if (! $guestGroup) {
            throw new RuntimeException('The guest customer group is missing.');
        }

        $inventorySource = $channel->inventory_sources()->where('status', 1)->first();

        if (! $inventorySource) {
            throw new RuntimeException('The current channel has no active inventory source.');
        }

        $family = $this->attributeFamilyRepository->findOneByField('code', 'default');

        if (! $family) {
            throw new RuntimeException('The default attribute family is missing.');
        }

        $familyAttributeCodes = $family->custom_attributes()->pluck('code');
        $missingAttributes = collect(self::REQUIRED_ATTRIBUTES)->diff($familyAttributeCodes);

        if ($missingAttributes->isNotEmpty()) {
            throw new RuntimeException('Required product attributes are missing: '.$missingAttributes->implode(', ').'.');
        }

        core()->setCurrentChannel($channel);
        core()->setDefaultChannel($channel);
        core()->setCurrentCurrency($currency);
        app()->setLocale($locale);

        return compact('channel', 'locale', 'currency', 'family', 'guestGroup', 'inventorySource');
    }
}
