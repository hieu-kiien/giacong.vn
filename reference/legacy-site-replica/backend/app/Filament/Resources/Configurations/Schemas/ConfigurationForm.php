<?php

namespace App\Filament\Resources\Configurations\Schemas;

use Filament\Forms\Components\TextInput;
use Filament\Forms\Components\Textarea;
use Filament\Forms\Components\Toggle;
use Filament\Schemas\Schema;

class ConfigurationForm
{
    public static function configure(Schema $schema): Schema
    {
        return $schema
            ->components([
                TextInput::make('key')
                    ->required()
                    ->disabledOn('edit')
                    ->unique(ignoreRecord: true),
                Toggle::make('is_published')
                    ->label('Is Published'),
                Textarea::make('draft_value')
                    ->label('Draft Value (JSON)')
                    ->rows(8)
                    ->nullable()
                    ->helperText('Enter configuration details in JSON format.'),
                Textarea::make('published_value')
                    ->label('Published Value (JSON)')
                    ->rows(8)
                    ->nullable()
                    ->helperText('Currently active settings on the live website. Update via publish action or edit directly if needed.'),
            ]);
    }
}
