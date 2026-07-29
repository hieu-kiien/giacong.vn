<?php

use Acme\B2b\Models\ProductConfig;
use Acme\B2b\Repositories\ProductConfigRepository;
use Acme\B2b\Services\CatalogService;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Webkul\Attribute\Models\Attribute;
use Webkul\Attribute\Models\AttributeFamily;
use Webkul\Attribute\Models\AttributeOption;
use Webkul\Category\Models\Category;
use Webkul\Core\Models\Channel;
use Webkul\Core\Models\CoreConfig;
use Webkul\Core\Models\Currency;
use Webkul\Core\Models\Locale;
use Webkul\Customer\Models\CustomerGroup;
use Webkul\Inventory\Models\InventorySource;
use Webkul\Product\Models\Product;
use Webkul\Product\Models\ProductAttributeValue;
use Webkul\Product\Models\ProductCustomerGroupPrice;
use Webkul\Product\Models\ProductImage;
use Webkul\Product\Models\ProductInventory;
use Webkul\Product\Models\ProductOrderedInventory;
use Webkul\Product\Repositories\ProductRepository;

function setUpB2bCatalogCore(): void
{
    $locale = Locale::factory()->create([
        'code' => 'vi',
        'name' => 'Vietnamese',
    ]);
    $currency = Currency::factory()->create([
        'code' => 'VND',
        'name' => 'Vietnamese Dong',
        'decimal' => 0,
    ]);
    $inventorySource = InventorySource::create([
        'code' => 'default',
        'name' => 'Default',
        'contact_name' => 'Catalog Test',
        'contact_email' => 'catalog@example.test',
        'contact_number' => '0900000000',
        'country' => 'VN',
        'state' => 'Ho Chi Minh',
        'city' => 'Ho Chi Minh',
        'street' => 'Test Street',
        'postcode' => '700000',
        'status' => 1,
    ]);
    $rootCategory = Category::factory()
        ->hasTranslations(1, [
            'locale' => $locale->code,
            'locale_id' => $locale->id,
            'name' => 'Root',
            'slug' => 'root',
        ])
        ->create([
            'parent_id' => null,
            'status' => 1,
        ]);
    $channel = Channel::factory()->create([
        'code' => 'default',
        'hostname' => 'localhost',
        'default_locale_id' => $locale->id,
        'base_currency_id' => $currency->id,
        'root_category_id' => $rootCategory->id,
    ]);

    $channel->locales()->sync([$locale->id]);
    $channel->currencies()->sync([$currency->id]);
    $channel->inventory_sources()->sync([$inventorySource->id]);

    core()->setCurrentChannel($channel);
    core()->setDefaultChannel($channel);
    app()->setLocale('vi');

    AttributeFamily::factory()->create([
        'code' => 'default',
        'name' => 'Default',
    ]);

    $attributes = [
        'sku' => ['text', false, false],
        'name' => ['text', true, false],
        'url_key' => ['text', true, false],
        'new' => ['boolean', false, false],
        'featured' => ['boolean', false, false],
        'visible_individually' => ['boolean', false, false],
        'status' => ['boolean', false, true],
        'short_description' => ['textarea', true, false],
        'description' => ['textarea', true, false],
        'price' => ['price', false, false],
        'cost' => ['price', false, false],
        'special_price' => ['price', false, false],
        'special_price_from' => ['date', false, true],
        'special_price_to' => ['date', false, true],
        'meta_title' => ['text', true, false],
        'meta_keywords' => ['textarea', true, false],
        'meta_description' => ['textarea', true, false],
        'length' => ['text', false, false],
        'width' => ['text', false, false],
        'height' => ['text', false, false],
        'weight' => ['text', false, false],
        'guest_checkout' => ['boolean', false, false],
        'product_number' => ['text', false, false],
    ];

    foreach ($attributes as $code => [$type, $perLocale, $perChannel]) {
        Attribute::factory()->create([
            'code' => $code,
            'admin_name' => $code,
            'type' => $type,
            'value_per_locale' => $perLocale,
            'value_per_channel' => $perChannel,
        ]);
    }

    $manageStock = Attribute::where('code', 'manage_stock')->sole();

    expect($manageStock->id)->toBeGreaterThan(0);

    CustomerGroup::factory()->create([
        'code' => 'guest',
        'name' => 'Guest',
    ]);
    CustomerGroup::factory()->create([
        'code' => 'general',
        'name' => 'General',
    ]);
}

beforeEach(function () {
    setUpB2bCatalogCore();
});

function createB2bCatalogCategory(array $data = []): Category
{
    $channel = core()->getCurrentChannel();
    $locale = $channel->default_locale;

    return Category::factory()
        ->hasTranslations(1, [
            'locale' => $locale->code,
            'locale_id' => $locale->id,
            'name' => $data['name'] ?? fake()->unique()->words(2, true),
            'slug' => $data['slug'] ?? fake()->unique()->slug(),
            'description' => $data['description'] ?? null,
        ])
        ->create([
            'parent_id' => $channel->root_category_id,
            'position' => $data['position'] ?? 1,
            'status' => $data['status'] ?? 1,
        ]);
}

