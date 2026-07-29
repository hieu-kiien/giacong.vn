<?php

namespace Acme\B2b\Services;

use Acme\B2b\Models\ProductConfig;
use Illuminate\Support\Facades\Storage;
use Webkul\Product\Models\Product;
use Webkul\Product\Models\ProductAttributeValue;

class CatalogCartResolver
{
    public function __construct(private readonly CatalogService $catalogService) {}

    /**
     * @param  array<int, array{parent_slug: string, variant_sku: string, quantity: int}>  $lines
     * @return array<string, mixed>
     */
    public function resolve(array $lines): array
    {
        $products = $this->catalogService->findProducts(array_column($lines, 'parent_slug'));
        $resolved = array_map(
            fn (array $line) => $this->resolveLine($line, $products->get($line['parent_slug'])),
            $lines,
        );
        $units = collect($resolved)->pluck('unit')->filter()->unique()->values();
        $uniformUnit = $units->count() === 1 ? $units->first() : null;

        return [
            'currency' => 'VND',
            'has_price_on_request' => collect($resolved)->contains('price_on_request', true),
            'is_submittable' => collect($resolved)->every('is_submittable', true),
            'line_count' => count($resolved),
            'lines' => $resolved,
            'priced_subtotal' => collect($resolved)->sum(fn (array $line) => $line['line_total'] ?? 0),
            'request_type' => collect($resolved)->contains('price_on_request', true)
                ? 'Tư vấn số lượng lớn'
                : 'Đặt sản phẩm',
            'snapshot_token' => $this->snapshotToken($resolved),
            'total_quantity' => $uniformUnit === null ? null : collect($resolved)->sum('quantity'),
            'uniform_unit' => $uniformUnit,
        ];
    }

    /**
     * @param  array{parent_slug: string, variant_sku: string, quantity: int}  $line
     * @return array<string, mixed>
     */
    private function resolveLine(array $line, ?Product $product): array
    {
        if ($product === null) {
            return $this->unresolved($line, 'PRODUCT_NOT_FOUND', 'Sản phẩm không còn tồn tại. Vui lòng xóa dòng này.');
        }

        $variant = $product->variants->firstWhere('sku', $line['variant_sku']);
        if (! $variant instanceof Product) {
            return $this->unresolved(
                $line,
                'VARIANT_NOT_FOUND',
                'Biến thể không còn tồn tại. Vui lòng xóa dòng này.',
                $this->attributeValue($product, 'name'),
            );
        }

        /** @var ProductConfig $config */
        $config = $variant->getRelation('b2b_config');
        $base = [
            'adjustments' => [],
            'contact_from_quantity' => $config->contact_from_quantity,
            'image_url' => $this->imageUrl($variant, $product),
            'is_available' => (bool) $variant->getAttribute('b2b_is_available'),
            'is_submittable' => true,
            'line_total' => null,
            'minimum_order_quantity' => $config->moq,
            'parent_slug' => $line['parent_slug'],
            'price_on_request' => false,
            'product_name' => $this->attributeValue($product, 'name') ?? '',
            'quantity' => $line['quantity'],
            'quantity_step' => $config->quantity_step,
            'unit' => $config->unit,
            'unit_price' => null,
            'variant_label' => $this->attributeValue($variant, 'name') ?? '',
            'variant_sku' => $variant->sku,
        ];

        if (! $base['is_available']) {
            return $this->blocked($base, 'VARIANT_UNAVAILABLE', 'Biến thể hiện không khả dụng. Vui lòng xóa dòng này.');
        }
        if ($line['quantity'] < $config->moq) {
            return $this->blocked(
                $base,
                'QUANTITY_BELOW_MOQ',
                "Số lượng tối thiểu là {$config->moq} {$config->unit}.",
                $config->moq,
            );
        }
        if (($line['quantity'] - $config->moq) % $config->quantity_step !== 0) {
            $steps = (int) ceil(($line['quantity'] - $config->moq) / $config->quantity_step);

            return $this->blocked(
                $base,
                'QUANTITY_OFF_STEP',
                "Số lượng phải theo bước {$config->quantity_step} {$config->unit}.",
                $config->moq + ($steps * $config->quantity_step),
            );
        }
        if ($line['quantity'] >= $config->contact_from_quantity) {
            return $this->onRequest(
                $base,
                "Từ {$config->contact_from_quantity} {$config->unit}, giá được báo riêng theo số lượng.",
            );
        }

        $unitPrice = $this->tierPrice($variant, $config, $line['quantity']);
        if ($unitPrice === null) {
            return $this->onRequest($base, 'Giá của số lượng này được báo riêng.');
        }

        return array_merge($base, [
            'line_total' => $unitPrice * $line['quantity'],
            'unit_price' => $unitPrice,
        ]);
    }

