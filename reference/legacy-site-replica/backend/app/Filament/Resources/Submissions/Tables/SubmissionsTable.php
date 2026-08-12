<?php

namespace App\Filament\Resources\Submissions\Tables;

use Filament\Actions\BulkActionGroup;
use Filament\Actions\DeleteBulkAction;
use Filament\Actions\EditAction;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Table;

class SubmissionsTable
{
    public static function configure(Table $table): Table
    {
        return $table
            ->columns([
                TextColumn::make('path')
                    ->searchable(),
                TextColumn::make('form_data_summary')
                    ->label('Form Data')
                    ->state(function ($record) {
                        $data = $record->form_data;
                        if (! is_array($data)) {
                            return '';
                        }

                        $mapping = [
                            'text-508' => 'Name',
                            'tel-991' => 'Phone',
                            'email-81' => 'Email',
                            'textarea-859' => 'Message',
                            'text-34' => 'Name',
                            'tel-471' => 'Phone',
                            'comment' => 'Comment',
                            'author' => 'Author',
                            'email' => 'Email',
                            'url' => 'URL',
                        ];

                        $summary = [];
                        foreach ($data as $key => $value) {
                            if ($value === null || $value === '') {
                                continue;
                            }
                            $label = $mapping[$key] ?? $key;
                            if (is_array($value)) {
                                $valStr = json_encode($value, JSON_UNESCAPED_UNICODE);
                            } else {
                                $valStr = (string) $value;
                            }
                            $valStr = str_replace(["\r", "\n"], ' ', $valStr);
                            $truncated = mb_strimwidth($valStr, 0, 40, '...');
                            $summary[] = "{$label}: {$truncated}";
                        }

                        return implode(' | ', $summary);
                    }),
                TextColumn::make('ip')
                    ->searchable(),
                TextColumn::make('created_at')
                    ->dateTime()
                    ->sortable()
                    ->toggleable(isToggledHiddenByDefault: true),
                TextColumn::make('updated_at')
                    ->dateTime()
                    ->sortable()
                    ->toggleable(isToggledHiddenByDefault: true),
            ])
            ->filters([
                //
            ])
            ->recordActions([
                EditAction::make(),
            ])
            ->toolbarActions([
                BulkActionGroup::make([
                    DeleteBulkAction::make(),
                ]),
            ]);
    }
}