function createB2bCatalogProduct(array $data = []): object
{
    $channel = core()->getCurrentChannel();
    $locale = $channel->default_locale;
    $sku = $data['sku'] ?? 'B2B-'.fake()->unique()->numerify('######');
    $name = $data['name'] ?? fake()->words(3, true);
    $slug = $data['slug'] ?? fake()->unique()->slug();

    $attributeFamily = AttributeFamily::query()->where('code', 'default')->sole();
    $product = app(ProductRepository::class)->create([
        'type' => 'configurable',
        'sku' => $sku,
        'attribute_family_id' => $attributeFamily->id,
    ]);

    $variantAttribute = Attribute::query()->firstOrCreate([
        'code' => 'b2b_variant',
    ], [
        'admin_name' => 'Phiên bản',
        'type' => 'select',
        'is_configurable' => true,
        'is_user_defined' => true,
    ]);
    $optionLabel = $data['option_label'] ?? 'Tiêu chuẩn';
    $option = AttributeOption::query()->firstOrCreate([
        'attribute_id' => $variantAttribute->id,
        'admin_name' => $optionLabel,
    ], [
        'sort_order' => 1,
    ]);
    DB::table('attribute_option_translations')->updateOrInsert([
        'attribute_option_id' => $option->id,
        'locale' => $locale->code,
    ], [
        'label' => $optionLabel,
    ]);
    $product->super_attributes()->sync([$variantAttribute->id]);

    $variantSku = $data['variant_sku'] ?? $sku.'-VARIANT';
    $variantName = $data['variant_name'] ?? $name.' - '.$optionLabel;
    $variant = app(ProductRepository::class)->create([
        'type' => 'simple',
        'sku' => $variantSku,
        'attribute_family_id' => $attributeFamily->id,
        'parent_id' => $product->id,
    ]);

    $attributeValues = [
        'sku' => ['text_value' => $sku],
        'name' => ['text_value' => $name, 'locale' => $locale->code],
        'url_key' => ['text_value' => $slug, 'locale' => $locale->code],
        'description' => [
            'text_value' => $data['description'] ?? '<p>Plain <strong>catalog</strong> text &amp; details.</p>',
            'locale' => $locale->code,
        ],
        'status' => [
            'boolean_value' => $data['status'] ?? true,
            'channel' => $channel->code,
        ],
        'visible_individually' => [
            'boolean_value' => $data['visible_individually'] ?? true,
        ],
    ];

    $attributes = Attribute::query()
        ->whereIn('code', array_keys($attributeValues))
        ->get()
        ->keyBy('code');

    foreach ($attributeValues as $code => $value) {
        $attribute = $attributes->get($code);
        $attributeChannel = $value['channel'] ?? null;
        $attributeLocale = $value['locale'] ?? null;

        ProductAttributeValue::create(array_merge($value, [
            'product_id' => $product->id,
            'attribute_id' => $attribute->id,
            'unique_id' => implode('|', array_filter([
                $attributeChannel,
                $attributeLocale,
                $product->id,
                $attribute->id,
            ])),
        ]));
    }

    $variantAttributeValues = [
        'sku' => ['text_value' => $variantSku],
        'name' => ['text_value' => $variantName, 'locale' => $locale->code],
        'url_key' => ['text_value' => $slug.'-'.$option->id, 'locale' => $locale->code],
        'status' => [
            'boolean_value' => $data['variant_status'] ?? ($data['status'] ?? true),
            'channel' => $channel->code,
        ],
        'visible_individually' => ['boolean_value' => false],
        'manage_stock' => ['boolean_value' => $data['manage_stock'] ?? true],
        'price' => ['float_value' => $data['price'] ?? null],
        'b2b_variant' => ['integer_value' => $option->id],
    ];
    $variantAttributes = Attribute::query()
        ->whereIn('code', array_keys($variantAttributeValues))
        ->get()
        ->keyBy('code');

    foreach ($variantAttributeValues as $code => $value) {
        $attribute = $variantAttributes->get($code);
        ProductAttributeValue::create(array_merge($value, [
            'product_id' => $variant->id,
            'attribute_id' => $attribute->id,
            'unique_id' => implode('|', array_filter([
                $value['channel'] ?? null,
                $value['locale'] ?? null,
                $variant->id,
                $attribute->id,
            ])),
        ]));
    }

    if (($data['channel'] ?? true) === false) {
        $product->channels()->detach($channel->id);
        $variant->channels()->detach($channel->id);
    }

    $category = $data['category'] ?? createB2bCatalogCategory();

    if ($category) {
        $product->categories()->sync([$category->id]);
    }

    if (($data['config'] ?? true) !== false) {
        app(ProductConfigRepository::class)->create([
            'product_id' => $variant->id,
            'unit' => $data['unit'] ?? 'kg',
            'moq' => $data['moq'] ?? 20,
            'quantity_step' => $data['quantity_step'] ?? 5,
            'contact_from_quantity' => $data['contact_from_quantity'] ?? 100,
        ]);
    }

    $guestGroup = core()->getGuestCustomerGroup();

    foreach ($data['tiers'] ?? [['qty' => 20, 'value' => 100000]] as $tier) {
        $customerGroupId = array_key_exists('customer_group_id', $tier)
            ? $tier['customer_group_id']
            : $guestGroup->id;

        ProductCustomerGroupPrice::create([
            'product_id' => $variant->id,
            'customer_group_id' => $customerGroupId,
            'qty' => $tier['qty'],
            'value_type' => $tier['value_type'] ?? 'fixed',
            'value' => $tier['value'],
            'unique_id' => implode('|', array_filter([
                $tier['qty'],
                $variant->id,
                $customerGroupId,
            ])),
        ]);
    }

    ProductInventory::create([
        'product_id' => $variant->id,
        'inventory_source_id' => $channel->inventory_sources()->firstOrFail()->id,
        'vendor_id' => 0,
        'qty' => $data['inventory_qty'] ?? 1000,
    ]);

    $product = $product->unsetRelation('attribute_values')->refresh();
    $product->setAttribute('url_key', $slug);

    return $product;
}

