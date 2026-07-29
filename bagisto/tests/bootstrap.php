<?php

putenv('APP_ENV=testing');
putenv('DB_CONNECTION=mysql');
putenv('DB_DATABASE=bagisto_testing');
putenv('DB_URL');

$_ENV['APP_ENV'] = $_SERVER['APP_ENV'] = 'testing';
$_ENV['DB_CONNECTION'] = $_SERVER['DB_CONNECTION'] = 'mysql';
$_ENV['DB_DATABASE'] = $_SERVER['DB_DATABASE'] = 'bagisto_testing';

unset($_ENV['DB_URL'], $_SERVER['DB_URL']);

require dirname(__DIR__).'/vendor/autoload.php';
