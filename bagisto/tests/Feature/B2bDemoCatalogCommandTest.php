<?php

use Acme\B2b\Services\DemoCatalogSeeder;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\File;
use Webkul\Attribute\Models\AttributeFamily;
use Webkul\Core\Models\Channel;
use Webkul\Installer\Helpers\DatabaseManager;
use Webkul\Product\Models\Product;
use Webkul\Product\Repositories\ProductRepository;

function seedB2bDemoCore(): void
{
    app(DatabaseManager::class)->seed([
        'default_locale' => 'vi',
        'allowed_locales' => ['vi'],
        'default_currency' => 'VND',
        'allowed_currencies' => ['VND'],
        'skip_admin_creation' => true,
    ]);

    $channel = Channel::query()->where('code', 'default')->sole();
    core()->setCurrentChannel($channel);
    core()->setDefaultChannel($channel);
    app()->setLocale('vi');
}

beforeEach(function () {
    seedB2bDemoCore();

    $this->b2bDemoAssetDirectory = sys_get_temp_dir().'/b2b-demo-assets-'.uniqid();
    File::ensureDirectoryExists($this->b2bDemoAssetDirectory);

    $image = UploadedFile::fake()->image('demo.png', 32, 32);
    foreach (['demo-powder-pouches.png', 'demo-dried-fruit-pouches.png', 'demo-sauce-bottles.png', 'demo-fruit-drinks.png'] as $filename) {
        File::copy($image->getPathname(), $this->b2bDemoAssetDirectory.'/'.$filename);
    }

    config()->set('b2b.demo_assets_path', $this->b2bDemoAssetDirectory);
    config()->set('b2b.legacy_assets_path', $this->b2bDemoAssetDirectory.'/missing');
    config()->set('filesystems.default', 'b2b-testing');
    config()->set('filesystems.disks.b2b-testing', [
        'driver' => 'local',
        'root' => $this->b2bDemoAssetDirectory.'/storage',
        'throw' => true,
    ]);
});

afterEach(function () {
    File::deleteDirectory($this->b2bDemoAssetDirectory);
});

it('imports the original frontend catalogue as native Bagisto products', function () {
    $this->artisan('b2b:catalog:seed-demo')->assertSuccessful();

    $this->getJson('/api/b2b/catalog/products?per_page=48')
        ->assertOk()
        ->assertJsonCount(9, 'data')
        ->assertJsonPath('meta.total', 9)
        ->assertJsonFragment([
            'name' => 'Bột gạo lứt xay mịn',
            'slug' => 'bot-gao-lut-xay-min',
        ]);

    $this->getJson('/api/b2b/catalog/products/bot-gao-lut-xay-min')
        ->assertOk()
        ->assertJsonPath('data.categories.0.slug', 'bot-nguyen-lieu-kho')
        ->assertJsonPath('data.starting_price.unit_price', 78000)
        ->assertJsonCount(3, 'data.variants')
        ->assertJsonFragment([
            'sku' => 'B2B-DEMO-BGL-05',
            'moq' => 25,
            'quantity_step' => 5,
            'unit' => 'bao',
        ]);
});

it('creates native product records with an image for every original frontend product', function () {
    app(DemoCatalogSeeder::class)->seed();

    $products = Product::query()
        ->where('sku', 'like', 'B2B-DEMO-%')
        ->with('images')
        ->get();

    expect($products)->toHaveCount(26)
        ->and($products->every(fn (Product $product) => $product->images->count() === 1))->toBeTrue();
});

it('removes only the superseded generated demo records', function () {
    $family = AttributeFamily::query()->where('code', 'default')->sole();
    $legacyDemo = app(ProductRepository::class)->create([
        'type' => 'simple',
        'sku' => 'B2B-DEMO-BOT-VANI',
        'attribute_family_id' => $family->id,
    ]);
    $foreign = app(ProductRepository::class)->create([
        'type' => 'simple',
        'sku' => 'FOREIGN-KEEP-SKU',
        'attribute_family_id' => $family->id,
    ]);

    app(DemoCatalogSeeder::class)->seed();

    expect(Product::query()->whereKey($legacyDemo->id)->exists())->toBeFalse()
        ->and(Product::query()->whereKey($foreign->id)->exists())->toBeTrue();
});
