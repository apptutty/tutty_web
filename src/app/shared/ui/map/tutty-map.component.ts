/**
 * TuttyMapComponent — shared Google Maps wrapper.
 *
 * Modes:
 *   picker  — user can click to drop/move a single marker; emits (locationChange)
 *   view    — read-only map with a single marker
 *   radius  — read-only (or editable via the center) map showing a commerce pin + a filled circle
 *             representing the delivery radius in km
 *   polygon — precise area boundary. Reusable by ANY feature needing a delimited zone
 *             (beaches, delivery zones, etc). [editable]=true lets the admin build/edit the
 *             boundary by clicking to add vertices and dragging vertex markers to adjust them;
 *             [editable]=false renders a read-only preview of [vertices].
 *
 * Usage:
 *   <app-tutty-map mode="picker"  [lat]="..." [lng]="..." (locationChange)="onPick($event)" />
 *   <app-tutty-map mode="view"    [lat]="..." [lng]="..." />
 *   <app-tutty-map mode="radius"  [lat]="..." [lng]="..." [radiusKm]="5" />
 *   <app-tutty-map mode="polygon" [vertices]="vertices()" [editable]="true" (verticesChange)="onVertices($event)" />
 *
 * Note (zoneless app): this app runs without zone.js, so every piece of state that the
 * template depends on MUST be a signal — plain class fields mutated from callbacks that
 * Angular doesn't know about (e.g. a native <script> "load"/"error" event) will never
 * trigger a re-render otherwise.
 */
