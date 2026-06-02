import { RenderMode, ServerRoute } from '@angular/ssr';

export const serverRoutes: ServerRoute[] = [
  { path: 'orders/:id', renderMode: RenderMode.Client },
  { path: 'restaurants/:id/menu', renderMode: RenderMode.Client },
  { path: '**', renderMode: RenderMode.Client },
];