function cloneB2bCatalogVariant(Product $source, Product $parent, int $number): Product
{
    $variant = Product::query()->create([
        'type' => 'simple',
        'sku' => sprintf('%s-CLONE-%02d', $parent->sku, $number),
        'attribute_family_id' => $parent->attribute_family_id,
        'parent_id' => $parent->id,
    ]);
    $variant->channels()->sync($source->channels()->pluck('channels.id'));

    foreach ($source->attribute_values as $value) {
        $copy = $value->replicate(['unique_id']);
        $copy->product_id = $variant->id;
        $copy->unique_id = implode('|', array_filter([
            $copy->channel,
            $copy->locale,
            $variant->id,
            $copy->attribute_id,
        ]));

        if ($value->attribute->code === 'sku') {
            $copy->text_value = $variant->sku;
        }

        if ($value->attribute->code === 'name') {
            $copy->text_value = sprintf('Biến thể %02d', $number);
        }

        $copy->save();
    }

    $config = ProductConfig::query()->where('product_id', $source->id)->sole();
    ProductConfig::query()->create(array_merge(
        $config->only(['unit', 'moq', 'quantity_step', 'contact_from_quantity']),
        ['product_id' => $variant->id],
    ));

    foreach ($source->customer_group_prices as $tier) {
        ProductCustomerGroupPrice::query()->create([
            'product_id' => $variant->id,
            'customer_group_id' => $tier->customer_group_id,
            'qty' => $tier->qty,
            'value_type' => $tier->value_type,
            'value' => $tier->value,
            'unique_id' => implode('|', [$tier->qty, $variant->id, $tier->customer_group_id]),
        ]);
    }

    foreach ($source->inventories as $inventory) {
        ProductInventory::query()->create([
            'product_id' => $variant->id,
            'inventory_source_id' => $inventory->inventory_source_id,
            'vendor_id' => $inventory->vendor_id,
            'qty' => $inventory->qty,
        ]);
    }

    return $variant;
}

it('returns the exact public product list and detail contracts', function () {
    $category = createB2bCatalogCategory([
        'name' => 'Nguyên liệu',
        'slug' => 'nguyen-lieu',
    ]);

    $product = createB2bCatalogProduct([
        'category' => $category,
        'sku' => 'B2B-CACAO',
        'name' => 'Bột cacao',
        'slug' => 'bot-cacao',
        'description' => '<p>Nguyên chất <strong>100%</strong> &amp; thơm.</p>',
        'unit' => 'kg',
        'moq' => 20,
        'quantity_step' => 5,
        'tiers' => [
            ['qty' => 50, 'value' => 90000],
            ['qty' => 20, 'value' => 100000],
        ],
    ]);

    expect($product->type)->toBe('configurable');

    ProductImage::create([
        'product_id' => $product->id,
        'path' => 'product/missing-image.webp',
        'position' => 0,
    ]);

    $response = $this->getJson('/api/b2b/catalog/products');

    $response->assertOk()
        ->assertHeader('Cache-Control', 'no-store, private')
        ->assertJsonCount(1, 'data')
        ->assertJsonPath('data.0.id', $product->id)
        ->assertJsonPath('data.0.sku', 'B2B-CACAO')
        ->assertJsonPath('data.0.slug', 'bot-cacao')
        ->assertJsonPath('data.0.name', 'Bột cacao')
        ->assertJsonPath('data.0.description', 'Nguyên chất 100% & thơm.')
        ->assertJsonPath('data.0.image', null)
        ->assertJsonPath('data.0.categories.0.slug', 'nguyen-lieu')
        ->assertJsonPath('data.0.type', 'configurable')
        ->assertJsonPath('data.0.variant_count', 1)
        ->assertJsonPath('data.0.available_variant_count', 1)
        ->assertJsonPath('data.0.starting_price.unit_price', 100000)
        ->assertJsonPath('data.0.starting_price.currency', 'VND')
        ->assertJsonStructure([
            'data',
            'links' => ['first', 'last', 'prev', 'next'],
            'meta' => [
                'current_page', 'from', 'last_page', 'path', 'per_page', 'to', 'total',
                'channel', 'locale', 'currency', 'contract_version',
            ],
        ]);

    expect(array_keys($response->json('data.0')))->toBe([
        'id', 'type', 'sku', 'slug', 'name', 'description', 'image', 'categories',
        'variant_count', 'available_variant_count', 'starting_price',
    ]);

    $detail = $this->getJson('/api/b2b/catalog/products/bot-cacao')
        ->assertOk()
        ->assertHeader('Cache-Control', 'no-store, private')
        ->assertJsonPath('data.id', $product->id)
        ->assertJsonCount(1, 'data.option_groups')
        ->assertJsonCount(1, 'data.variants')
        ->assertJsonPath('data.variants.0.moq', 20)
        ->assertJsonPath('data.variants.0.availability.is_available', true)
        ->assertJsonPath('meta.currency', 'VND');

    expect(array_keys($detail->json('data')))->toBe([
        'id', 'type', 'sku', 'slug', 'name', 'description', 'image', 'categories',
        'variant_count', 'available_variant_count', 'starting_price',
        'option_groups', 'variant_index', 'variants',
    ])->and(array_keys($detail->json('data.variants.0')))->toBe([
        'id', 'sku', 'name', 'option_values', 'image', 'unit', 'moq',
        'quantity_step', 'contact_from_quantity', 'availability', 'tier_prices',
    ]);
});

