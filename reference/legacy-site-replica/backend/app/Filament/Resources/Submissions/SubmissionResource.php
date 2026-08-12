<?php

namespace App\Filament\Resources\Submissions;

use App\Filament\Resources\Submissions\Pages\CreateSubmission;
use App\Filament\Resources\Submissions\Pages\EditSubmission;
use App\Filament\Resources\Submissions\Pages\ListSubmissions;
use App\Filament\Resources\Submissions\Schemas\SubmissionForm;
use App\Filament\Resources\Submissions\Tables\SubmissionsTable;
use App\Models\Submission;
use BackedEnum;
use Filament\Resources\Resource;
use Filament\Schemas\Schema;
use Filament\Support\Icons\Heroicon;
use Filament\Tables\Table;

class SubmissionResource extends Resource
{
    protected static ?string $model = Submission::class;

    protected static string|BackedEnum|null $navigationIcon = Heroicon::OutlinedRectangleStack;

    protected static ?string $recordTitleAttribute = 'id';

    public static function form(Schema $schema): Schema
    {
        return SubmissionForm::configure($schema);
    }

    public static function table(Table $table): Table
    {
        return SubmissionsTable::configure($table);
    }

    public static function getRelations(): array
    {
        return [
            //
        ];
    }

    public static function canCreate(): bool
    {
        return false;
    }

    public static function canEdit($record): bool
    {
        return false;
    }

    public static function canDelete($record): bool
    {
        return false;
    }

    public static function getPages(): array
    {
        return [
            'index' => ListSubmissions::route('/'),
            'create' => CreateSubmission::route('/create'),
            'edit' => EditSubmission::route('/{record}/edit'),
        ];
    }
}
