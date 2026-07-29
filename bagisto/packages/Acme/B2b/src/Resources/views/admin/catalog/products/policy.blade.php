@php
    $b2b = old('b2b', [
        'unit' => $b2bProductConfig?->unit ?? '',
        'moq' => $b2bProductConfig?->moq ?? 1,
        'quantity_step' => $b2bProductConfig?->quantity_step ?? 1,
        'contact_from_quantity' => $b2bProductConfig?->contact_from_quantity,
    ]);
@endphp

<div class="mt-5 rounded-lg border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
    <div class="mb-4">
        <h2 class="text-base font-semibold text-gray-800 dark:text-white">
            Chính sách B2B
        </h2>

        <p class="mt-1 text-sm text-gray-500 dark:text-gray-300">
            Thiết lập đơn vị bán, số lượng đặt tối thiểu và bước tăng số lượng cho sản phẩm này.
        </p>
    </div>

    <div class="grid gap-4 md:grid-cols-2">
        <x-admin::form.control-group>
            <x-admin::form.control-group.label class="required">
                Đơn vị bán
            </x-admin::form.control-group.label>

            <x-admin::form.control-group.control
                type="text"
                id="b2b_unit"
                name="b2b[unit]"
                :value="$b2b['unit']"
                rules="required"
                label="Đơn vị bán"
            />

            <x-admin::form.control-group.error control-name="b2b[unit]" />
        </x-admin::form.control-group>

        <x-admin::form.control-group>
            <x-admin::form.control-group.label class="required">
                MOQ
            </x-admin::form.control-group.label>

            <x-admin::form.control-group.control
                type="number"
                id="b2b_moq"
                name="b2b[moq]"
                :value="$b2b['moq']"
                min="1"
                step="1"
                rules="required|min_value:1"
                label="MOQ"
            />

            <x-admin::form.control-group.error control-name="b2b[moq]" />
        </x-admin::form.control-group>

        <x-admin::form.control-group>
            <x-admin::form.control-group.label class="required">
                Bước số lượng
            </x-admin::form.control-group.label>

            <x-admin::form.control-group.control
                type="number"
                id="b2b_quantity_step"
                name="b2b[quantity_step]"
                :value="$b2b['quantity_step']"
                min="1"
                step="1"
                rules="required|min_value:1"
                label="Bước số lượng"
            />

            <x-admin::form.control-group.error control-name="b2b[quantity_step]" />
        </x-admin::form.control-group>

        <x-admin::form.control-group>
            <x-admin::form.control-group.label>
                Chuyển sang liên hệ từ số lượng
            </x-admin::form.control-group.label>

            <x-admin::form.control-group.control
                type="number"
                id="b2b_contact_from_quantity"
                name="b2b[contact_from_quantity]"
                :value="$b2b['contact_from_quantity']"
                min="1"
                step="1"
                rules="min_value:1"
                label="Chuyển sang liên hệ từ số lượng"
            />

            <x-admin::form.control-group.error control-name="b2b[contact_from_quantity]" />
        </x-admin::form.control-group>
    </div>
</div>
