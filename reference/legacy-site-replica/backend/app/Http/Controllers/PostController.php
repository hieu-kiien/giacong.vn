<?php

namespace App\Http\Controllers;

use App\Models\Post;
use Illuminate\Http\Request;

class PostController extends Controller
{
    public function index()
    {
        $posts = Post::where('status', 'published')
            ->orderBy('published_at', 'desc')
            ->paginate(10);

        return response()->json($posts);
    }

    public function show($slug)
    {
        $post = Post::where('slug', $slug)
            ->where('status', 'published')
            ->first();

        if (!$post) {
            return response()->json(['message' => 'Post not found'], 404);
        }

        return response()->json($post);
    }
}