it('uses the native Bagisto price when a variant has no guest pricing tier', function () {
    $product = createB2bCatalogProduct([
        'sku' => 'NATIVE-PRICE',
        'slug' => 'native-price',
        'price' => 245000,
        'tiers' => [],
    ]);

    $this->getJson('/api/b2b/catalog/products')
        ->assertOk()
        ->assertJsonPath('data.0.id', $product->id)
        ->assertJsonPath('data.0.starting_price.unit_price', 245000);

    $this->getJson('/api/b2b/catalog/products/native-price')
        ->assertOk()
        ->assertJsonPath('data.starting_price.unit_price', 245000)
        ->assertJsonPath('data.variants.0.tier_prices.0.min_quantity', 20)
        ->assertJsonPath('data.variants.0.tier_prices.0.unit_price', 245000);
});

it('returns only categories represented by public products', function () {
    $represented = createB2bCatalogCategory([
        'name' => 'Có sản phẩm',
        'slug' => 'co-san-pham',
        'description' => '<p>Mô tả <strong>thuần</strong>.</p>',
    ]);
    $empty = createB2bCatalogCategory([
        'name' => 'Trống',
        'slug' => 'trong',
    ]);

    createB2bCatalogProduct(['category' => $represented]);

    $response = $this->getJson('/api/b2b/catalog/categories');

    $response->assertOk()
        ->assertHeader('Cache-Control', 'no-store, private')
        ->assertJsonCount(1, 'data')
        ->assertJsonPath('data.0.id', $represented->id)
        ->assertJsonPath('data.0.parent_id', $represented->parent_id)
        ->assertJsonPath('data.0.slug', 'co-san-pham')
        ->assertJsonPath('data.0.description', 'Mô tả thuần.')
        ->assertJsonPath('data.0.image', null)
        ->assertJsonMissing(['id' => $empty->id])
        ->assertJsonStructure(['meta' => ['channel', 'locale', 'contract_version']])
        ->assertJsonPath('meta.contract_version', 2);
});

it('paginates and sorts products by localized name then id', function () {
    $category = createB2bCatalogCategory();

    foreach (range(13, 1) as $number) {
        createB2bCatalogProduct([
            'category' => $category,
            'name' => sprintf('Sản phẩm %02d', $number),
            'slug' => sprintf('san-pham-%02d', $number),
        ]);
    }

    $firstPage = $this->getJson('/api/b2b/catalog/products?per_page=12');
    $secondPage = $this->getJson('/api/b2b/catalog/products?per_page=12&page=2');

    $firstPage->assertOk()
        ->assertJsonCount(12, 'data')
        ->assertJsonPath('data.0.name', 'Sản phẩm 01')
        ->assertJsonPath('meta.current_page', 1)
        ->assertJsonPath('meta.per_page', 12)
        ->assertJsonPath('meta.total', 13);

    $secondPage->assertOk()
        ->assertJsonCount(1, 'data')
        ->assertJsonPath('data.0.name', 'Sản phẩm 13');
});

it('orders the list by the requested sort key and direction', function () {
    $category = createB2bCatalogCategory();

    createB2bCatalogProduct([
        'category' => $category,
        'sku' => 'SORT-B',
        'name' => 'Bột nở',
        'slug' => 'bot-no',
        'tiers' => [['qty' => 20, 'value' => 200000]],
    ]);
    createB2bCatalogProduct([
        'category' => $category,
        'sku' => 'SORT-A',
        'name' => 'Anh đào sấy',
        'slug' => 'anh-dao-say',
        'tiers' => [['qty' => 20, 'value' => 300000]],
    ]);
    createB2bCatalogProduct([
        'category' => $category,
        'sku' => 'SORT-C',
        'name' => 'Cacao nguyên chất',
        'slug' => 'cacao-nguyen-chat',
        'tiers' => [['qty' => 20, 'value' => 100000]],
    ]);

    $names = fn ($response) => collect($response->json('data'))->pluck('name')->all();

    expect($names($this->getJson('/api/b2b/catalog/products?sort=name&direction=asc')->assertOk()))
        ->toBe(['Anh đào sấy', 'Bột nở', 'Cacao nguyên chất']);

    expect($names($this->getJson('/api/b2b/catalog/products?sort=name&direction=desc')->assertOk()))
        ->toBe(['Cacao nguyên chất', 'Bột nở', 'Anh đào sấy']);

    expect(collect($this->getJson('/api/b2b/catalog/products?sort=starting_price&direction=asc')
        ->assertOk()
        ->json('data'))->pluck('starting_price.unit_price')->all())
        ->toBe([100000, 200000, 300000]);

    expect(collect($this->getJson('/api/b2b/catalog/products?sort=starting_price&direction=desc')
        ->assertOk()
        ->json('data'))->pluck('starting_price.unit_price')->all())
        ->toBe([300000, 200000, 100000]);

    $ids = collect($this->getJson('/api/b2b/catalog/products?sort=id&direction=desc')
        ->assertOk()
        ->json('data'))->pluck('id')->all();

    expect($ids)->toBe(collect($ids)->sortDesc()->values()->all());
});

