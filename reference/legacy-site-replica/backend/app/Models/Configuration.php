<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Attributes\Fillable;

#[Fillable(['key', 'draft_value', 'published_value', 'is_published'])]
class Configuration extends Model
{
    use HasFactory;

    /**
     * Get the attributes that should be cast.
     */
    protected function casts(): array
    {
        return [
            'draft_value' => 'array',
            'published_value' => 'array',
            'is_published' => 'boolean',
        ];
    }
}
