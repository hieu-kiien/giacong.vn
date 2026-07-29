<?php

use Illuminate\Support\Facades\Route;

use function Pest\Laravel\get;
use function Pest\Laravel\post;

it('redirects every Bagisto shop page to the native admin', function (string $path) {
    get($path)->assertRedirect('/admin');
})->with([
    '/',
    '/search',
    '/page/about-us',
    '/duong-dan-storefront-khong-ton-tai',
]);

it('rejects Bagisto shop mutations because the storefront is disabled', function () {
    post('/subscription', [
        'email' => 'shop@example.test',
    ])->assertNotFound();
});

it('keeps the native Bagisto admin available', function () {
    expect(Route::has('admin.session.create'))->toBeTrue();
});