it('filters by trimmed query and direct category slug while escaping wildcards', function () {
    $cacao = createB2bCatalogCategory(['slug' => 'cacao']);
    $tea = createB2bCatalogCategory(['slug' => 'tra']);

    createB2bCatalogProduct([
        'category' => $cacao,
        'sku' => 'SKU-PERCENT',
        'name' => 'Cacao 100% nguyên chất',
        'slug' => 'cacao-100-percent',
    ]);
    createB2bCatalogProduct([
        'category' => $tea,
        'sku' => 'SKU-TEA',
        'name' => 'Trà 100X',
        'slug' => 'tra-100x',
    ]);

    $this->getJson('/api/b2b/catalog/products?q=%25')
        ->assertOk()
        ->assertJsonCount(1, 'data')
        ->assertJsonPath('data.0.sku', 'SKU-PERCENT');

    $this->getJson('/api/b2b/catalog/products?q=%20SKU-TEA%20&category=tra')
        ->assertOk()
        ->assertJsonCount(1, 'data')
        ->assertJsonPath('data.0.sku', 'SKU-TEA');

    $this->getJson('/api/b2b/catalog/products?category=cacao')
        ->assertOk()
        ->assertJsonCount(1, 'data')
        ->assertJsonPath('data.0.slug', 'cacao-100-percent');
});

it('finds a parent through a valid child sku or localized name without duplicating it', function () {
    $parent = createB2bCatalogProduct([
        'sku' => 'PARENT-SEARCH',
        'name' => 'Gia đình tìm kiếm',
        'slug' => 'gia-dinh-tim-kiem',
        'variant_sku' => 'CHILD-NEEDLE',
        'variant_name' => 'Biến thể Kim Chỉ Nam',
    ]);

    $this->getJson('/api/b2b/catalog/products?q=CHILD-NEEDLE')
        ->assertOk()
        ->assertJsonCount(1, 'data')
        ->assertJsonPath('data.0.id', $parent->id);

    $this->getJson('/api/b2b/catalog/products?q=Kim%20Ch%E1%BB%89%20Nam')
        ->assertOk()
        ->assertJsonCount(1, 'data')
        ->assertJsonPath('data.0.id', $parent->id);
});

it('requires a parent slug and exposes out of stock valid siblings as unavailable', function () {
    $parent = createB2bCatalogProduct([
        'sku' => 'PARENT-STOCK',
        'slug' => 'parent-stock',
        'option_label' => 'Còn hàng',
    ]);
    $temporaryParent = createB2bCatalogProduct([
        'sku' => 'TEMP-OOS-PARENT',
        'slug' => 'temp-oos-parent',
        'option_label' => 'Hết hàng',
        'variant_sku' => 'CHILD-OOS',
        'inventory_qty' => 0,
    ]);
    $outOfStock = Product::query()->where('parent_id', $temporaryParent->id)->sole();
    $outOfStock->update(['parent_id' => $parent->id]);
    $temporaryParent->delete();

    $childSlug = $outOfStock->attribute_values()
        ->whereHas('attribute', fn ($query) => $query->where('code', 'url_key'))
        ->value('text_value');

    $this->getJson('/api/b2b/catalog/products')
        ->assertOk()
        ->assertJsonCount(1, 'data')
        ->assertJsonPath('data.0.variant_count', 2)
        ->assertJsonPath('data.0.available_variant_count', 1);

    $detail = $this->getJson('/api/b2b/catalog/products/parent-stock')
        ->assertOk()
        ->assertJsonCount(2, 'data.variants');
    $availability = collect($detail->json('data.variants'))->keyBy('sku');

    expect($availability['CHILD-OOS']['availability']['is_available'])->toBeFalse();

    $this->getJson('/api/b2b/catalog/products/'.$childSlug)
        ->assertNotFound()
        ->assertExactJson(['message' => 'Product not found.']);
});

it('hides a parent when every valid child has less inventory than its MOQ', function () {
    createB2bCatalogProduct([
        'slug' => 'below-moq',
        'moq' => 20,
        'inventory_qty' => 19,
    ]);

    $this->getJson('/api/b2b/catalog/products')
        ->assertOk()
        ->assertJsonCount(0, 'data');

    $this->getJson('/api/b2b/catalog/products/below-moq')
        ->assertNotFound()
        ->assertExactJson(['message' => 'Product not found.']);
});

it('publishes a valid child below MOQ when global backorders are enabled', function () {
    $parent = createB2bCatalogProduct([
        'slug' => 'backordered-parent',
        'moq' => 20,
        'inventory_qty' => 0,
    ]);
    CoreConfig::query()->create([
        'code' => 'catalog.inventory.stock_options.back_orders',
        'value' => '1',
        'channel_code' => core()->getCurrentChannel()->code,
        'locale_code' => null,
    ]);
    $variant = Product::query()->where('parent_id', $parent->id)->sole();
    ProductOrderedInventory::query()->create([
        'product_id' => $variant->id,
        'channel_id' => core()->getCurrentChannel()->id,
        'qty' => 100,
    ]);

    $this->getJson('/api/b2b/catalog/products')
        ->assertOk()
        ->assertJsonCount(1, 'data')
        ->assertJsonPath('data.0.id', $parent->id);

    $this->getJson('/api/b2b/catalog/products/backordered-parent')
        ->assertOk()
        ->assertJsonPath('data.variants.0.availability.is_available', true);
});

