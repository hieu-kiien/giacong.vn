<?php

namespace Acme\B2b\Services;

use Acme\B2b\Models\ProductConfig;
use Illuminate\Support\Facades\Validator;

class ProductConfigPolicy
{
    /**
     * @param  array<string, mixed>  $input
     * @return array{unit: string, moq: int, quantity_step: int, contact_from_quantity: int|null}
     */
    public function validate(array $input): array
    {
        $validated = Validator::validate($input, [
            'unit' => ['required', 'string', 'max:32'],
            'moq' => ['required', 'integer', 'min:1'],
            'quantity_step' => ['required', 'integer', 'min:1'],
            'contact_from_quantity' => ['nullable', 'integer', 'gt:moq'],
        ]);

        return [
            'unit' => trim($validated['unit']),
            'moq' => (int) $validated['moq'],
            'quantity_step' => (int) $validated['quantity_step'],
            'contact_from_quantity' => isset($validated['contact_from_quantity'])
                ? (int) $validated['contact_from_quantity']
                : null,
        ];
    }

    /**
     * Validate and persist the B2B policy for a product or variant.
     *
     * @param  array<string, mixed>  $input
     */
    public function save(int $productId, array $input): ProductConfig
    {
        $validated = $this->validate($input);

        return ProductConfig::query()->updateOrCreate(
            ['product_id' => $productId],
            [
                ...$validated,
            ]
        );
    }
}