import {
    Component, Input, Output, EventEmitter, OnInit, OnChanges,
    SimpleChanges, inject, PLATFORM_ID, ChangeDetectionStrategy, signal, ViewChild,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { GoogleMap, MapMarker, MapCircle, MapPolygon } from '@angular/google-maps';
import { environment } from '../../../../environments/environment';

export interface LatLng {
    lat: number;
    lng: number;
}

/** Module-level singleton so concurrent map instances never inject the Google Maps
 *  script twice and all resolve/reject off the same load event. */
let gmapsLoadPromise: Promise<void> | null = null;

function loadGoogleMapsScript(apiKey: string): Promise<void> {
    if ((window as any).google?.maps) {
        return Promise.resolve();
    }
    if (gmapsLoadPromise) {
        return gmapsLoadPromise;
    }

    gmapsLoadPromise = new Promise<void>((resolve, reject) => {
        const existing = document.getElementById('gmaps-script') as HTMLScriptElement | null;
        if (existing) {
            existing.addEventListener('load', () => resolve());
            existing.addEventListener('error', () => reject(new Error('gmaps-load-error')));
            return;
        }

        const script = document.createElement('script');
        script.id = 'gmaps-script';
        script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`;
        script.async = true;
        script.defer = true;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error('gmaps-load-error'));
        document.head.appendChild(script);
    }).catch((err) => {
        // Allow a future retry (e.g. after a transient network failure) instead of caching a failure forever.
        gmapsLoadPromise = null;
        throw err;
    });

    return gmapsLoadPromise;
}

@Component({
    selector: 'app-tutty-map',
    standalone: true,
    imports: [GoogleMap, MapMarker, MapCircle, MapPolygon],
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
    @if (apiLoaded() && isBrowser) {
      <google-map
        #googleMapRef
        [width]="width"
        [height]="height"
        [center]="center()"
        [zoom]="zoom"
        [options]="mapOptions"
        (mapClick)="onMapClick($event)"
        [class]="mapClass"
      >
        @if (mode !== 'polygon' && markerPosition(); as position) {
          <map-marker
            [position]="position"
            [options]="markerOptions"
          />
        }
        @if (mode === 'radius' && radiusKm > 0 && markerPosition(); as position) {
          <map-circle
            [center]="position"
            [radius]="radiusKm * 1000"
            [options]="circleOptions"
          />
        }
        @if (mode === 'polygon') {
          @if (polygonPath().length > 2) {
            <map-polygon [paths]="polygonPath()" [options]="polygonOptions" />
          }
          @if (editable) {
            @for (vertex of polygonPath(); track $index) {
              <map-marker
                [position]="vertex"
                [options]="vertexMarkerOptions"
                (mapDragend)="onVertexDragEnd($index, $event)"
              />
            }
          }
        }
      </google-map>
    } @else {
      <div
        [style.width]="width"
        [style.height]="height"
        [class]="mapClass"
        class="bg-gray-100 flex items-center justify-center text-gray-400 text-sm overflow-hidden rounded-xl"
      >
        @if (!isBrowser) {
          <span>Map (SSR)</span>
        } @else if (mapError(); as error) {
          <span class="flex flex-col items-center gap-2 text-center px-3">
            <span>{{ error }}</span>
            @if (mode === 'picker') {
              <span class="text-xs text-gray-400">Puedes ingresar las coordenadas manualmente arriba.</span>
            }
          </span>
        } @else {
          <span class="flex items-center gap-2">
            <svg class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
            </svg>
            Loading map…
          </span>
        }
      </div>
    }
  `,
})
export class TuttyMapComponent implements OnInit, OnChanges {
    @Input() mode: 'picker' | 'view' | 'radius' | 'polygon' = 'view';
    @Input() lat: number | null | undefined = null;
    @Input() lng: number | null | undefined = null;
    @Input() radiusKm = 0;
    @Input() width = '100%';
    @Input() height = '350px';
    @Input() mapClass = 'rounded-xl overflow-hidden';
    @Input() zoom = 14;

    /** mode="polygon" only: current boundary vertices (in order). */
    @Input() vertices: LatLng[] | null = null;
    /** mode="polygon" only: when true, clicking adds a vertex and vertex markers are draggable. */
    @Input() editable = true;

    @Output() locationChange = new EventEmitter<LatLng>();
    /** mode="polygon" only: emitted whenever the vertex list changes (add/drag/undo/clear). */
    @Output() verticesChange = new EventEmitter<LatLng[]>();

    @ViewChild('googleMapRef') private googleMapRef?: GoogleMap;

    private readonly platformId = inject(PLATFORM_ID);
    readonly isBrowser = isPlatformBrowser(this.platformId);

    readonly apiLoaded = signal(false);
    readonly mapError = signal<string | null>(null);
    readonly center = signal<google.maps.LatLngLiteral>({ lat: 18.4718, lng: -69.9513 }); // Santo Domingo default
    readonly markerPosition = signal<google.maps.LatLngLiteral | null>(null);
    readonly polygonPath = signal<google.maps.LatLngLiteral[]>([]);

    readonly mapOptions: google.maps.MapOptions = {
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
        zoomControl: true,
        styles: [
            { featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] },
        ],
    };

    readonly markerOptions: google.maps.MarkerOptions = {
        draggable: false,
        animation: undefined,
    };

    readonly vertexMarkerOptions: google.maps.MarkerOptions = {
        draggable: true,
        icon: {
            path: 0, // google.maps.SymbolPath.CIRCLE (numeric to avoid needing the API loaded at module-eval time)
            scale: 7,
            fillColor: '#FF3C97',
            fillOpacity: 1,
            strokeColor: '#ffffff',
            strokeWeight: 2,
        },
    };

    readonly circleOptions: google.maps.CircleOptions = {
        fillColor: '#FF3C97',
        fillOpacity: 0.12,
        strokeColor: '#FF3C97',
        strokeWeight: 2,
        strokeOpacity: 0.6,
    };

    readonly polygonOptions: google.maps.PolygonOptions = {
        fillColor: '#FF3C97',
        fillOpacity: 0.15,
        strokeColor: '#FF3C97',
        strokeWeight: 2,
        strokeOpacity: 0.8,
    };

    ngOnInit(): void {
        if (!this.isBrowser) return;
        this.loadApi();
        this.syncPosition();
        this.syncVertices();
    }

    ngOnChanges(changes: SimpleChanges): void {
        if (changes['lat'] || changes['lng']) {
            this.syncPosition();
        }
        if (changes['vertices']) {
            this.syncVertices();
        }
    }

    private syncPosition(): void {
        if (this.lat != null && this.lng != null) {
            const position = { lat: +this.lat, lng: +this.lng };
            this.markerPosition.set(position);
            // In polygon mode, an existing boundary takes priority over the anchor
            // lat/lng (e.g. the commerce's own location) — the admin wants to see
            // the delimited zone, not where the commerce happens to be pinned.
            if (this.mode !== 'polygon' || this.polygonPath().length === 0) {
                this.center.set(position);
            }
        } else {
            this.markerPosition.set(null);
        }
    }

    private syncVertices(): void {
        const path = (this.vertices ?? []).map((v) => ({ lat: v.lat, lng: v.lng }));
        this.polygonPath.set(path);
        if (path.length > 0) {
            this.center.set(this.computeCentroid(path));
            this.scheduleFitToPath();
        } else if (this.lat != null && this.lng != null) {
            this.center.set({ lat: +this.lat, lng: +this.lng });
        }
    }

    private computeCentroid(path: google.maps.LatLngLiteral[]): google.maps.LatLngLiteral {
        const sum = path.reduce((acc, p) => ({ lat: acc.lat + p.lat, lng: acc.lng + p.lng }), { lat: 0, lng: 0 });
        return { lat: sum.lat / path.length, lng: sum.lng / path.length };
    }

    /** Defers to the next tick so the <google-map> (behind an @if on apiLoaded) has
     *  had a chance to render and populate `googleMapRef` before we call fitBounds. */
    private scheduleFitToPath(): void {
        if (!this.isBrowser) return;
        setTimeout(() => {
            const path = this.polygonPath();
            if (path.length >= 2) this.fitBoundsToPath(path);
        }, 0);
    }

    private fitBoundsToPath(path: google.maps.LatLngLiteral[]): void {
        const gmaps = (window as any).google?.maps;
        if (!gmaps || !this.googleMapRef) return;
        const bounds = new gmaps.LatLngBounds();
        for (const point of path) bounds.extend(point);
        this.googleMapRef.fitBounds(bounds, 48);
    }

    private loadApi(): void {
        const apiKey = (environment.googleMapsApiKey ?? '').trim();
        if (!apiKey || apiKey.includes('YOUR_GOOGLE_MAPS_API_KEY')) {
            this.mapError.set('Google Maps no está configurado en este entorno.');
            this.apiLoaded.set(false);
            return;
        }

        if ((window as any).google?.maps) {
            this.markerOptions.animation = (window as any).google.maps.Animation?.DROP;
            this.apiLoaded.set(true);
            this.mapError.set(null);
            this.scheduleFitToPath();
            return;
        }

        loadGoogleMapsScript(apiKey)
            .then(() => {
                this.markerOptions.animation = (window as any).google?.maps?.Animation?.DROP;
                this.apiLoaded.set(true);
                this.mapError.set(null);
                this.scheduleFitToPath();
            })
            .catch(() => {
                this.apiLoaded.set(false);
                this.mapError.set('No se pudo cargar Google Maps.');
            });
    }

    onMapClick(event: google.maps.MapMouseEvent): void {
        if (!event.latLng) return;

        if (this.mode === 'picker') {
            const pos = { lat: event.latLng.lat(), lng: event.latLng.lng() };
            this.markerPosition.set(pos);
            this.locationChange.emit(pos);
            return;
        }

        if (this.mode === 'polygon' && this.editable) {
            const pos = { lat: event.latLng.lat(), lng: event.latLng.lng() };
            const next = [...this.polygonPath(), pos];
            this.polygonPath.set(next);
            this.verticesChange.emit(next);
        }
    }

    onVertexDragEnd(index: number, event: google.maps.MapMouseEvent): void {
        if (!event.latLng || this.mode !== 'polygon' || !this.editable) return;
        const next = this.polygonPath().slice();
        next[index] = { lat: event.latLng.lat(), lng: event.latLng.lng() };
        this.polygonPath.set(next);
        this.verticesChange.emit(next);
    }

    /** mode="polygon" only: removes the last added vertex. Call from a host "Undo" button. */
    undoLastVertex(): void {
        const next = this.polygonPath().slice(0, -1);
        this.polygonPath.set(next);
        this.verticesChange.emit(next);
    }

    /** mode="polygon" only: clears the boundary entirely. Call from a host "Clear" button. */
    clearVertices(): void {
        this.polygonPath.set([]);
        this.verticesChange.emit([]);
    }
}
