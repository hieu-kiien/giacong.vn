<?php

return [
    /*
    |--------------------------------------------------------------------------
    | Admin Bootstrap Credentials Contract
    |--------------------------------------------------------------------------
    |
    | These credentials are used by the admin:bootstrap command to seed or
    | update the admin user. They must be set in the .env file at runtime.
    |
    */
    'email' => env('ADMIN_EMAIL'),
    'password' => env('ADMIN_PASSWORD'),
];
