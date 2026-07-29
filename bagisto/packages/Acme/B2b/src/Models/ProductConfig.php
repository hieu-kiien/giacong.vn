<?php

namespace Acme\B2b\Models;

use Acme\B2b\Contracts\ProductConfig as ProductConfigContract;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Webkul\Product\Models\ProductProxy;

class ProductConfig extends Model implements ProductConfigContract
{
    /**
     * The table associated with the model.
     *
     * @var string
     */
    protected $table = 'b2b_product_configs';

    /**
     * The attributes that are mass assignable.
     *
     * @var array<int, string>
     */
    protected $fillable = [
        'product_id',
        'unit',
        'moq',
        'quantity_step',
        'contact_from_quantity',
    ];

    /**
     * The attributes that should be cast.
     *
     * @var array<string, string>
     */
    protected $casts = [
        'moq' => 'integer',
        'quantity_step' => 'integer',
        'contact_from_quantity' => 'integer',
    ];

    /**
     * Get the product that owns the configuration.
     */
    public function product(): BelongsTo
    {
        return $this->belongsTo(ProductProxy::modelClass());
    }
}
