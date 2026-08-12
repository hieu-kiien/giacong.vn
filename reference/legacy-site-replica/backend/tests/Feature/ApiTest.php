<?php

namespace Tests\Feature;

use App\Models\Product;
use App\Models\Service;
use App\Models\Submission;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\RateLimiter;
use Tests\TestCase;

class ApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_contact_submission_saves_to_database(): void
    {
        Log::spy();

        $response = $this->postJson('/api/contact', [
            'text-508' => 'John Doe',
            'tel-991' => '0900000000',
            'email-81' => 'john@example.com',
            'textarea-859' => 'Hello there',
            'path' => '/some-page',
        ]);

        $response->assertStatus(201);
        $response->assertJson([
            'success' => true,
            'message' => 'Your submission has been received successfully.',
        ]);

        $this->assertDatabaseHas('submissions', [
            'path' => '/some-page',
        ]);

        $submission = Submission::first();
        $this->assertEquals('John Doe', $submission->form_data['text-508']);
        $this->assertEquals('john@example.com', $submission->form_data['email-81']);
        $this->assertEquals('Hello there', $submission->form_data['textarea-859']);
    }

    public function test_contact_submission_rejects_missing_required_fields(): void
    {
        $this->postJson('/api/contact', [])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['payload']);
    }

    public function test_contact_submission_empty_payload_rejection(): void
    {
        $response = $this->postJson('/api/contact', []);
        $response->assertStatus(422);
        $response->assertJsonValidationErrors(['payload']);
    }

    public function test_contact_submission_wpcf7_form_1_validation(): void
    {
        // Try Form 1 with missing required field text-508
        $this->postJson('/api/contact', [
            'tel-991' => '0900000000',
            'textarea-859' => 'Hello',
        ])->assertStatus(422)->assertJsonValidationErrors(['text-508']);

        // Correct Form 1 submission
        $this->postJson('/api/contact', [
            'text-508' => 'John Doe',
            'tel-991' => '0900000000',
            'textarea-859' => 'Hello',
        ])->assertStatus(201);
    }

    public function test_contact_submission_wpcf7_form_2_validation(): void
    {
        // Try Form 2 with missing required fields
        $this->postJson('/api/contact', [
            'text-34' => 'John',
        ])->assertStatus(422)->assertJsonValidationErrors(['tel-471']);

        // Correct Form 2 submission
        $this->postJson('/api/contact', [
            'text-34' => 'John Doe',
            'tel-471' => '0900000000',
        ])->assertStatus(201);
    }

    public function test_contact_submission_comment_form_validation(): void
    {
        // Try Comment Form with missing email
        $this->postJson('/api/contact', [
            'comment' => 'This is a comment',
            'author' => 'Author Name',
        ])->assertStatus(422)->assertJsonValidationErrors(['email']);

        // Correct Comment Form submission
        $this->postJson('/api/contact', [
            'comment' => 'This is a comment',
            'author' => 'Author Name',
            'email' => 'author@example.com',
            'url' => 'http://example.com',
        ])->assertStatus(201);
    }

    public function test_contact_route_rate_limiting(): void
    {
        // Clear rate limiter first
        RateLimiter::clear('contact:'.request()->ip());

        // Hit the contact route 5 times (which is the limit we set per minute)
        for ($i = 0; $i < 5; $i++) {
            $response = $this->postJson('/api/contact', [
                'text-34' => 'John Doe',
                'tel-471' => '0900000000',
            ]);
            $response->assertStatus(201);
        }

        // The 6th hit should fail with 429 Too Many Requests
        $response = $this->postJson('/api/contact', [
            'text-34' => 'John Doe',
            'tel-471' => '0900000000',
        ]);
        $response->assertStatus(429);
    }

    public function test_search_returns_unified_results(): void
    {
        // Create test records (clean db before or refresh, tests use SQLite memory/file)
        Product::query()->delete();
        Service::query()->delete();

        Product::create([
            'name' => 'Sữa Bột Đậu Nành Đặc Biệt',
            'image' => 'images/image.png',
            'price' => '1000',
            'href' => 'http://example.com/product',
        ]);

        Service::create([
            'text' => 'Gia công sữa đậu nành chất lượng',
            'href' => 'http://example.com/service',
        ]);

        $response = $this->getJson('/api/search?s=đậu nành');

        $response->assertStatus(200);
        $data = $response->json();

        $this->assertCount(2, $data);
        $response->assertJsonStructure([
            '*' => [
                'type',
                'name',
                'image',
                'price',
                'href',
            ],
        ]);

        $this->assertEquals('product', $data[0]['type']);
        $this->assertEquals('Sữa Bột Đậu Nành Đặc Biệt', $data[0]['name']);

        $this->assertEquals('service', $data[1]['type']);
        $this->assertEquals('Gia công sữa đậu nành chất lượng', $data[1]['name']);
    }

    public function test_search_handles_wildcards_null_fields_and_giacong_urls(): void
    {
        Product::query()->delete();
        Service::query()->delete();

        $appUrl = config('app.url');

        Product::create([
            'name' => 'Sữa Bột Đậu % Nành _ Gia Công',
            'image' => $appUrl.'/images/test.png',
            'price' => null,
            'href' => $appUrl.'/product/sua-bot',
        ]);

        Service::create([
            'text' => 'Gia công dịch vụ % _ test',
            'href' => $appUrl.'/dich-vu',
        ]);

        // 1. Test search with wildcards
        $response = $this->getJson('/api/search?s=%');
        $response->assertStatus(200);
        $data = $response->json();
        $this->assertCount(2, $data);

        // Searching for something that doesn't exist but has wildcards, e.g. "Sữa_Bột"
        $response2 = $this->getJson('/api/search?s=Sữa_Bột');
        $response2->assertStatus(200);
        $this->assertCount(0, $response2->json());

        // 2. Test relative URLs conversion and null fields handling
        $response4 = $this->getJson('/api/search?s=Gia Công');
        $response4->assertStatus(200);
        $data4 = $response4->json();

        $this->assertEquals('/images/test.png', $data4[0]['image']);
        $this->assertNull($data4[0]['price']);
        $this->assertEquals('/product/sua-bot', $data4[0]['href']);

        $this->assertEquals('/dich-vu', $data4[1]['href']);
    }

    public function test_seeder_idempotency(): void
    {
        // Clear tables first
        Product::query()->delete();
        Service::query()->delete();

        // Run seeders first time
        $this->artisan('db:seed');
        $productCount1 = Product::count();
        $serviceCount1 = Service::count();

        // Run seeders second time
        $this->artisan('db:seed');
        $productCount2 = Product::count();
        $serviceCount2 = Service::count();

        // Count should remain the same
        $this->assertEquals($productCount1, $productCount2);
        $this->assertEquals($serviceCount1, $serviceCount2);
        $this->assertGreaterThan(0, $productCount1);
        $this->assertGreaterThan(0, $serviceCount1);
    }
}
