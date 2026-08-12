<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>New Contact Submission</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333333;
            background-color: #f9f9f9;
            padding: 20px;
        }
        .container {
            max-width: 600px;
            margin: 0 auto;
            background: #ffffff;
            border: 1px solid #e0e0e0;
            border-radius: 8px;
            padding: 20px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.05);
        }
        .header {
            border-bottom: 2px solid #0056b3;
            padding-bottom: 10px;
            margin-bottom: 20px;
        }
        .header h2 {
            margin: 0;
            color: #0056b3;
        }
        .field {
            margin-bottom: 15px;
        }
        .label {
            font-weight: bold;
            color: #555555;
            text-transform: capitalize;
        }
        .value {
            margin-top: 5px;
            padding: 10px;
            background: #f1f1f1;
            border-radius: 4px;
            white-space: pre-wrap;
        }
        .metadata {
            margin-top: 30px;
            border-top: 1px solid #e0e0e0;
            padding-top: 10px;
            font-size: 0.85em;
            color: #777777;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h2>New Contact Submission</h2>
        </div>

        <h3>Submission Details</h3>
        @if(!empty($submission->form_data))
            @foreach($submission->form_data as $key => $value)
                @if(!empty($value))
                    <div class="field">
                        <div class="label">{{ str_replace('-', ' ', $key) }}:</div>
                        <div class="value">{{ $value }}</div>
                    </div>
                @endif
            @endforeach
        @else
            <p>No form data submitted.</p>
        @endif

        <div class="metadata">
            <p><strong>Submitted From Path:</strong> {{ $submission->path ?? 'N/A' }}</p>
            <p><strong>IP Address:</strong> {{ $submission->ip ?? 'N/A' }}</p>
            <p><strong>User Agent:</strong> {{ $submission->user_agent ?? 'N/A' }}</p>
            <p><strong>Time:</strong> {{ $submission->created_at ? $submission->created_at->toDayDateTimeString() : now()->toDayDateTimeString() }}</p>
        </div>
    </div>
</body>
</html>
