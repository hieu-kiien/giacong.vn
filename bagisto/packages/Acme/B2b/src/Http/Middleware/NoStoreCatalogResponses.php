<?php

namespace Acme\B2b\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class NoStoreCatalogResponses
{
    public function handle(Request $request, Closure $next): Response
    {
        $response = $next($request);
        $response->headers->set('Cache-Control', 'no-store');

        return $response;
    }
}
