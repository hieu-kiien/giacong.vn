<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('b2b_product_configs', function (Blueprint $table) {
            $table->unsignedInteger('contact_from_quantity')
                ->nullable()
                ->after('quantity_step');
        });
    }

    public function down(): void
    {
        Schema::table('b2b_product_configs', function (Blueprint $table) {
            $table->dropColumn('contact_from_quantity');
        });
    }
};
