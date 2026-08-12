<?php

namespace App\Http\Controllers;

use App\Models\Configuration;
use Illuminate\Http\Request;

class ConfigurationController extends Controller
{
    /**
     * Get all configurations.
     */
    public function index()
    {
        $configs = Configuration::all();
        return response()->json([
            'success' => true,
            'data' => $configs
        ]);
    }

    /**
     * Get configuration by key.
     */
    public function show($key)
    {
        $config = Configuration::where('key', $key)->first();

        if (!$config) {
            // Seed a default config if empty to make it editable
            $config = Configuration::create([
                'key' => $key,
                'draft_value' => null,
                'published_value' => null,
                'is_published' => false
            ]);
        }

        return response()->json([
            'success' => true,
            'data' => $config
        ]);
    }

    /**
     * Save draft configuration.
     */
    public function saveDraft(Request $request, $key)
    {
        $config = Configuration::updateOrCreate(
            ['key' => $key],
            [
                'draft_value' => $request->input('value'),
                'is_published' => false
            ]
        );

        $config->refresh();

        return response()->json([
            'success' => true,
            'message' => "Draft saved successfully for config '{$key}'.",
            'data' => $config
        ]);
    }

    /**
     * Publish draft configuration.
     */
    public function publish($key)
    {
        $config = Configuration::where('key', $key)->first();

        if (!$config) {
            return response()->json([
                'success' => false,
                'message' => 'Configuration not found.'
            ], 404);
        }

        $config->published_value = $config->draft_value;
        $config->is_published = true;
        $config->save();

        return response()->json([
            'success' => true,
            'message' => "Configuration '{$key}' published successfully.",
            'data' => $config
        ]);
    }
}
