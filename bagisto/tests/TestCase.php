<?php

namespace Tests;

use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Foundation\Testing\TestCase as BaseTestCase;
use Illuminate\Support\Facades\DB;
use Tests\Support\TestDatabaseGuard;

abstract class TestCase extends BaseTestCase
{
    use DatabaseTransactions;

    /**
     * Validate the live connection before DatabaseTransactions can begin.
     *
     * @return array<class-string, int>
     */
    protected function setUpTraits()
    {
        TestDatabaseGuard::assertSafe(
            environment: app()->environment(),
            connection: DB::getDefaultConnection(),
            databaseUrl: config('database.connections.mysql.url'),
            databaseName: DB::connection()->getDatabaseName(),
        );

        return parent::setUpTraits();
    }
}
