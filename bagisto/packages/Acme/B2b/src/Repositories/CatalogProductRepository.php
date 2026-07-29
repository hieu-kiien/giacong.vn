<?php

namespace Acme\B2b\Repositories;

use Illuminate\Database\Eloquent\Builder as EloquentBuilder;
use Illuminate\Database\Query\Builder;
use Illuminate\Support\Facades\DB;
use Webkul\Product\Models\Product;
use Webkul\Product\Models\ProductAttributeValue;

class CatalogProductRepository
{
    /**
     * Native configurable parents own merchandising data while simple children
     * own price and inventory.
     *
     * @see https://github.com/bagisto/bagisto/blob/2.4/packages/Webkul/Product/src/Type/Configurable.php
     *
     * @param  array<int, int>  $visibleCategoryIds
     */
    public function publicParentQuery(
        int $channelId,
        string $channelCode,
        string $locale,
        ?int $guestCustomerGroupId,
        array $visibleCategoryIds,
        bool $backordersAllowed,
    ): EloquentBuilder {
        $query = Product::query()
            ->select('products.*')
            ->selectSub(
                ProductAttributeValue::query()
                    ->select('product_attribute_values.text_value')
                    ->join('attributes', 'attributes.id', '=', 'product_attribute_values.attribute_id')
                    ->whereColumn('product_attribute_values.product_id', 'products.id')
                    ->where('attributes.code', 'name')
                    ->where('product_attribute_values.locale', $locale)
                    ->whereNull('product_attribute_values.channel')
                    ->limit(1),
                'catalog_name',
            )
            ->where('products.type', 'configurable')
            ->whereNull('products.parent_id');

        if ($guestCustomerGroupId === null || $visibleCategoryIds === []) {
            return $query->whereRaw('1 = 0');
        }

        $validVariants = $this->validVariantIdsQuery(
            $channelId,
            $channelCode,
            $locale,
            $guestCustomerGroupId,
            true,
            $backordersAllowed,
        )->whereColumn('variants.parent_id', 'products.id');

        return $query
            ->whereHas('channels', fn (EloquentBuilder $query) => $query->whereKey($channelId))
            ->whereHas('categories', fn (EloquentBuilder $query) => $query->whereKey($visibleCategoryIds))
            ->whereHas('attribute_values', fn (EloquentBuilder $query) => $this->attributeBoolean(
                $query,
                'status',
                $channelCode,
            ))
            ->whereHas('attribute_values', function (EloquentBuilder $query) {
                $query->where('boolean_value', true)
                    ->whereNull('channel')
                    ->whereNull('locale')
                    ->whereHas('attribute', fn (EloquentBuilder $query) => $query->where('code', 'visible_individually'));
            })
            ->whereHas('attribute_values', fn (EloquentBuilder $query) => $this->localizedText(
                $query,
                'name',
                $locale,
            ))
            ->whereHas('attribute_values', fn (EloquentBuilder $query) => $this->localizedText(
                $query,
                'url_key',
                $locale,
            ))
            ->whereExists($validVariants)
            ->with([
                'attribute_values' => function ($query) {
                    $query->whereHas('attribute', fn (EloquentBuilder $query) => $query->whereIn('code', [
                        'sku', 'name', 'url_key', 'description', 'status', 'visible_individually',
                    ]))->with('attribute');
                },
                'categories' => fn ($query) => $query
                    ->whereKey($visibleCategoryIds)
                    ->with('translations'),
                'images',
            ]);
    }