it('uses active channel sources minus reserved inventory at MOQ', function () {
    $channel = core()->getCurrentChannel();

    $inactiveParent = createB2bCatalogProduct([
        'sku' => 'INACTIVE-SOURCE-PARENT',
        'slug' => 'inactive-source-parent',
        'moq' => 20,
        'inventory_qty' => 0,
    ]);
    $inactiveVariant = Product::query()->where('parent_id', $inactiveParent->id)->sole();
    $inactiveSource = InventorySource::query()->create([
        'code' => 'inactive-source',
        'name' => 'Inactive source',
        'contact_name' => 'Inactive',
        'contact_email' => 'inactive@example.test',
        'contact_number' => '0900000001',
        'country' => 'VN',
        'state' => 'Ho Chi Minh',
        'city' => 'Ho Chi Minh',
        'street' => 'Inactive Street',
        'postcode' => '700000',
        'status' => 0,
    ]);
    $channel->inventory_sources()->attach($inactiveSource->id);
    ProductInventory::query()->create([
        'product_id' => $inactiveVariant->id,
        'inventory_source_id' => $inactiveSource->id,
        'vendor_id' => 0,
        'qty' => 100,
    ]);

    $reservedParent = createB2bCatalogProduct([
        'sku' => 'RESERVED-PARENT',
        'slug' => 'reserved-parent',
        'moq' => 20,
        'inventory_qty' => 20,
    ]);
    $reservedVariant = Product::query()->where('parent_id', $reservedParent->id)->sole();
    ProductOrderedInventory::query()->create([
        'product_id' => $reservedVariant->id,
        'channel_id' => $channel->id,
        'qty' => 1,
    ]);

    $aggregateParent = createB2bCatalogProduct([
        'sku' => 'AGGREGATE-PARENT',
        'slug' => 'aggregate-parent',
        'moq' => 20,
        'inventory_qty' => 10,
    ]);
    $aggregateVariant = Product::query()->where('parent_id', $aggregateParent->id)->sole();
    $secondSource = InventorySource::query()->create([
        'code' => 'second-active-source',
        'name' => 'Second active source',
        'contact_name' => 'Second',
        'contact_email' => 'second@example.test',
        'contact_number' => '0900000002',
        'country' => 'VN',
        'state' => 'Ho Chi Minh',
        'city' => 'Ho Chi Minh',
        'street' => 'Second Street',
        'postcode' => '700000',
        'status' => 1,
    ]);
    $channel->inventory_sources()->attach($secondSource->id);
    ProductInventory::query()->create([
        'product_id' => $aggregateVariant->id,
        'inventory_source_id' => $secondSource->id,
        'vendor_id' => 0,
        'qty' => 10,
    ]);

    $this->getJson('/api/b2b/catalog/products')
        ->assertOk()
        ->assertJsonCount(1, 'data')
        ->assertJsonPath('data.0.id', $aggregateParent->id);
});

it('excludes orphan and wrong-attribute options while a valid sibling keeps its parent public', function () {
    $orphanParent = createB2bCatalogProduct([
        'sku' => 'ORPHAN-OPTION-PARENT',
        'slug' => 'orphan-option-parent',
    ]);
    $orphanVariant = Product::query()->where('parent_id', $orphanParent->id)->sole();
    $orphanVariant->attribute_values()
        ->whereHas('attribute', fn ($query) => $query->where('code', 'b2b_variant'))
        ->update(['integer_value' => 999999]);

    $wrongParent = createB2bCatalogProduct([
        'sku' => 'WRONG-OPTION-PARENT',
        'slug' => 'wrong-option-parent',
        'option_label' => 'Sai thuộc tính',
    ]);
    $wrongVariant = Product::query()->where('parent_id', $wrongParent->id)->sole();
    $otherAttribute = Attribute::query()->create([
        'code' => 'other_configurable_option',
        'admin_name' => 'Other option',
        'type' => 'select',
        'is_configurable' => true,
        'is_user_defined' => true,
    ]);
    $wrongOption = AttributeOption::query()->create([
        'attribute_id' => $otherAttribute->id,
        'admin_name' => 'Wrong attribute option',
        'sort_order' => 1,
    ]);
    $wrongVariant->attribute_values()
        ->whereHas('attribute', fn ($query) => $query->where('code', 'b2b_variant'))
        ->update(['integer_value' => $wrongOption->id]);

    $temporaryParent = createB2bCatalogProduct([
        'sku' => 'VALID-SIBLING-TEMP',
        'slug' => 'valid-sibling-temp',
        'option_label' => 'Đúng thuộc tính',
    ]);
    $validSibling = Product::query()->where('parent_id', $temporaryParent->id)->sole();
    $validSibling->update(['parent_id' => $wrongParent->id]);
    $temporaryParent->delete();

    $this->getJson('/api/b2b/catalog/products')
        ->assertOk()
        ->assertJsonCount(1, 'data')
        ->assertJsonPath('data.0.id', $wrongParent->id)
        ->assertJsonPath('data.0.variant_count', 1);

    $this->getJson('/api/b2b/catalog/products/wrong-option-parent')
        ->assertOk()
        ->assertJsonCount(1, 'data.variants')
        ->assertJsonPath('data.variants.0.id', $validSibling->id);
});

