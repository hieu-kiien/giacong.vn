<?php

namespace Acme\B2b\Repositories;

use Acme\B2b\Contracts\ProductConfig as ProductConfigContract;
use Webkul\Core\Eloquent\Repository;

class ProductConfigRepository extends Repository
{
    /**
     * Specify the model contract.
     */
    public function model(): string
    {
        return ProductConfigContract::class;
    }
}