    public function validVariantIdsQuery(
        int $channelId,
        string $channelCode,
        string $locale,
        int $guestCustomerGroupId,
        bool $availableOnly,
        bool $backordersAllowed,
    ): Builder {
        $query = DB::table('products as variants')
            ->join('b2b_product_configs as configs', 'configs.product_id', '=', 'variants.id')
            ->select('variants.id')
            ->where('variants.type', 'simple')
            ->whereNotNull('variants.parent_id')
            ->where('configs.moq', '>', 0)
            ->where('configs.quantity_step', '>', 0)
            ->whereNotNull('configs.contact_from_quantity')
            ->whereColumn('configs.contact_from_quantity', '>', 'configs.moq')
            ->whereExists(function (Builder $query) use ($channelId) {
                $query->selectRaw('1')
                    ->from('product_channels as variant_channels')
                    ->whereColumn('variant_channels.product_id', 'variants.id')
                    ->where('variant_channels.channel_id', $channelId);
            })
            ->whereExists(function (Builder $query) use ($channelCode) {
                $query->selectRaw('1')
                    ->from('product_attribute_values as variant_status')
                    ->join('attributes as status_attribute', 'status_attribute.id', '=', 'variant_status.attribute_id')
                    ->whereColumn('variant_status.product_id', 'variants.id')
                    ->where('status_attribute.code', 'status')
                    ->where('variant_status.boolean_value', true)
                    ->where('variant_status.channel', $channelCode)
                    ->whereNull('variant_status.locale');
            })
            ->whereExists(function (Builder $query) use ($locale) {
                $query->selectRaw('1')
                    ->from('product_attribute_values as variant_name')
                    ->join('attributes as name_attribute', 'name_attribute.id', '=', 'variant_name.attribute_id')
                    ->whereColumn('variant_name.product_id', 'variants.id')
                    ->where('name_attribute.code', 'name')
                    ->whereNotNull('variant_name.text_value')
                    ->where('variant_name.locale', $locale)
                    ->whereNull('variant_name.channel');
            })
            ->whereRaw('(SELECT COUNT(DISTINCT option_value.attribute_id)
                FROM product_attribute_values AS option_value
                INNER JOIN attributes AS option_attribute
                    ON option_attribute.id = option_value.attribute_id
                INNER JOIN product_super_attributes AS super_attribute
                    ON super_attribute.attribute_id = option_value.attribute_id
                    AND super_attribute.product_id = variants.parent_id
                INNER JOIN attribute_options AS selected_option
                    ON selected_option.id = option_value.integer_value
                    AND selected_option.attribute_id = option_value.attribute_id
                WHERE option_value.product_id = variants.id
                    AND option_attribute.type = ?
                    AND option_attribute.is_configurable = 1
                    AND option_value.integer_value IS NOT NULL) =
                (SELECT COUNT(*)
                FROM product_super_attributes AS required_super_attribute
                WHERE required_super_attribute.product_id = variants.parent_id)', ['select'])
            ->whereExists(function (Builder $query) {
                $query->selectRaw('1')
                    ->from('product_super_attributes as required_super_attribute')
                    ->whereColumn('required_super_attribute.product_id', 'variants.parent_id');
            })
            ->whereNotExists(function (Builder $query) use ($guestCustomerGroupId) {
                $query->selectRaw('1')
                    ->from('product_customer_group_prices as invalid_tier')
                    ->whereColumn('invalid_tier.product_id', 'variants.id')
                    ->where('invalid_tier.customer_group_id', $guestCustomerGroupId)
                    ->where('invalid_tier.value_type', 'fixed')
                    ->where(function (Builder $query) {
                        $query->whereColumn('invalid_tier.qty', '<', 'configs.moq')
                            ->orWhereColumn('invalid_tier.qty', '>=', 'configs.contact_from_quantity')
                            ->orWhere('invalid_tier.value', '<=', 0)
                            ->orWhereRaw('invalid_tier.value <> FLOOR(invalid_tier.value)');
                    });
            })
            ->distinct();

        if (! $availableOnly || $backordersAllowed) {
            return $query;
        }

        return $query->where(function (Builder $query) use ($channelId) {
            $query->whereNotExists(function (Builder $query) {
                $query->selectRaw('1')
                    ->from('product_attribute_values as managed_stock')
                    ->join('attributes as manage_stock_attribute', 'manage_stock_attribute.id', '=', 'managed_stock.attribute_id')
                    ->whereColumn('managed_stock.product_id', 'variants.id')
                    ->where('manage_stock_attribute.code', 'manage_stock')
                    ->where('managed_stock.boolean_value', true);
            })->orWhereRaw('((SELECT COALESCE(SUM(product_inventory.qty), 0)
                FROM product_inventories AS product_inventory
                INNER JOIN channel_inventory_sources AS allowed_inventory
                    ON allowed_inventory.inventory_source_id = product_inventory.inventory_source_id
                INNER JOIN inventory_sources AS active_inventory_source
                    ON active_inventory_source.id = product_inventory.inventory_source_id
                    AND active_inventory_source.status = 1
                WHERE product_inventory.product_id = variants.id
                    AND allowed_inventory.channel_id = ?)
                - COALESCE((SELECT ordered_inventory.qty
                    FROM product_ordered_inventories AS ordered_inventory
                    WHERE ordered_inventory.product_id = variants.id
                        AND ordered_inventory.channel_id = ?
                    LIMIT 1), 0)) >= configs.moq', [$channelId, $channelId]);
        });
    }

    private function attributeBoolean(EloquentBuilder $query, string $code, string $channel): void
    {
        $query->where('boolean_value', true)
            ->where('channel', $channel)
            ->whereNull('locale')
            ->whereHas('attribute', fn (EloquentBuilder $query) => $query->where('code', $code));
    }

    private function localizedText(EloquentBuilder $query, string $code, string $locale): void
    {
        $query->whereNotNull('text_value')
            ->where('locale', $locale)
            ->whereNull('channel')
            ->whereHas('attribute', fn (EloquentBuilder $query) => $query->where('code', $code));
    }
}
