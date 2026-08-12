<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->index('name');
        });

        Schema::table('services', function (Blueprint $table) {
            $table->index('text');
        });

        Schema::table('posts', function (Blueprint $table) {
            $table->index('status');
            $table->index('published_at');
        });

        Schema::table('pages', function (Blueprint $table) {
            $table->index('is_active');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->dropIndex(['name']);
        });

        Schema::table('services', function (Blueprint $table) {
            $table->dropIndex(['text']);
        });

        Schema::table('posts', function (Blueprint $table) {
            $table->dropIndex(['status']);
            $table->dropIndex(['published_at']);
        });

        Schema::table('pages', function (Blueprint $table) {
            $table->dropIndex(['is_active']);
        });
    }
};
