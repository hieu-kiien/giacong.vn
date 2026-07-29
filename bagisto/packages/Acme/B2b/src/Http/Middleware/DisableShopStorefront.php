<?php

namespace Acme\B2b\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class DisableShopStorefront
{
    public function handle(Request $request, Closure $next): Response
    {
        $route = $request->route();
        $routeName = $route?->getName();
        $actionName = $route?->getActionName();
        $isShopRoute = (is_string($routeName) && str_starts_with($routeName, 'shop.'))
            || (is_string($actionName) && str_starts_with($actionName, 'Webkul\\Shop\\'));

        if (! $isShopRoute) {
            return $next($request);
        }

        if (! $request->isMethod('GET') && ! $request->isMethod('HEAD')) {
            return response('', 404);
        }

        return redirect('/'.trim(config('app.admin_url', 'admin'), '/'));
    }
}
