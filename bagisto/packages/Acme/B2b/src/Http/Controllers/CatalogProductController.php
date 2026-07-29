<?php

namespace Acme\B2b\Http\Controllers;

use Acme\B2b\Http\Requests\ListCatalogProductsRequest;
use Acme\B2b\Http\Resources\CatalogProductResource;
use Acme\B2b\Services\CatalogService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CatalogProductController
{
    public function __construct(private readonly CatalogService $catalogService) {}

    public function index(ListCatalogProductsRequest $request): JsonResponse
    {
        $paginator = $this->catalogService->paginateProducts($request->validated());

        return response()->json([
            'data' => $paginator->getCollection()
                ->map(fn ($product) => (new CatalogProductResource(
                    $product,
                    $this->catalogService->locale(),
                    $this->catalogService->currency(),
                ))->resolve($request))
                ->all(),
            'links' => [
                'first' => $paginator->url(1),
                'last' => $paginator->url($paginator->lastPage()),
                'prev' => $paginator->previousPageUrl(),
                'next' => $paginator->nextPageUrl(),
            ],
            'meta' => [
                'current_page' => $paginator->currentPage(),
                'from' => $paginator->firstItem(),
                'last_page' => $paginator->lastPage(),
                'path' => $paginator->path(),
                'per_page' => $paginator->perPage(),
                'to' => $paginator->lastItem(),
                'total' => $paginator->total(),
                'channel' => $this->catalogService->channelCode(),
                'locale' => $this->catalogService->locale(),
                'currency' => $this->catalogService->currency(),
                'contract_version' => 2,
            ],
        ]);
    }

    public function show(Request $request, string $slug): JsonResponse
    {
        $product = $this->catalogService->findProduct($slug);

        if ($product === null) {
            return response()->json(['message' => 'Product not found.'], 404);
        }

        return response()->json([
            'data' => (new CatalogProductResource(
                $product,
                $this->catalogService->locale(),
                $this->catalogService->currency(),
                true,
            ))->resolve($request),
            'meta' => [
                'channel' => $this->catalogService->channelCode(),
                'locale' => $this->catalogService->locale(),
                'currency' => $this->catalogService->currency(),
                'contract_version' => 2,
            ],
        ]);
    }
}
