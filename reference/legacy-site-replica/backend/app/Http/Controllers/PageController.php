<?php

namespace App\Http\Controllers;

use App\Models\Page;
use Illuminate\Http\Request;

class PageController extends Controller
{
    public function show($slug)
    {
        $page = Page::select(['id', 'title', 'slug', 'content', 'description', 'body_class', 'is_active'])
            ->where('slug', $slug)
            ->where('is_active', true)
            ->first();

        if (!$page) {
            return response()->json(['message' => 'Page not found'], 404);
        }

        return response()->json($page);
    }
}
