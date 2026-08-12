<?php

namespace Tests\Feature;

use App\Models\User;
use App\Models\Configuration;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;
use Laravel\Sanctum\Sanctum;

class ConfigurationTest extends TestCase
{
    use RefreshDatabase;

    /**
     * Test admin:bootstrap command fails when configuration is missing.
     */
    public function test_bootstrap_fails_if_env_is_missing(): void
    {
        // Set config to null/empty
        config(['admin.email' => null]);
        config(['admin.password' => null]);

        $this->artisan('admin:bootstrap')
            ->assertFailed()
            ->expectsOutputToContain('Admin bootstrap failed');
    }

    /**
     * Test admin:bootstrap command fails when placeholders are present.
     */
    public function test_bootstrap_fails_if_env_contains_placeholders(): void
    {
        config(['admin.email' => 'ADMIN_EMAIL']);
        config(['admin.password' => 'ADMIN_PASSWORD']);

        $this->artisan('admin:bootstrap')
            ->assertFailed()
            ->expectsOutputToContain('Admin bootstrap failed');
    }

    /**
     * Test admin:bootstrap command succeeds when configured.
     */
    public function test_bootstrap_succeeds_and_creates_user(): void
    {
        config(['admin.email' => 'testadmin@example.com']);
        config(['admin.password' => 'SecureP@ss123']);

        $this->artisan('admin:bootstrap')
            ->assertSuccessful()
            ->expectsOutputToContain('Admin user has been successfully bootstrapped');

        $this->assertDatabaseHas('users', [
            'email' => 'testadmin@example.com',
            'name' => 'Admin'
        ]);

        $user = User::where('email', 'testadmin@example.com')->first();
        $this->assertTrue(Hash::check('SecureP@ss123', $user->password));
    }

    /**
     * Test configuration API index and show endpoints.
     */
    public function test_configuration_api_show_seeds_default_row(): void
    {
        $response = $this->getJson('/api/configurations/navigation');

        $response->assertStatus(200)
            ->assertJsonStructure([
                'success',
                'data' => ['id', 'key', 'draft_value', 'published_value', 'is_published']
            ])
            ->assertJson([
                'success' => true,
                'data' => [
                    'key' => 'navigation',
                    'draft_value' => null,
                    'published_value' => null,
                    'is_published' => false
                ]
            ]);

        $this->assertDatabaseHas('configurations', [
            'key' => 'navigation'
        ]);
    }

    /**
     * Test configuration draft saving and publishing workflow.
     */
    public function test_configuration_draft_and_publish_workflow(): void
    {
        $user = User::factory()->create();
        Sanctum::actingAs($user);

        // 1. Save draft
        $draftData = ['logo' => 'custom-logo.png', 'links' => []];
        $response = $this->postJson('/api/configurations/popup/draft', [
            'value' => $draftData
        ]);

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'data' => [
                    'key' => 'popup',
                    'draft_value' => $draftData,
                    'published_value' => null,
                    'is_published' => false
                ]
            ]);

        $this->assertDatabaseHas('configurations', [
            'key' => 'popup',
            'is_published' => false
        ]);

        // 2. Publish
        $response = $this->postJson('/api/configurations/popup/publish');

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'data' => [
                    'key' => 'popup',
                    'draft_value' => $draftData,
                    'published_value' => $draftData,
                    'is_published' => true
                ]
            ]);

        $this->assertDatabaseHas('configurations', [
            'key' => 'popup',
            'is_published' => true
        ]);
    }

    public function test_configuration_draft_and_publish_workflow_unauthorized_for_anonymous(): void
    {
        // 1. Save draft anonymously
        $draftData = ['logo' => 'custom-logo.png', 'links' => []];
        $response = $this->postJson('/api/configurations/popup/draft', [
            'value' => $draftData
        ]);
        $response->assertStatus(401);

        // 2. Publish anonymously
        $response = $this->postJson('/api/configurations/popup/publish');
        $response->assertStatus(401);
    }
}
