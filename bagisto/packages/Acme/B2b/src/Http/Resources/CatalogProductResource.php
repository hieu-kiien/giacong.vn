<?php

namespace Acme\B2b\Http\Resources;

use Acme\B2b\Models\ProductConfig;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Facades\Storage;
use Webkul\Attribute\Models\Attribute;
use Webkul\Product\Models\Product;
use Webkul\Product\Models\ProductAttributeValue;

class CatalogProductResource extends JsonResource
{
    public function __construct(
        Product $resource,
        protected readonly string $locale,
        protected readonly string $currency,
        protected readonly bool $includeVariants = false,
    ) {
        parent::__construct($resource);
    }

    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        $parent = $this->resource;
        $name = $this->attributeValue($parent, 'name', locale: $this->locale)?->text_value;
        $categories = $parent->categories
            ->sortBy(fn ($category) => sprintf(
                "%s\0%010d",
                $category->translate($this->locale)?->name ?? '',
                $category->id,
            ))
            ->values()
            ->map(fn ($category) => (new CatalogCategoryResource($category, $this->locale))->resolve($request));

        $data = [
            'id' => $parent->id,
            'type' => $parent->type,
            'sku' => $parent->sku,
            'slug' => $this->attributeValue($parent, 'url_key', locale: $this->locale)?->text_value,
            'name' => $name,
            'description' => $this->plainText(
                $this->attributeValue($parent, 'description', locale: $this->locale)?->text_value,
            ),
            'image' => $this->image($parent, $name),
            'categories' => $categories->all(),
            'variant_count' => (int) $parent->getAttribute('variant_count'),
            'available_variant_count' => (int) $parent->getAttribute('available_variant_count'),
            'starting_price' => $parent->getAttribute('catalog_starting_price') === null ? null : [
                'unit_price' => (int) $parent->getAttribute('catalog_starting_price'),
                'currency' => $this->currency,
            ],
        ];

        if (! $this->includeVariants) {
            return $data;
        }

        return array_merge($data, [
            'option_groups' => $this->optionGroups(),
            'variant_index' => (object) $this->variantIndex(),
            'variants' => $parent->variants
                ->map(fn (Product $variant) => $this->variant($variant))
                ->all(),
        ]);
    }

    /** @return array<int, array<string, mixed>> */
    protected function optionGroups(): array
    {
        return $this->resource->super_attributes
            ->sortBy('id')
            ->map(function (Attribute $attribute) {
                $usedOptions = $this->resource->variants
                    ->mapWithKeys(function (Product $variant) use ($attribute) {
                        $optionId = $this->attributeValue($variant, $attribute->code)?->integer_value;

                        return $optionId === null ? [] : [(int) $optionId => $variant->id];
                    });

                return [
                    'attribute_id' => $attribute->id,
                    'code' => $attribute->code,
                    'label' => $attribute->admin_name,
                    'options' => $attribute->options
                        ->whereIn('id', $usedOptions->keys())
                        ->sortBy('sort_order')
                        ->values()
                        ->map(fn ($option) => [
                            'option_id' => $option->id,
                            'label' => $option->translate($this->locale)?->label ?? $option->admin_name,
                            'variant_ids' => $this->resource->variants
                                ->filter(fn (Product $variant) => (int) $this->attributeValue(
                                    $variant,
                                    $attribute->code,
                                )?->integer_value === $option->id)
                                ->pluck('id')
                                ->values()
                                ->all(),
                        ])
                        ->all(),
                ];
            })
            ->values()
            ->all();
    }

    /** @return array<int, array<string, int>> */
    protected function variantIndex(): array
    {
        return $this->resource->variants
            ->mapWithKeys(fn (Product $variant) => [
                $variant->id => $this->resource->super_attributes
                    ->mapWithKeys(fn (Attribute $attribute) => [
                        $attribute->code => (int) $this->attributeValue($variant, $attribute->code)?->integer_value,
                    ])
                    ->all(),
            ])
            ->all();
    }

    /** @return array<string, mixed> */
    private function variant(Product $variant): array
    {
        /** @var ProductConfig $config */
        $config = $variant->getRelation('b2b_config');
        $name = $this->attributeValue($variant, 'name', locale: $this->locale)?->text_value;
        $tiers = $variant->customer_group_prices
            ->map(fn ($tier) => [
                'min_quantity' => $tier->qty,
                'unit_price' => (int) $tier->value,
                'currency' => $this->currency,
            ]);

        if (! $tiers->contains(fn (array $tier) => $tier['min_quantity'] === $config->moq)) {
            $basePrice = (int) $variant->getAttribute('b2b_base_price');

            if ($basePrice <= 0) {
                $tiers = collect();
            } else {
                $tiers->prepend([
                    'min_quantity' => $config->moq,
                    'unit_price' => $basePrice,
                    'currency' => $this->currency,
                ]);
            }
        }

        return [
            'id' => $variant->id,
            'sku' => $variant->sku,
            'name' => $name,
            'option_values' => $this->resource->super_attributes
                ->map(function (Attribute $attribute) use ($variant) {
                    $optionId = (int) $this->attributeValue($variant, $attribute->code)?->integer_value;
                    $option = $attribute->options->firstWhere('id', $optionId);

                    return [
                        'attribute_id' => $attribute->id,
                        'attribute_code' => $attribute->code,
                        'option_id' => $optionId,
                        'option_label' => $option?->translate($this->locale)?->label ?? $option?->admin_name,
                    ];
                })
                ->values()
                ->all(),
            'image' => $this->image($variant, $name),
            'unit' => $config->unit,
            'moq' => $config->moq,
            'quantity_step' => $config->quantity_step,
            'contact_from_quantity' => $config->contact_from_quantity,
            'availability' => [
                'is_available' => (bool) $variant->getAttribute('b2b_is_available'),
            ],
            'tier_prices' => $tiers->values()->all(),
        ];
    }

    /** @return array{url: string, alt: string|null}|null */
    protected function image(Product $product, ?string $alt): ?array
    {
        $image = $product->images->first(fn ($image) => Storage::exists($image->path));

        return $image ? [
            'url' => Storage::url($image->path),
            'alt' => $alt,
        ] : null;
    }

    protected function attributeValue(
        Product $product,
        string $code,
        ?string $locale = null,
        ?string $channel = null,
    ): ?ProductAttributeValue {
        return $product->attribute_values->first(
            fn (ProductAttributeValue $value) => $value->attribute->code === $code
                && $value->locale === $locale
                && $value->channel === $channel,
        );
    }

    protected function plainText(?string $html): ?string
    {
        if ($html === null || trim($html) === '') {
            return null;
        }

        $text = html_entity_decode(strip_tags($html), ENT_QUOTES | ENT_HTML5, 'UTF-8');
        $text = trim((string) preg_replace('/\s+/u', ' ', $text));

        return $text === '' ? null : $text;
    }
}
