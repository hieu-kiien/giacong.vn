<?php

use Acme\B2b\Contracts\ProductConfig as ProductConfigContract;
use Acme\B2b\Listeners\ProductConfigUpdateListener;
use Acme\B2b\Models\ProductConfig;
use Acme\B2b\Models\ProductConfigProxy;
use Acme\B2b\Repositories\ProductConfigRepository;
use Acme\B2b\Services\ProductConfigPolicy;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\Event;
use Illuminate\Validation\ValidationException;
use Webkul\Product\Models\Product;

it('persists product configuration and belongs to a core product', function () {
    $product = Product::factory()->simple()->create([
        'attribute_family_id' => null,
    ]);

    $config = app(ProductConfigRepository::class)->create([
        'product_id' => $product->id,
        'unit' => 'kg',
        'moq' => 20,
        'quantity_step' => 5,
        'contact_from_quantity' => 100,
    ]);

    expect($config)
        ->toBeInstanceOf(ProductConfigContract::class)
        ->unit->toBe('kg')
        ->moq->toBe(20)
        ->quantity_step->toBe(5)
        ->contact_from_quantity->toBe(100)
        ->and($config->product->is($product))->toBeTrue();

    $this->assertDatabaseHas('b2b_product_configs', [
        'product_id' => $product->id,
        'unit' => 'kg',
        'moq' => 20,
        'quantity_step' => 5,
        'contact_from_quantity' => 100,
    ]);
});

it('allows only one configuration per product', function () {
    $product = Product::factory()->simple()->create([
        'attribute_family_id' => null,
    ]);

    ProductConfigProxy::create([
        'product_id' => $product->id,
        'unit' => 'kg',
        'moq' => 20,
        'quantity_step' => 5,
    ]);

    expect(fn () => ProductConfigProxy::create([
        'product_id' => $product->id,
        'unit' => 'box',
        'moq' => 10,
        'quantity_step' => 2,
    ]))->toThrow(QueryException::class);
});

it('deletes the configuration when its core product is deleted', function () {
    $product = Product::factory()->simple()->create([
        'attribute_family_id' => null,
    ]);

    $config = app(ProductConfigRepository::class)->create([
        'product_id' => $product->id,
        'unit' => 'kg',
        'moq' => 20,
        'quantity_step' => 5,
    ]);

    $this->assertDatabaseHas('b2b_product_configs', [
        'id' => $config->id,
        'product_id' => $product->id,
    ]);

    $product->delete();

    $this->assertDatabaseMissing('b2b_product_configs', [
        'id' => $config->id,
        'product_id' => $product->id,
    ]);
});

it('resolves the contract model through the proxy and repository', function () {
    $repository = app(ProductConfigRepository::class);

    expect(ProductConfigProxy::modelClass())->toBe(ProductConfig::class)
        ->and($repository->model())->toBe(ProductConfigContract::class)
        ->and($repository->getModel())
        ->toBeInstanceOf(ProductConfig::class)
        ->toBeInstanceOf(ProductConfigContract::class);
});

it('persists validated B2B policy fields for a product', function () {
    $product = Product::factory()->simple()->create([
        'attribute_family_id' => null,
    ]);

    $config = app(ProductConfigPolicy::class)->save($product->id, [
        'unit' => 'kg',
        'moq' => 20,
        'quantity_step' => 5,
        'contact_from_quantity' => 100,
    ]);

    expect($config)
        ->unit->toBe('kg')
        ->moq->toBe(20)
        ->quantity_step->toBe(5)
        ->contact_from_quantity->toBe(100);
});

it('rejects invalid B2B policy fields', function () {
    $product = Product::factory()->simple()->create([
        'attribute_family_id' => null,
    ]);

    expect(fn () => app(ProductConfigPolicy::class)->save($product->id, [
        'unit' => '',
        'moq' => 0,
        'quantity_step' => 0,
        'contact_from_quantity' => 10,
    ]))
        ->toThrow(ValidationException::class);

    expect(ProductConfig::query()->where('product_id', $product->id)->exists())
        ->toBeFalse();
});