    /** @param  array<string, mixed>  $line
     * @return array<string, mixed>
     */
    private function blocked(array $line, string $code, string $message, ?int $suggestedQuantity = null): array
    {
        return array_merge($line, [
            'adjustments' => [array_filter([
                'code' => $code,
                'message' => $message,
                'suggested_quantity' => $suggestedQuantity,
            ], fn ($value) => $value !== null)],
            'is_submittable' => false,
        ]);
    }

    /** @param  array<string, mixed>  $line
     * @return array<string, mixed>
     */
    private function onRequest(array $line, string $message): array
    {
        return array_merge($line, [
            'adjustments' => [['code' => 'PRICE_ON_REQUEST', 'message' => $message]],
            'price_on_request' => true,
        ]);
    }

    /**
     * @param  array{parent_slug: string, variant_sku: string, quantity: int}  $line
     * @return array<string, mixed>
     */
    private function unresolved(array $line, string $code, string $message, string $productName = ''): array
    {
        return [
            'adjustments' => [['code' => $code, 'message' => $message]],
            'contact_from_quantity' => null,
            'image_url' => null,
            'is_available' => false,
            'is_submittable' => false,
            'line_total' => null,
            'minimum_order_quantity' => null,
            'parent_slug' => $line['parent_slug'],
            'price_on_request' => false,
            'product_name' => $productName,
            'quantity' => $line['quantity'],
            'quantity_step' => null,
            'unit' => '',
            'unit_price' => null,
            'variant_label' => '',
            'variant_sku' => $line['variant_sku'],
        ];
    }

    private function tierPrice(Product $variant, ProductConfig $config, int $quantity): ?int
    {
        $tiers = $variant->customer_group_prices
            ->map(fn ($tier) => ['quantity' => (int) $tier->qty, 'price' => (int) $tier->value])
            ->values();
        $hasMoqTier = $tiers->contains(fn (array $tier) => $tier['quantity'] === $config->moq);
        $basePrice = (int) $variant->getAttribute('b2b_base_price');
        if (! $hasMoqTier && $basePrice > 0) {
            $tiers->push(['quantity' => $config->moq, 'price' => $basePrice]);
        }

        return $tiers
            ->filter(fn (array $tier) => $tier['quantity'] <= $quantity)
            ->sortByDesc('quantity')
            ->value('price');
    }

    private function attributeValue(Product $product, string $code): ?string
    {
        $value = $product->attribute_values->first(
            fn (ProductAttributeValue $value) => $value->attribute->code === $code,
        );

        return $value?->text_value;
    }

    private function imageUrl(Product $variant, Product $parent): ?string
    {
        foreach ([$variant, $parent] as $product) {
            $image = $product->images->first(fn ($image) => Storage::exists($image->path));

            if ($image) {
                return Storage::url($image->path);
            }
        }

        return null;
    }

    /** @param  array<int, array<string, mixed>>  $lines */
    private function snapshotToken(array $lines): string
    {
        $canonical = collect($lines)
            ->map(fn (array $line) => [
                $line['parent_slug'], $line['variant_sku'], $line['quantity'], $line['unit_price'],
                $line['line_total'], $line['is_available'], $line['price_on_request'],
                $line['minimum_order_quantity'], $line['quantity_step'], $line['contact_from_quantity'],
                $line['is_submittable'],
            ])
            ->sortBy(fn (array $line) => $line[1])
            ->values()
            ->all();

        return hash('sha256', json_encode($canonical, JSON_THROW_ON_ERROR));
    }
}
