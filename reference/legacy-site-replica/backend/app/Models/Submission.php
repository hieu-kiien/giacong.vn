<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Submission extends Model
{
    protected $guarded = [];

    protected $casts = [
        'form_data' => 'array',
    ];
}
