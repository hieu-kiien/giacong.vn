<?php

function makeRequest($url, $method = 'GET', $headers = []) {
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_CUSTOMREQUEST, $method);
    curl_setopt($ch, CURLOPT_HEADER, true); // We need headers!

    $headerArray = [];
    foreach ($headers as $k => $v) {
        $headerArray[] = "$k: $v";
    }
    curl_setopt($ch, CURLOPT_HTTPHEADER, $headerArray);

    $response = curl_exec($ch);
    $error = curl_error($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $headerSize = curl_getinfo($ch, CURLINFO_HEADER_SIZE);

    curl_close($ch);

    if ($response === false) {
        return [
            'success' => false,
            'error' => $error,
            'httpCode' => 0,
            'headers' => [],
            'body' => null
        ];
    }

    $headerStr = substr($response, 0, $headerSize);
    $body = substr($response, $headerSize);

    $respHeaders = [];
    foreach (explode("\r\n", $headerStr) as $line) {
        $parts = explode(':', $line, 2);
        if (count($parts) === 2) {
            $respHeaders[strtolower(trim($parts[0]))] = trim($parts[1]);
        }
    }

    return [
        'success' => true,
        'error' => null,
        'httpCode' => $httpCode,
        'headers' => $respHeaders,
        'body' => $body
    ];
}

echo "=== Running CORS and Pagination Tests ===\n";

// 1. Forbidden Origin Test
echo "\nTest 1: Request with forbidden origin header (http://example.com)\n";
$res1 = makeRequest('http://localhost:8000/api/posts', 'GET', [
    'Origin' => 'http://example.com'
]);

if (!$res1['success']) {
    echo "FAIL: Failed to connect to server: " . $res1['error'] . "\n";
    exit(1);
}

echo "HTTP Code: " . $res1['httpCode'] . "\n";
if (isset($res1['headers']['access-control-allow-origin'])) {
    echo "CORS Header 'access-control-allow-origin' found: " . $res1['headers']['access-control-allow-origin'] . "\n";
    if ($res1['headers']['access-control-allow-origin'] === 'http://example.com') {
        echo "FAIL: Access-control-allow-origin allowed http://example.com!\n";
    } else {
        echo "PASS: Access-control-allow-origin did not allow http://example.com (got: " . $res1['headers']['access-control-allow-origin'] . ")\n";
    }
} else {
    echo "PASS: Access-control-allow-origin not present in response headers (forbidden origin block)\n";
}

// 1b. Allowed Origin Test (Sanity Check)
echo "\nTest 1b: Request with allowed origin header (http://localhost:3000)\n";
$res1b = makeRequest('http://localhost:8000/api/posts', 'GET', [
    'Origin' => 'http://localhost:3000'
]);
echo "HTTP Code: " . $res1b['httpCode'] . "\n";
if (isset($res1b['headers']['access-control-allow-origin'])) {
    echo "CORS Header 'access-control-allow-origin': " . $res1b['headers']['access-control-allow-origin'] . "\n";
    if ($res1b['headers']['access-control-allow-origin'] === 'http://localhost:3000') {
        echo "PASS: Allowed origin http://localhost:3000 was accepted!\n";
    } else {
        echo "FAIL: Expected http://localhost:3000, got: " . $res1b['headers']['access-control-allow-origin'] . "\n";
    }
} else {
    echo "FAIL: CORS Header 'access-control-allow-origin' missing for allowed origin\n";
}

// 2. Pagination Response Check
echo "\nTest 2: Check GET http://localhost:8000/api/posts and response JSON structure\n";
$res2 = makeRequest('http://localhost:8000/api/posts', 'GET');
echo "HTTP Code: " . $res2['httpCode'] . "\n";
if ($res2['httpCode'] !== 200) {
    echo "FAIL: Unexpected HTTP Code " . $res2['httpCode'] . "\n";
    exit(1);
}

$data = json_decode($res2['body'], true);
if (json_last_error() !== JSON_ERROR_NONE) {
    echo "FAIL: Body is not valid JSON\n";
    exit(1);
}

$requiredKeys = ['current_page', 'data', 'total'];
$missingKeys = [];
foreach ($requiredKeys as $key) {
    if (!array_key_exists($key, $data)) {
        $missingKeys[] = $key;
    }
}

if (!empty($missingKeys)) {
    echo "FAIL: Missing keys in pagination structure: " . implode(', ', $missingKeys) . "\n";
} else {
    echo "PASS: All keys present (current_page, data, total)\n";
}

if (isset($data['data']) && is_array($data['data'])) {
    $count = count($data['data']);
    echo "Data array count: $count\n";
    if ($count <= 10) {
        echo "PASS: data length is <= 10 (count is $count)\n";
    } else {
        echo "FAIL: data length exceeds 10 (count is $count)\n";
    }
} else {
    echo "FAIL: 'data' is not an array\n";
}

echo "\nDone!\n";
