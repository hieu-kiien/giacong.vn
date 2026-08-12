<?php
require 'vendor/autoload.php';
$app = require_once 'bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

echo "=== TABLES AND ROWS ===\n";
foreach (['products', 'services', 'configurations', 'pages', 'posts', 'submissions'] as $t) {
    echo "$t: " . DB::table($t)->count() . " rows\n";
}

echo "\n=== INDEXES ===\n";
$indexes = DB::select("SELECT name, tbl_name, sql FROM sqlite_master WHERE type='index'");
foreach ($indexes as $ind) {
    if (strpos($ind->name, 'sqlite_autoindex') === 0) continue;
    echo "Index: {$ind->name} on Table: {$ind->tbl_name} | SQL: {$ind->sql}\n";
}

echo "\n=== CONFIGURATIONS DETAIL ===\n";
$configs = DB::table('configurations')->get();
if ($configs->isEmpty()) {
    echo "No configurations found in database.\n";
} else {
    foreach ($configs as $c) {
        echo "Key: {$c->key} | Published: " . ($c->is_published ? 'Yes' : 'No') . "\n";
    }
}