it('isolates guest fixed tiers and excludes invalid monetary tier values', function () {
    $generalGroup = CustomerGroup::query()->where('code', 'general')->firstOrFail();
    $valid = createB2bCatalogProduct([
        'sku' => 'VALID-TIERS',
        'slug' => 'valid-tiers',
        'tiers' => [
            ['qty' => 30, 'value' => 90000],
            ['qty' => 20, 'value' => 100000],
            ['qty' => 25, 'value' => 95000, 'customer_group_id' => null],
            ['qty' => 25, 'value' => 94000, 'customer_group_id' => $generalGroup->id],
            ['qty' => 25, 'value' => 10, 'value_type' => 'discount'],
        ],
    ]);
    createB2bCatalogProduct([
        'sku' => 'BAD-FIRST',
        'slug' => 'bad-first',
        'tiers' => [['qty' => 25, 'value' => 100000]],
    ]);
    createB2bCatalogProduct([
        'sku' => 'BAD-STEP',
        'slug' => 'bad-step',
        'tiers' => [
            ['qty' => 20, 'value' => 100000],
            ['qty' => 27, 'value' => 90000],
        ],
    ]);
    createB2bCatalogProduct([
        'sku' => 'BAD-VND',
        'slug' => 'bad-vnd',
        'tiers' => [['qty' => 20, 'value' => 99999.5]],
    ]);
    createB2bCatalogProduct([
        'sku' => 'BAD-CONTACT-STEP',
        'slug' => 'bad-contact-step',
        'contact_from_quantity' => 102,
    ]);
    createB2bCatalogProduct([
        'sku' => 'BAD-TIER-AT-CONTACT',
        'slug' => 'bad-tier-at-contact',
        'contact_from_quantity' => 30,
        'tiers' => [
            ['qty' => 20, 'value' => 100000],
            ['qty' => 30, 'value' => 90000],
        ],
    ]);

    $response = $this->getJson('/api/b2b/catalog/products');

    $response->assertOk()
        ->assertJsonCount(4, 'data');

    expect(collect($response->json('data'))->pluck('id')->all())
        ->toContain($valid->id);

    $this->getJson('/api/b2b/catalog/products/valid-tiers')
        ->assertOk()
        ->assertJsonCount(2, 'data.variants.0.tier_prices')
        ->assertJsonPath('data.variants.0.tier_prices.0.min_quantity', 20)
        ->assertJsonPath('data.variants.0.tier_prices.1.min_quantity', 30);
});

it('excludes every unavailable product and returns the same not found body', function () {
    $inactiveCategory = createB2bCatalogCategory(['status' => 0]);

    $products = [
        createB2bCatalogProduct(['slug' => 'inactive', 'status' => false]),
        createB2bCatalogProduct(['slug' => 'hidden', 'visible_individually' => false]),
        createB2bCatalogProduct(['slug' => 'missing-config', 'config' => false]),
        createB2bCatalogProduct(['slug' => 'inactive-category', 'category' => $inactiveCategory]),
        createB2bCatalogProduct(['slug' => 'wrong-channel', 'channel' => false]),
    ];

    $nativePriceProduct = createB2bCatalogProduct(['slug' => 'missing-tier', 'tiers' => []]);

    $this->getJson('/api/b2b/catalog/products')
        ->assertOk()
        ->assertJsonCount(1, 'data')
        ->assertJsonPath('data.0.id', $nativePriceProduct->id);

    foreach ($products as $product) {
        $this->getJson('/api/b2b/catalog/products/'.$product->url_key)
            ->assertNotFound()
            ->assertExactJson(['message' => 'Product not found.']);
    }
});

it('validates catalog list query parameters', function (string $query, string $field) {
    $this->getJson('/api/b2b/catalog/products?'.$query)
        ->assertUnprocessable()
        ->assertJsonValidationErrors([$field]);
})->with([
    ['q='.str_repeat('a', 101), 'q'],
    ['page=0', 'page'],
    ['per_page=0', 'per_page'],
    ['per_page=49', 'per_page'],
    ['sort=password', 'sort'],
    ['sort=catalog_starting_price', 'sort'],
    ['direction=sideways', 'direction'],
    ['direction=asc;%20DROP%20TABLE%20products', 'direction'],
]);

it('rate limits catalog requests by IP and preserves Retry-After', function () {
    for ($attempt = 1; $attempt <= 120; $attempt++) {
        $this->withServerVariables(['REMOTE_ADDR' => '198.51.100.120'])
            ->getJson('/api/b2b/catalog/categories')
            ->assertOk();
    }

    $this->withServerVariables(['REMOTE_ADDR' => '198.51.100.120'])
        ->getJson('/api/b2b/catalog/categories')
        ->assertTooManyRequests()
        ->assertHeader('Retry-After')
        ->assertHeader('Cache-Control', 'no-store, private');
});

it('keeps list database queries bounded for twelve products', function () {
    $category = createB2bCatalogCategory();

    foreach (range(1, 12) as $number) {
        createB2bCatalogProduct([
            'category' => $category,
            'name' => sprintf('Bounded %02d', $number),
        ]);
    }

    DB::flushQueryLog();
    DB::enableQueryLog();

    $this->getJson('/api/b2b/catalog/products?per_page=12')
        ->assertOk()
        ->assertJsonCount(12, 'data');

    $queryCount = count(DB::getQueryLog());
    DB::disableQueryLog();

    expect($queryCount)->toBeLessThanOrEqual(20);
});

it('keeps detail queries bounded with fifty variants and never lazy loads', function () {
    $parent = createB2bCatalogProduct([
        'sku' => 'BOUNDED-PARENT',
        'slug' => 'bounded-parent',
    ]);
    $source = Product::query()
        ->with(['channels', 'attribute_values.attribute', 'customer_group_prices', 'inventories'])
        ->where('parent_id', $parent->id)
        ->sole();

    foreach (range(2, 50) as $number) {
        cloneB2bCatalogVariant($source, $parent, $number);
    }

    DB::flushQueryLog();
    DB::enableQueryLog();
    Model::preventLazyLoading();

    try {
        $this->getJson('/api/b2b/catalog/products/bounded-parent')
            ->assertOk()
            ->assertJsonCount(50, 'data.variants');
    } finally {
        Model::preventLazyLoading(false);
    }

    $queryCount = count(DB::getQueryLog());
    DB::disableQueryLog();

    expect($queryCount)->toBeLessThanOrEqual(20);
});

