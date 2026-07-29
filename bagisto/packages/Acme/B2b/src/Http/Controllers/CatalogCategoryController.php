<?php

namespace Acme\B2b\Http\Controllers;

use Acme\B2b\Http\Resources\CatalogCategoryResource;
use Acme\B2b\Services\CatalogService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CatalogCategoryController
{
    public function __construct(private readonly CatalogService $catalogService) {}

    public function index(Request $request): JsonResponse
    {
        return response()->json([
            'data' => $this->catalogService->categories()
                ->map(fn ($category) => (new CatalogCategoryResource(
                    $category,
                    $this->catalogService->locale(),
                ))->resolve($request))
                ->all(),
            'meta' => [
                'channel' => $this->catalogService->channelCode(),
                'locale' => $this->catalogService->locale(),
                'contract_version' => 2,
            ],
        ]);
    }
}
