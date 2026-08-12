<?php

$dbPath = __DIR__ . '/../backend/database/database.sqlite';
if (!file_exists($dbPath)) {
    echo "Database file not found at: $dbPath\n";
    exit(1);
}

try {
    $db = new PDO('sqlite:' . $dbPath);
    $db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

    $query = "SELECT name, tbl_name, sql FROM sqlite_master WHERE type='index'";
    $stmt = $db->query($query);
    $indexes = $stmt->fetchAll(PDO::FETCH_ASSOC);

    echo "Found " . count($indexes) . " indexes:\n";
    foreach ($indexes as $index) {
        echo "----------------------------------------\n";
        echo "Index Name: " . $index['name'] . "\n";
        echo "Table Name: " . $index['tbl_name'] . "\n";
        echo "SQL: " . $index['sql'] . "\n";
    }

    echo "\n========================================\n";
    echo "EXPLAIN QUERY PLAN for posts query:\n";
    $explainQuery = "EXPLAIN QUERY PLAN SELECT * FROM posts WHERE status = 'published' ORDER BY published_at DESC LIMIT 10";
    $explainStmt = $db->query($explainQuery);
    $explanations = $explainStmt->fetchAll(PDO::FETCH_ASSOC);
    foreach ($explanations as $exp) {
        print_r($exp);
    }


} catch (PDOException $e) {
    echo "Database error: " . $e->getMessage() . "\n";
    exit(1);
}
