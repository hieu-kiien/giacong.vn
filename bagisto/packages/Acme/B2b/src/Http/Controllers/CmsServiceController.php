<?php

namespace Acme\B2b\Http\Controllers;

use Acme\B2b\Services\CmsService;
use Illuminate\Http\JsonResponse;

class CmsServiceController
{
    public function __construct(private readonly CmsService $cmsService) {}

    public function show(string $slug): JsonResponse
    {
        $service = $this->cmsService->findService($slug);

        if ($service === null) {
            return response()->json(['message' => 'Service not found.'], 404);
        }

        return response()->json([
            'data' => $service,
            'meta' => [
                'channel' => $this->cmsService->channelCode(),
                'locale' => $this->cmsService->locale(),
                'contract_version' => 1,
            ],
        ]);
    }
}
