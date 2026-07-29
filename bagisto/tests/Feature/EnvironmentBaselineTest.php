<?php

use Illuminate\Support\Facades\DB;
use Tests\Support\TestDatabaseGuard;

it('uses the isolated test database', function () {
    expect(app()->environment())->toBe('testing')
        ->and(config('database.default'))->toBe('mysql')
        ->and(config('database.connections.mysql.url'))->toBeNull()
        ->and(config('database.connections.mysql.database'))->toBe('bagisto_testing')
        ->and(DB::connection()->getDatabaseName())->toBe('bagisto_testing');
});

it('refuses a database URL override before transactions begin', function () {
    expect(fn () => TestDatabaseGuard::assertSafe(
        environment: 'testing',
        connection: 'mysql',
        databaseUrl: 'mysql://user:password@example.test/production',
        databaseName: 'bagisto_testing',
    ))->toThrow(RuntimeException::class, 'DB_URL');
});

it('uses the Vietnamese MVP application defaults', function () {
    expect(config('app.locale'))->toBe('vi')
        ->and(config('app.currency'))->toBe('VND')
        ->and(config('cors.allowed_origins'))->toBe([
            'http://127.0.0.1:3000',
            'http://localhost:3000',
        ]);
});
