<?php

use Acme\B2b\Http\Requests\ListCatalogProductsRequest;
use Illuminate\Translation\ArrayLoader;
use Illuminate\Translation\Translator;
use Illuminate\Validation\Factory as ValidationFactory;
use Illuminate\Validation\Validator;

/**
 * The sort keys CatalogService::paginateProducts() can map to a column. A key
 * outside this set would reach an undefined array index, so the request must
 * never let one through.
 */
const B2B_CATALOG_SORT_KEYS = [
    'name',
    'id',
    'starting_price',
    'variant_count',
    'available_variant_count',
];

function b2bCatalogListValidator(array $query): Validator
{
    $factory = new ValidationFactory(new Translator(new ArrayLoader, 'en'));

    return $factory->make($query, (new ListCatalogProductsRequest)->rules());
}

it('keeps every allowlisted sort key and direction in the validated filters', function (string $sort, string $direction) {
    $validator = b2bCatalogListValidator([
        'sort' => $sort,
        'direction' => $direction,
    ]);

    expect($validator->fails())->toBeFalse()
        ->and($validator->validated())->toMatchArray([
            'sort' => $sort,
            'direction' => $direction,
        ]);
})->with(B2B_CATALOG_SORT_KEYS)->with(['asc', 'desc']);

it('omits sort and direction when the client sends neither so the service defaults apply', function () {
    $validator = b2bCatalogListValidator(['per_page' => 12]);

    expect($validator->fails())->toBeFalse()
        ->and($validator->validated())->toBe(['per_page' => 12]);
});

it('keeps sort and direction alongside the existing catalog filters', function () {
    $validator = b2bCatalogListValidator([
        'q' => 'cacao',
        'category' => 'nguyen-lieu',
        'page' => 2,
        'per_page' => 24,
        'sort' => 'starting_price',
        'direction' => 'desc',
    ]);

    expect($validator->fails())->toBeFalse()
        ->and($validator->validated())->toBe([
            'q' => 'cacao',
            'category' => 'nguyen-lieu',
            'page' => 2,
            'per_page' => 24,
            'sort' => 'starting_price',
            'direction' => 'desc',
        ]);
});

it('rejects a sort key outside the allowlist', function (string $sort) {
    $validator = b2bCatalogListValidator(['sort' => $sort]);

    expect($validator->fails())->toBeTrue()
        ->and($validator->errors()->keys())->toContain('sort')
        ->and($validator->errors()->keys())->not->toContain('direction');
})->with([
    'unrelated column' => 'password',
    'admin column' => 'two_factor_secret',
    'empty string' => '',
    'uppercase key' => 'NAME',
    'sql injection attempt' => 'name; DROP TABLE products',
    'sql expression' => '(SELECT 1)',
]);

it('never lets the client name the raw SQL column the service orders by', function (string $column) {
    expect(b2bCatalogListValidator(['sort' => $column])->fails())->toBeTrue();
})->with([
    'catalog_name',
    'catalog_starting_price',
    'products.id',
]);

it('rejects a direction outside asc and desc', function (string $direction) {
    $validator = b2bCatalogListValidator(['direction' => $direction]);

    expect($validator->fails())->toBeTrue()
        ->and($validator->errors()->keys())->toContain('direction')
        ->and($validator->errors()->keys())->not->toContain('sort');
})->with([
    'unknown word' => 'sideways',
    'empty string' => '',
    'uppercase' => 'ASC',
    'sql suffix' => 'asc; DROP TABLE products',
    'column list' => 'desc, products.sku',
]);

it('reports both fields when sort and direction are invalid together', function () {
    $validator = b2bCatalogListValidator([
        'sort' => 'password',
        'direction' => 'sideways',
    ]);

    expect($validator->fails())->toBeTrue()
        ->and($validator->errors()->keys())->toEqualCanonicalizing(['sort', 'direction']);
});
