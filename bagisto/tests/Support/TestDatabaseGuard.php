<?php

namespace Tests\Support;

use RuntimeException;

final class TestDatabaseGuard
{
    public static function assertSafe(
        string $environment,
        string $connection,
        ?string $databaseUrl,
        ?string $databaseName,
    ): void {
        if ($environment !== 'testing') {
            throw new RuntimeException('Tests require APP_ENV=testing.');
        }

        if ($databaseUrl !== null && trim($databaseUrl) !== '') {
            throw new RuntimeException('Tests refuse a DB_URL override.');
        }

        if ($connection !== 'mysql') {
            throw new RuntimeException('Tests require the mysql connection.');
        }

        if ($databaseName !== 'bagisto_testing') {
            throw new RuntimeException('Tests require the bagisto_testing database.');
        }
    }
}
