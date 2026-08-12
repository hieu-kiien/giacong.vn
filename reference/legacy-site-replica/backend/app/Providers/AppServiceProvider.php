<?php

namespace App\Providers;

use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        try {
            $connection = DB::connection();
            if ($connection->getDriverName() === 'sqlite') {
                $connection->getPdo()->sqliteCreateFunction('LOWER', function ($value) {
                    return $value !== null ? mb_strtolower($value, 'UTF-8') : null;
                });
            }
        } catch (\Exception $e) {
            // Ignore if database is not connected during CLI setup
        }

        RateLimiter::for('contact', function (Request $request) {
            $key = $request->ip() . '|' . $request->userAgent() . '|' . $request->header('referer') . '|' . $request->input('text-508') . '|' . $request->input('text-34');
            return Limit::perMinute(5)->by($key);
        });
    }
}
