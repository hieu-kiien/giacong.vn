<?php

namespace Acme\B2b\Http\Controllers;

use Acme\B2b\Http\Requests\ResolveCatalogCartRequest;
use Acme\B2b\Services\CatalogCartResolver;
use Illuminate\Http\JsonResponse;

class CatalogCartController
{
    public function __construct(private readonly CatalogCartResolver $catalogCartResolver) {}

    public function resolve(ResolveCatalogCartRequest $request): JsonResponse
    {
        return response()->json([
            'cart' => $this->catalogCartResolver->resolve($request->validated('lines')),
        ]);
    }
}
