# Handoff Report — Milestone 5 Explorer

## 1. Observation

### CORS Configuration
In `backend/config/cors.php` (lines 22-29), the origin configuration was observed as:
```php
    'allowed_origins' => [
        'http://localhost:3000',
        'http://localhost:3001',
        'http://localhost:3002',
        'http://127.0.0.1:3000',
        'http://127.0.0.1:3001',
        'http://127.0.0.1:3002',
    ],
```

### Contact Form Controller and Model
In `backend/app/Http/Controllers/ContactController.php` (lines 56-67), the controller stores contact form inputs by dynamically constructing a model:
```php
        $formData = $request->except(['path', 'ip', 'user_agent']);

        $path = $request->input('path') ?? $request->header('referer');
        $ip = $request->ip();
        $userAgent = $request->userAgent();

        $submission = Submission::create([
            'form_data' => $formData,
            'path' => $path,
            'ip' => $ip,
            'user_agent' => $userAgent,
        ]);
```
In `backend/app/Models/Submission.php` (lines 7-14), the model casts the form data:
```php
class Submission extends Model
{
    protected $guarded = [];

    protected $casts = [
        'form_data' => 'array',
    ];
}
```

### Email Templates and Mail Dispatch
The Laravel project is configured with `MAIL_MAILER=log` in `backend/.env` (line 50).
Our PowerShell code search for `Mail::` or `Mailable` keywords within `backend/app` returned:
- Admin command references (`BootstrapAdmin.php`)
- User verification references (`User.php`)
- Column naming references (`SubmissionsTable.php`)
No active mail-sending or templating calls exist within the contact submission workflow (neither in `ContactController` nor in observers/providers). Email "sending" is simulated via the following log command in `ContactController.php` (lines 69-75):
```php
        Log::info('New form submission captured:', [
            'id' => $submission->id,
            'form_data' => $formData,
            'path' => $path,
            'ip' => $ip,
            'user_agent' => $userAgent,
        ]);
```

### Playwright E2E Test Execution
Running `npx playwright test tests/e2e/cors-smtp.spec.ts` completed with:
```
20 passed (40.9s)
```
The test `'DB Persistence: SQLite handles missing email and nullable parameters safely'` passed successfully.

---

## 2. Logic Chain

1. **CORS Requirement**: To restrict `allowed_origins` to strictly localhost ports `3000, 3001, 3002`, the entries mapping to IP address `http://127.0.0.1:*` should be removed from `backend/config/cors.php`.
2. **Submission Storage**: Submissions are saved by serializing the HTTP request parameters (except routing/client metadata) into an array ($formData) and storing it in a single database column (`form_data`).
3. **Database Nullability**: The `submissions` table migration (`2026_07_14_064952_create_submissions_table.php`) defines `form_data` as a nullable text column:
   ```php
   $table->text('form_data')->nullable();
   ```
   This schema doesn't create individual columns for input fields, avoiding SQL schema errors when fields (like email) are missing.
4. **Why SQLite Test Might Fail Under Other Conditions**:
   - **Validation Rules**: If the `'email-81'` validation rule in `ContactController.php` did not specify `'nullable'` (e.g., `'email-81' => ['email']`), passing an empty string or null from the client would fail format validation, resulting in a 422 HTTP code instead of 210.
   - **Schema Constraints**: If individual fields were parsed into separate database table columns (e.g. `$table->string('email');`) and NOT defined as `.nullable()`, SQLite would fail with a `NOT NULL constraint failed: submissions.email` integrity exception during save.
   - **Mail Dispatch Exception**: If actual mailers were dispatched, a null/empty recipient address would crash the mailer service with an invalid address exception unless pre-screened.

---

## 3. Caveats

- Assumes SQLite is the only database engine in use for tests. In other databases like MySQL or PostgreSQL, strict typing and constraints might behave differently depending on config parameters (e.g., `strict` mode).
- Proposing removal of `http://127.0.0.1` origins is based on a strict reading of "restrict allowed_origins to localhost ports (3000, 3001, 3002)". Some local developers might prefer `127.0.0.1` compatibility, but the requirements ask to restrict strictly to localhost.

---

## 4. Conclusion

- **CORS**: Modify `backend/config/cors.php` to remove IP-based localhost origins, leaving only `localhost`. A patch file `cors.patch` has been written to the agent's folder.
- **Database/Controller safety**: The current controller implements `'email-81' => ['nullable', 'email']` and stores it inside a JSON casted array to a nullable database column. This guarantees complete SQLite/db-persistence safety when email is missing or empty. No modifications are needed to the existing database schema or models because it is already implemented correctly to pass the tests.

---

## 5. Verification Method

To verify the proposed CORS patch:
1. Apply the patch file:
   ```powershell
   git apply .agents/explorer_m5/cors.patch
   ```
2. Verify that Playwright tests still pass:
   ```powershell
   npx playwright test tests/e2e/cors-smtp.spec.ts
   ```
3. To invalidate this: if an origin request is made from `http://127.0.0.1:3000`, the server should block it or omit the `Access-Control-Allow-Origin` header for that origin (which is expected under strict localhost rules).
