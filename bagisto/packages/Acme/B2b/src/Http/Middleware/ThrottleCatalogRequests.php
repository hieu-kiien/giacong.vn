<?php

namespace Acme\B2b\Http\Middleware;

use Closure;
use Illuminate\Http\Exceptions\ThrottleRequestsException;
use Illuminate\Http\JsonResponse;
use Illuminate\Routing\Middleware\ThrottleRequests;

class ThrottleCatalogRequests extends ThrottleRequests
{
    public function handle($request, Closure $next, $maxAttempts = 60, $decayMinutes = 1, $prefix = '')
    {
        try {
            if (func_num_args() === 3) {
                return parent::handle($request, $next, $maxAttempts);
            }

            return parent::handle($request, $next, $maxAttempts, $decayMinutes, $prefix);
        } catch (ThrottleRequestsException $exception) {
            $response = new JsonResponse([
                'message' => 'Too Many Attempts.',
            ], 429, $exception->getHeaders());
            $response->headers->set('Cache-Control', 'no-store');

            return $response;
        }
    }
}
