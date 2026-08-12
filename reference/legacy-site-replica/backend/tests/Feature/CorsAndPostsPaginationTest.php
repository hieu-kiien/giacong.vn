<?php

namespace Tests\Feature;

use App\Models\Post;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class CorsAndPostsPaginationTest extends TestCase
{
    use RefreshDatabase;

    public function test_cors_allowed_origins(): void
    {
        $allowedOrigins = [
            'http://localhost:3000',
            'http://localhost:3001',
            'http://localhost:3002',
        ];

        foreach ($allowedOrigins as $origin) {
            $response = $this->json('GET', '/api/posts', [], [
                'Origin' => $origin,
            ]);
            $response->assertHeader('Access-Control-Allow-Origin', $origin);
        }

        $disallowedOrigin = 'http://localhost:4000';
        $response = $this->json('GET', '/api/posts', [], [
            'Origin' => $disallowedOrigin,
        ]);
        
        // Disallowed origin should either not have the Access-Control-Allow-Origin header
        // or it should not match the disallowed origin.
        $hasHeader = $response->headers->has('Access-Control-Allow-Origin');
        if ($hasHeader) {
            $this->assertNotEquals($disallowedOrigin, $response->headers->get('Access-Control-Allow-Origin'));
        } else {
            $this->assertFalse($hasHeader);
        }
    }

    public function test_posts_pagination_and_ordering(): void
    {
        // Create 15 posts with status 'published' but different published_at times
        for ($i = 1; $i <= 15; $i++) {
            Post::create([
                'title' => "Post {$i}",
                'slug' => "post-{$i}",
                'content' => "Content {$i}",
                'status' => 'published',
                'published_at' => now()->addMinutes($i),
            ]);
        }

        // Create 5 draft posts (should not be returned)
        for ($i = 16; $i <= 20; $i++) {
            Post::create([
                'title' => "Post {$i}",
                'slug' => "post-{$i}",
                'content' => "Content {$i}",
                'status' => 'draft',
                'published_at' => now()->addMinutes($i),
            ]);
        }

        $response = $this->getJson('/api/posts');

        $response->assertStatus(200);
        $data = $response->json();

        // Check structure of pagination
        $this->assertArrayHasKey('data', $data);
        $this->assertArrayHasKey('current_page', $data);
        $this->assertArrayHasKey('per_page', $data);
        $this->assertArrayHasKey('total', $data);

        // Check counts
        $this->assertEquals(10, count($data['data']));
        $this->assertEquals(15, $data['total']);
        $this->assertEquals(10, $data['per_page']);

        // Check ordering (should be descending by published_at, so Post 15 first)
        $this->assertEquals('Post 15', $data['data'][0]['title']);
        $this->assertEquals('Post 6', $data['data'][9]['title']);

        // Get second page
        $responsePage2 = $this->getJson('/api/posts?page=2');
        $responsePage2->assertStatus(200);
        $dataPage2 = $responsePage2->json();

        $this->assertEquals(5, count($dataPage2['data']));
        $this->assertEquals('Post 5', $dataPage2['data'][0]['title']);
        $this->assertEquals('Post 1', $dataPage2['data'][4]['title']);
    }

    public function test_database_indexes_exist(): void
    {
        // Get list of indexes on the SQLite database
        $indexes = DB::select("SELECT name, tbl_name FROM sqlite_master WHERE type='index'");
        
        $indexNames = array_map(fn($idx) => $idx->name, $indexes);
        $tableNames = array_map(fn($idx) => $idx->tbl_name, $indexes);

        // Verify products(name) index exists
        $this->assertTrue(
            in_array('products_name_index', $indexNames),
            "Index 'products_name_index' does not exist."
        );

        // Verify services(text) index exists
        $this->assertTrue(
            in_array('services_text_index', $indexNames),
            "Index 'services_text_index' does not exist."
        );

        // Verify posts(status) index exists
        $this->assertTrue(
            in_array('posts_status_index', $indexNames),
            "Index 'posts_status_index' does not exist."
        );

        // Verify posts(published_at) index exists
        $this->assertTrue(
            in_array('posts_published_at_index', $indexNames),
            "Index 'posts_published_at_index' does not exist."
        );

        // Verify pages(is_active) index exists
        $this->assertTrue(
            in_array('pages_is_active_index', $indexNames),
            "Index 'pages_is_active_index' does not exist."
        );
    }
}
