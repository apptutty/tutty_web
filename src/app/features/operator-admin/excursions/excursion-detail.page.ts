import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
    selector: 'app-excursion-detail',
    standalone: true,
    imports: [RouterLink],
    template: `
  <div>
    <div style="display:flex;align-items:center;gap:.75rem;margin-bottom:1rem">
      <a routerLink="../" style="color:#6b7280;text-decoration:none;font-size:.875rem">← Volver</a>
      <h1 style="font-size:1.5rem;font-weight:700;color:#111827;margin:0">🧭 Detalle de Excursión</h1>
    </div>
    <div style="background:white;border:1px solid #e5e7eb;border-radius:16px;padding:2rem;text-align:center;color:#9ca3af">
      <p style="font-size:2rem;margin:0">🔍</p>
      <p style="margin:.5rem 0 0">Vista detallada en construcción</p>
    </div>
  </div>
  `,
})
export class ExcursionDetailPageComponent { }
