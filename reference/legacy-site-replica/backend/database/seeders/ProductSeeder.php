<?php

namespace Database\Seeders;

use App\Models\Product;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\File;

class ProductSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $jsonPath = database_path('data/products.json');
        if (! File::exists($jsonPath)) {
            $jsonPath = base_path('../data/products.json');
        }
        if (File::exists($jsonPath)) {
            $json = File::get($jsonPath);
            $products = json_decode($json, true);
            foreach ($products as $product) {
                Product::updateOrCreate(
                    ['href' => $product['href'] ?? null],
                    [
                        'name' => $product['name'] ?? null,
                        'image' => $product['image'] ?? null,
                        'price' => $product['price'] ?? null,
                    ]
                );
            }
        }
    }
}
