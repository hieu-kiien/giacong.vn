<?php

namespace Acme\B2b\Providers;

use Acme\B2b\Console\Commands\SeedDemoCatalog;
use Acme\B2b\Http\Middleware\DisableShopStorefront;
use Acme\B2b\Listeners\ProductConfigUpdateListener;
use Acme\B2b\Models\ProductConfig;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Routing\Router;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;
use Webkul\Theme\ViewRenderEventManager;

class B2bServiceProvider extends ServiceProvider
{
    public function boot(Router $router): void
    {
        $router->prependMiddlewareToGroup('web', DisableShopStorefront::class);

        $this->loadMigrationsFrom(__DIR__.'/../Database/Migrations');
        $this->loadViewsFrom(__DIR__.'/../Resources/views', 'b2b');

        config()->set('b2b.demo_assets_path', '/opt/b2b-demo-assets');

        if ($this->app->runningInConsole()) {
            $this->commands([SeedDemoCatalog::class]);
        }

        RateLimiter::for('b2b-catalog', function (Request $request) {
            return Limit::perMinute(120)->by($request->ip());
        });

        Event::listen('catalog.product.update.before', [ProductConfigUpdateListener::class, 'beforeUpdate']);
        Event::listen('catalog.product.update.after', [ProductConfigUpdateListener::class, 'afterUpdate']);
        Event::listen('bagisto.admin.catalog.product.edit.form.after', function (ViewRenderEventManager $viewRenderEventManager) {
            $product = $viewRenderEventManager->getParam('product');

            if (! $product || $product->type !== 'simple') {
                return;
            }

            $viewRenderEventManager->addTemplate('b2b::admin.catalog.products.policy', [
                'b2bProductConfig' => ProductConfig::query()->where('product_id', $product->id)->first(),
            ]);
        });

        config()->set('session.http_only', true);
        config()->set('session.same_site', 'lax');

        if ($this->app->environment('production')) {
            config()->set('session.secure', true);
        }

        $this->loadRoutesFrom(__DIR__.'/../Routes/api.php');
    }
}
