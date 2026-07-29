<?php

use Acme\B2b\Http\Controllers\CatalogCartController;
use Acme\B2b\Http\Controllers\CatalogCategoryController;
use Acme\B2b\Http\Controllers\CatalogProductController;
use Acme\B2b\Http\Controllers\CmsServiceController;
use Acme\B2b\Http\Middleware\NoStoreCatalogResponses;
use Acme\B2b\Http\Middleware\ThrottleCatalogRequests;
use Illuminate\Support\Facades\Route;

Route::prefix('api/b2b/catalog')
    ->middleware(['api', NoStoreCatalogResponses::class, ThrottleCatalogRequests::class.':b2b-catalog'])
    ->group(function () {
        Route::get('categories', [CatalogCategoryController::class, 'index'])
            ->name('b2b.api.catalog.categories.index');
        Route::get('products', [CatalogProductController::class, 'index'])
            ->name('b2b.api.catalog.products.index');
        Route::get('products/{slug}', [CatalogProductController::class, 'show'])
            ->name('b2b.api.catalog.products.show');
        Route::post('resolve-cart', [CatalogCartController::class, 'resolve'])
            ->name('b2b.api.catalog.resolve-cart');
    });

Route::prefix('api/b2b/services')
    ->middleware(['api', NoStoreCatalogResponses::class, ThrottleCatalogRequests::class.':b2b-catalog'])
    ->group(function () {
        Route::get('{slug}', [CmsServiceController::class, 'show'])
            ->name('b2b.api.services.show');
    });
