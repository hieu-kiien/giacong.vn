<?php

namespace App\Filament\Resources\Submissions\Schemas;

use Filament\Forms\Components\KeyValue;
use Filament\Forms\Components\Textarea;
use Filament\Forms\Components\TextInput;
use Filament\Schemas\Schema;

class SubmissionForm
{
    public static function configure(Schema $schema): Schema
    {
        return $schema
            ->components([
                KeyValue::make('form_data')
                    ->columnSpanFull()
                    ->addable(false)
                    ->deletable(false)
                    ->editableKeys(false)
                    ->editableValues(false),
                TextInput::make('path')
                    ->disabled(),
                TextInput::make('ip')
                    ->disabled(),
                Textarea::make('user_agent')
                    ->columnSpanFull()
                    ->disabled(),
            ]);
    }
}
