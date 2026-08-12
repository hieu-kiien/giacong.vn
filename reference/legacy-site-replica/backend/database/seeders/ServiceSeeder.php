<?php

namespace Database\Seeders;

use App\Models\Service;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\File;

class ServiceSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $jsonPath = database_path('data/services.json');
        if (! File::exists($jsonPath)) {
            $jsonPath = base_path('../data/services.json');
        }
        if (File::exists($jsonPath)) {
            $json = File::get($jsonPath);
            $services = json_decode($json, true);
            foreach ($services as $service) {
                Service::updateOrCreate(
                    ['href' => $service['href'] ?? null],
                    [
                        'text' => $service['text'] ?? null,
                    ]
                );
            }
        }
    }
}
