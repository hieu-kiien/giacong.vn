<?php

use App\Http\Controllers\ContactController;
use App\Http\Controllers\PageController;
use App\Http\Controllers\PostController;
use App\Http\Controllers\SearchController;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

Route::get('/user', function (Request $request) {
    return $request->user();
})->middleware('auth:sanctum');

Route::get('/login', function () {
    return response()->json(['message' => 'Unauthenticated.'], 401);
})->name('login');

Route::post('/contact', [ContactController::class, 'submit'])->middleware('throttle:contact');
Route::get('/search', [SearchController::class, 'search']);

Route::get('/pages/{slug}', [PageController::class, 'show']);
Route::get('/posts', [PostController::class, 'index']);
Route::get('/posts/{slug}', [PostController::class, 'show']);

// Configurations API
use App\Http\Controllers\ConfigurationController;
Route::get('/configurations', [ConfigurationController::class, 'index']);
Route::get('/configurations/{key}', [ConfigurationController::class, 'show']);
Route::post('/configurations/{key}/draft', [ConfigurationController::class, 'saveDraft'])->middleware('auth:sanctum');
Route::post('/configurations/{key}/publish', [ConfigurationController::class, 'publish'])->middleware('auth:sanctum');