it('rejects a unit that only contains whitespace', function () {
    $product = Product::factory()->simple()->create([
        'attribute_family_id' => null,
    ]);

    expect(fn () => app(ProductConfigPolicy::class)->save($product->id, [
        'unit' => '   ',
        'moq' => 20,
        'quantity_step' => 5,
        'contact_from_quantity' => 100,
    ]))
        ->toThrow(ValidationException::class);

    expect(ProductConfig::query()->where('product_id', $product->id)->exists())
        ->toBeFalse();
});

it('allows a contact threshold independent from the B2B quantity step', function () {
    $product = Product::factory()->simple()->create([
        'attribute_family_id' => null,
    ]);

    $config = app(ProductConfigPolicy::class)->save($product->id, [
        'unit' => 'can',
        'moq' => 6,
        'quantity_step' => 3,
        'contact_from_quantity' => 140,
    ]);

    expect($config)
        ->unit->toBe('can')
        ->moq->toBe(6)
        ->quantity_step->toBe(3)
        ->contact_from_quantity->toBe(140);
});

it('uses the B2B policy when the native product update listener runs', function () {
    $product = Product::factory()->simple()->create([
        'attribute_family_id' => null,
    ]);

    request()->replace([
        'b2b' => [
            'unit' => 'kg',
            'moq' => 20,
            'quantity_step' => 5,
            'contact_from_quantity' => 100,
        ],
    ]);

    $listener = app(ProductConfigUpdateListener::class);

    $listener->beforeUpdate($product->id);
    $listener->afterUpdate($product);

    expect(ProductConfig::query()->where('product_id', $product->id)->sole())
        ->unit->toBe('kg')
        ->moq->toBe(20)
        ->quantity_step->toBe(5)
        ->contact_from_quantity->toBe(100);
});

it('registers B2B validation before native product updates', function () {
    $product = Product::factory()->simple()->create([
        'attribute_family_id' => null,
    ]);

    request()->replace([
        'b2b' => [
            'unit' => '',
            'moq' => 0,
            'quantity_step' => 0,
            'contact_from_quantity' => 10,
        ],
    ]);

    expect(fn () => Event::dispatch('catalog.product.update.before', $product->id))
        ->toThrow(ValidationException::class);
});

it('maps B2B validation errors to the native admin form field names', function () {
    $product = Product::factory()->simple()->create([
        'attribute_family_id' => null,
    ]);

    request()->replace([
        'b2b' => [
            'unit' => '',
            'moq' => 0,
            'quantity_step' => 0,
            'contact_from_quantity' => 10,
        ],
    ]);

    try {
        app(ProductConfigUpdateListener::class)->beforeUpdate($product->id);
    } catch (ValidationException $exception) {
        expect($exception->errors())
            ->toHaveKeys([
                'b2b[unit]',
                'b2b[moq]',
                'b2b[quantity_step]',
            ]);

        return;
    }

    $this->fail('Expected the native admin update to reject invalid B2B fields.');
});

it('renders B2B policy fields in the native product form', function () {
    $product = Product::factory()->simple()->create([
        'attribute_family_id' => null,
    ]);

    app(ProductConfigPolicy::class)->save($product->id, [
        'unit' => 'kg',
        'moq' => 20,
        'quantity_step' => 5,
        'contact_from_quantity' => 100,
    ]);

    $html = view_render_event('bagisto.admin.catalog.product.edit.form.after', [
        'product' => $product,
    ]);

    expect($html)
        ->toContain('Chính sách B2B')
        ->toContain('b2b[unit]')
        ->toContain('b2b[moq]')
        ->toContain('b2b[quantity_step]')
        ->toContain('b2b[contact_from_quantity]')
        ->toContain('value="kg"')
        ->toContain('value="20"')
        ->toContain('value="5"')
        ->toContain('value="100"');
});

it('does not render variant-only B2B policy fields on a configurable parent', function () {
    $product = Product::factory()->configurable()->create([
        'attribute_family_id' => null,
    ]);

    $html = view_render_event('bagisto.admin.catalog.product.edit.form.after', [
        'product' => $product,
    ]);

    expect($html)
        ->not->toContain('Chính sách B2B')
        ->not->toContain('b2b[moq]');
});
