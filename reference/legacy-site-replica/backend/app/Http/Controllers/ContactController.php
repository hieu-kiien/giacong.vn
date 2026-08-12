<?php

namespace App\Http\Controllers;

use App\Models\Submission;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\ValidationException;
use Illuminate\Support\Facades\Mail;
use App\Mail\ContactSubmission;

class ContactController extends Controller
{
    public function submit(Request $request)
    {
        $data = $request->except(['path', 'ip', 'user_agent']);

        // Reject empty payload
        if (empty($data)) {
            $validator = Validator::make([], []);
            $validator->errors()->add('payload', 'The contact submission payload cannot be empty.');
            throw new ValidationException($validator);
        }

        // Determine form family and apply specific validation rules
        $rules = [];

        if ($request->hasAny(['comment', 'author'])) {
            // Comment Form family from form_specs.json
            $rules = [
                'comment' => ['required', 'string', 'max:5000'],
                'author' => ['required', 'string', 'max:255'],
                'email' => ['required', 'email', 'max:255'],
                'url' => ['nullable', 'url', 'max:255'],
                'wp-comment-cookies-consent' => ['nullable', 'string', 'max:10'],
                'comment_parent' => ['nullable', 'integer'],
            ];
        } elseif ($request->hasAny(['text-508', 'tel-991', 'textarea-859'])) {
            // WPCF7 Form 1: false_text-508_tel-991_email-81_textarea-859
            $rules = [
                'text-508' => ['required', 'string', 'max:255'],
                'tel-991' => ['required', 'string', 'max:50'],
                'email-81' => ['nullable', 'email', 'max:255'],
                'textarea-859' => ['required', 'string', 'max:5000'],
            ];
        } else {
            // Default to WPCF7 Form 2: false_text-34_tel-471
            $rules = [
                'text-34' => ['required', 'string', 'max:255'],
                'tel-471' => ['required', 'string', 'max:50'],
                'email-81' => ['nullable', 'email', 'max:255'],
            ];
        }

        Validator::make($request->all(), $rules)->validate();

        $formData = $request->except(['path', 'ip', 'user_agent']);

        $path = $request->input('path') ?? $request->header('referer');
        $path = $path !== null ? strip_tags($path) : null;
        $ip = $request->ip();
        $userAgent = $request->userAgent();

        $submission = Submission::create([
            'form_data' => $formData,
            'path' => $path,
            'ip' => $ip,
            'user_agent' => $userAgent,
        ]);

        Log::info('New form submission captured:', [
            'id' => $submission->id,
            'form_data' => $formData,
            'path' => $path,
            'ip' => $ip,
            'user_agent' => $userAgent,
        ]);

        try {
            Mail::to(config('mail.from.address'))->send(new ContactSubmission($submission));
        } catch (\Throwable $e) {
            Log::error('Failed to send contact submission email:', [
                'error' => $e->getMessage(),
                'submission_id' => $submission->id,
            ]);
        }

        return response()->json([
            'success' => true,
            'message' => 'Your submission has been received successfully.',
            'data' => $submission,
        ], 201);
    }
}
