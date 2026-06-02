import { Pipe, PipeTransform } from '@angular/core';

@Pipe({ name: 'currencyDop', standalone: true, pure: true })
export class CurrencyDopPipe implements PipeTransform {
    private readonly formatter = new Intl.NumberFormat('es-DO', {
        style: 'currency',
        currency: 'DOP',
        minimumFractionDigits: 2,
    });

    transform(value: number | null | undefined): string {
        if (value == null) return 'RD$ 0.00';
        return this.formatter.format(value);
    }
}
