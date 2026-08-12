<?php
// Paths
$dbPath = __DIR__ . '/../../backend/database/database.sqlite';
$pagesDir = __DIR__ . '/../../frontend/src/data/pages';
$metadataPath = __DIR__ . '/../../frontend/src/data/metadata.json';
$crawlReportPath = __DIR__ . '/../../scratch/inventory_and_crawl_report.json';

echo "=== GIACONG REPLICA DATA INTEGRITY AUDIT ===\n\n";

// 1. Connect to SQLite DB
if (!file_exists($dbPath)) {
    die("Error: SQLite database not found at $dbPath\n");
}
$db = new PDO("sqlite:$dbPath");
$db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

// Get pages from DB
$dbPages = [];
$stmt = $db->query("SELECT slug, title, is_active FROM pages");
while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
    $dbPages[$row['slug']] = $row;
}
echo "Pages in SQLite Database: " . count($dbPages) . "\n";

// 2. Scan EJS files recursively
function getEjsSlugs($dir, $baseDir = null) {
    if ($baseDir === null) {
        $baseDir = $dir;
    }
    $slugs = [];
    if (!file_exists($dir)) return $slugs;
    $files = scandir($dir);
    foreach ($files as $file) {
        if ($file === '.' || $file === '..') continue;
        $path = $dir . '/' . $file;
        if (is_dir($path)) {
            $slugs = array_merge($slugs, getEjsSlugs($path, $baseDir));
        } else if (pathinfo($path, PATHINFO_EXTENSION) === 'ejs') {
            // Get relative path from baseDir without .ejs extension
            $relPath = substr($path, strlen($baseDir) + 1, -4);
            // Replace backslashes with slashes
            $relPath = str_replace('\\', '/', $relPath);
            // Decode URI components
            $slug = urldecode($relPath);
            $slugs[$slug] = $path;
        }
    }
    return $slugs;
}

$ejsSlugs = getEjsSlugs($pagesDir);
echo "Local EJS files in frontend/src/data/pages: " . count($ejsSlugs) . "\n";

// 3. Read metadata.json
$metadataSlugs = [];
if (file_exists($metadataPath)) {
    $metadata = json_decode(file_get_contents($metadataPath), true);
    if (isset($metadata['pages'])) {
        foreach ($metadata['pages'] as $p) {
            $slug = urldecode($p['slug']);
            $metadataSlugs[$slug] = $p;
        }
    }
}
echo "Pages in metadata.json: " . count($metadataSlugs) . "\n";

// 4. Read crawl report
$crawlSlugs = [];
$crawlFailures = [];
if (file_exists($crawlReportPath)) {
    $crawlReport = json_decode(file_get_contents($crawlReportPath), true);
    if (isset($crawlReport['targetFailures'])) {
        foreach ($crawlReport['targetFailures'] as $f) {
            $slug = ltrim($f['path'], '/');
            $crawlFailures[$slug] = $f['reason'];
        }
    }
}

// 5. Cross-reference
$inDbOnly = array_diff(array_keys($dbPages), array_keys($ejsSlugs));
$inEjsOnly = array_diff(array_keys($ejsSlugs), array_keys($dbPages));
$inMetadataOnly = array_diff(array_keys($metadataSlugs), array_keys($dbPages));

echo "\n=== CROSS-REFERENCE SUMMARY ===\n";
echo "1. Slugs present in DB but NOT in EJS files: " . count($inDbOnly) . "\n";
if (count($inDbOnly) > 0) {
    echo "   Sample (first 10):\n";
    $i = 0;
    foreach ($inDbOnly as $s) {
        if ($i++ >= 10) break;
        echo "     - $s (is_active: " . ($dbPages[$s]['is_active'] ? 'true' : 'false') . ", title: " . $dbPages[$s]['title'] . ")\n";
    }
}

echo "2. Slugs present in EJS files but NOT in DB: " . count($inEjsOnly) . "\n";
if (count($inEjsOnly) > 0) {
    echo "   Sample (first 10):\n";
    $i = 0;
    foreach ($inEjsOnly as $s) {
        if ($i++ >= 10) break;
        echo "     - $s (file path: " . basename($ejsSlugs[$s]) . ")\n";
    }
}

echo "3. Slugs present in metadata.json but NOT in DB: " . count($inMetadataOnly) . "\n";
if (count($inMetadataOnly) > 0) {
    echo "   Sample (first 10):\n";
    $i = 0;
    foreach ($inMetadataOnly as $s) {
        if ($i++ >= 10) break;
        echo "     - $s\n";
    }
}

// 6. Detailed mismatch check: Let's see if EJS files have exact DB equivalents
echo "\n=== IN-DEPTH ANALYSIS ===\n";

// Let's check targetFailures from crawl report
echo "\nCrawl Report Failures:\n";
foreach ($crawlFailures as $slug => $reason) {
    $inDb = isset($dbPages[$slug]) ? "Yes" : "No";
    $inEjs = isset($ejsSlugs[$slug]) ? "Yes" : "No";
    echo "  - Slug: /$slug | Reason: $reason | In DB: $inDb | In EJS: $inEjs\n";
}

// Let's inspect some of the EJS files with special characters or nested categories
echo "\nNested category EJS files:\n";
$nested = [];
foreach (array_keys($ejsSlugs) as $slug) {
    if (strpos($slug, '/') !== false) {
        $nested[] = $slug;
    }
}
echo "Found " . count($nested) . " nested/category/page EJS files.\n";
if (count($nested) > 0) {
    echo "  Sample (first 10):\n";
    $i = 0;
    foreach ($nested as $s) {
        if ($i++ >= 10) break;
        $inDb = isset($dbPages[$s]) ? "Yes" : "No";
        echo "    - $s | In DB: $inDb\n";
    }
}
