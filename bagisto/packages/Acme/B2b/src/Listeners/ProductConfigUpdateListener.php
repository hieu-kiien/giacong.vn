<?php

namespace Acme\B2b\Listeners;

use Acme\B2b\Services\ProductConfigPolicy;
use Illuminate\Validation\ValidationException;

class ProductConfigUpdateListener
{
    public function __construct(private readonly ProductConfigPolicy $productConfigPolicy) {}

    public function beforeUpdate(int $productId): void
    {
        if (! request()->has('b2b')) {
            return;
        }

        try {
            $this->productConfigPolicy->validate(request()->input('b2b'));
        } catch (ValidationException $exception) {
            $messages = [];

            foreach ($exception->errors() as $field => $errors) {
                $messages["b2b[{$field}]"] = $errors;
            }

            throw ValidationException::withMessages($messages);
        }
    }

    public function afterUpdate(object $product): void
    {
        if (! request()->has('b2b')) {
            return;
        }

        $this->productConfigPolicy->save($product->id, request()->input('b2b'));
    }
}