it('loads multiple catalog details in one batch for cart revalidation', function () {
    createB2bCatalogProduct(['slug' => 'batch-first']);
    createB2bCatalogProduct(['slug' => 'batch-second']);

    DB::flushQueryLog();
    DB::enableQueryLog();

    $products = app(CatalogService::class)->findProducts([
        'batch-first',
        'batch-second',
        'batch-first',
    ]);

    $queryCount = count(DB::getQueryLog());
    DB::disableQueryLog();

    expect($products->keys()->all())->toBe(['batch-first', 'batch-second'])
        ->and($products->get('batch-first')->variants)->toHaveCount(1)
        ->and($products->get('batch-second')->variants)->toHaveCount(1)
        ->and($queryCount)->toBeLessThanOrEqual(20);
});

it('resolves a multi-line request cart from Bagisto as the canonical pricing source', function () {
    $priced = createB2bCatalogProduct([
        'sku' => 'CANONICAL-PRICED',
        'slug' => 'canonical-priced',
        'name' => 'Bột dinh dưỡng chuẩn',
        'variant_sku' => 'CANONICAL-PRICED-05',
        'variant_name' => 'Bao 5 kg',
        'unit' => 'bao',
        'moq' => 20,
        'quantity_step' => 5,
        'contact_from_quantity' => 100,
        'tiers' => [
            ['qty' => 20, 'value' => 92000],
            ['qty' => 50, 'value' => 88000],
        ],
    ]);
    Storage::put('product/canonical-cart.webp', 'fixture');
    ProductImage::create([
        'product_id' => $priced->id,
        'path' => 'product/canonical-cart.webp',
        'position' => 0,
    ]);
    $unavailable = createB2bCatalogProduct([
        'sku' => 'CANONICAL-UNAVAILABLE',
        'slug' => 'canonical-unavailable',
        'variant_sku' => 'CANONICAL-UNAVAILABLE-05',
    ]);
    $unavailableVariant = Product::query()->where('parent_id', $unavailable->id)->sole();
    ProductInventory::query()->where('product_id', $unavailableVariant->id)->sole()->update(['qty' => 0]);
    $availableSibling = cloneB2bCatalogVariant(
        $unavailableVariant->load(['channels', 'attribute_values.attribute', 'customer_group_prices', 'inventories']),
        $unavailable,
        2,
    );
    ProductInventory::query()->where('product_id', $availableSibling->id)->sole()->update(['qty' => 1000]);
    $offStep = createB2bCatalogProduct([
        'sku' => 'CANONICAL-OFF-STEP',
        'slug' => 'canonical-off-step',
        'variant_sku' => 'CANONICAL-OFF-STEP-05',
        'unit' => 'bao',
        'moq' => 20,
        'quantity_step' => 5,
        'contact_from_quantity' => 100,
    ]);

    $response = $this->postJson('/api/b2b/catalog/resolve-cart', [
        'lines' => [
            ['parent_slug' => 'canonical-priced', 'variant_sku' => 'CANONICAL-PRICED-05', 'quantity' => 50],
            ['parent_slug' => 'canonical-off-step', 'variant_sku' => 'CANONICAL-OFF-STEP-05', 'quantity' => 21],
            ['parent_slug' => 'canonical-unavailable', 'variant_sku' => 'CANONICAL-UNAVAILABLE-05', 'quantity' => 20],
            ['parent_slug' => 'missing', 'variant_sku' => 'MISSING-05', 'quantity' => 20],
        ],
    ]);

    $response->assertOk()
        ->assertHeader('Cache-Control', 'no-store, private')
        ->assertJsonPath('cart.currency', 'VND')
        ->assertJsonPath('cart.line_count', 4)
        ->assertJsonPath('cart.priced_subtotal', 4400000)
        ->assertJsonPath('cart.is_submittable', false)
        ->assertJsonPath('cart.lines.0.product_name', 'Bột dinh dưỡng chuẩn')
        ->assertJsonPath('cart.lines.0.image_url', Storage::url('product/canonical-cart.webp'))
        ->assertJsonPath('cart.lines.0.unit_price', 88000)
        ->assertJsonPath('cart.lines.0.line_total', 4400000)
        ->assertJsonPath('cart.lines.1.adjustments.0.code', 'QUANTITY_OFF_STEP')
        ->assertJsonPath('cart.lines.1.adjustments.0.suggested_quantity', 25)
        ->assertJsonPath('cart.lines.2.adjustments.0.code', 'VARIANT_UNAVAILABLE')
        ->assertJsonPath('cart.lines.3.adjustments.0.code', 'PRODUCT_NOT_FOUND')
        ->assertJsonStructure([
            'cart' => [
                'currency', 'has_price_on_request', 'is_submittable', 'line_count', 'lines',
                'priced_subtotal', 'request_type', 'snapshot_token', 'total_quantity', 'uniform_unit',
            ],
        ]);

    expect($priced->id)->toBeGreaterThan(0)
        ->and($unavailable->id)->toBeGreaterThan(0)
        ->and($offStep->id)->toBeGreaterThan(0);
});
