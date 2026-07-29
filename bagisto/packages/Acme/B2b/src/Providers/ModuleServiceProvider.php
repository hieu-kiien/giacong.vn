<?php

namespace Acme\B2b\Providers;

use Acme\B2b\Models\ProductConfig;
use Webkul\Core\Providers\CoreModuleServiceProvider;

class ModuleServiceProvider extends CoreModuleServiceProvider
{
    /**
     * Models registered with Concord.
     *
     * @var array<int, class-string>
     */
    protected $models = [
        ProductConfig::class,
    ];
}
