<?php

namespace Acme\B2b\Console\Commands;

use Acme\B2b\Services\DemoCatalogSeeder;
use Illuminate\Console\Command;
use Throwable;

class SeedDemoCatalog extends Command
{
    /**
     * The name and signature of the console command.
     */
    protected $signature = 'b2b:catalog:seed-demo';

    /**
     * The console command description.
     */
    protected $description = 'Create or refresh the package-owned B2B demo catalog';

    public function handle(DemoCatalogSeeder $seeder): int
    {
        if ($this->laravel->environment('production')) {
            $this->error('Demo catalog seeding is disabled in production.');

            return self::FAILURE;
        }

        try {
            $result = $seeder->seed();
        } catch (Throwable $exception) {
            $this->error($exception->getMessage());

            return self::FAILURE;
        }

        $this->info(sprintf(
            'Seeded %d categories, %d parent products and %d variants for channel %s (%s, %s).',
            $result['categories'],
            $result['parents'],
            $result['variants'],
            $result['channel'],
            $result['locale'],
            $result['currency'],
        ));

        return self::SUCCESS;
    }
}
