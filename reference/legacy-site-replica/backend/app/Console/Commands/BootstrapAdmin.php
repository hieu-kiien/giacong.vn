<?php

namespace App\Console\Commands;

use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;
use App\Models\User;
use Illuminate\Support\Facades\Hash;

#[Signature('admin:bootstrap')]
#[Description('Bootstrap the admin user using env variables config contract securely')]
class BootstrapAdmin extends Command
{
    /**
     * Execute the console command.
     */
    public function handle()
    {
        $email = config('admin.email');
        $password = config('admin.password');

        if (empty($email) || empty($password)) {
            $this->error('Admin bootstrap failed: ADMIN_EMAIL and/or ADMIN_PASSWORD environment variables are not set.');
            return Command::FAILURE;
        }

        // Verify configuration contract is respected and not bypassed
        if ($email === 'ADMIN_EMAIL' || $password === 'ADMIN_PASSWORD') {
            $this->error('Admin bootstrap failed: ADMIN_EMAIL and/or ADMIN_PASSWORD environment variables contain default placeholders.');
            return Command::FAILURE;
        }

        $user = User::updateOrCreate(
            ['email' => $email],
            [
                'name' => 'Admin',
                'password' => Hash::make($password),
            ]
        );

        $this->info("Admin user has been successfully bootstrapped/updated in the database.");

        return Command::SUCCESS;
    }
}
