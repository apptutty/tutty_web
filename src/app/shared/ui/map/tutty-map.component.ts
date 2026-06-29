/**
 * TuttyMapComponent — shared Google Maps wrapper.
 *
 * Modes:
 *   picker  — user can click to drop/move a single marker; emits (locationChange)
 *   view    — read-only map with a single marker
 *   radius  — read-only (or editable via the center) map showing a commerce pin + a filled circle
 *             representing the delivery radius in km
 *
 * Usage:
 *   <app-tutty-map mode="picker" [lat]="..." [lng]="..." (locationChange)="onPick($event)" />
 *   <app-tutty-map mode="view"   [lat]="..." [lng]="..." />
 *   <app-tutty-map mode="radius" [lat]="..." [lng]="..." [radiusKm]="5" />
 */
import {
    Component, Input, Output, EventEmitter, OnInit, OnChanges,
    SimpleChanges, inject, PLATFORM_ID, ChangeDetectionStrategy,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { GoogleMap, MapMarker, MapCircle } from '@angular/google-maps';
import { environment } from '../../../../environments/environment';

export interface LatLng {
    lat: number;
    lng: number;
}

@Component({
    selector: 'app-tutty-map',
    standalone: true,
    imports: [GoogleMap, MapMarker, MapCircle],
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
    @if (apiLoaded && isBrowser) {
      <google-map
        [width]="width"
        [height]="height"
        [center]="center"
        [zoom]="zoom"
        [options]="mapOptions"
        (mapClick)="mode === 'picker' ? onMapClick($event) : null"
        [class]="mapClass"
      >
        @if (markerPosition) {
          <map-marker
            [position]="markerPosition"
            [options]="markerOptions"
          />
        }
        @if (mode === 'radius' && radiusKm > 0 && markerPosition) {
          <map-circle
            [center]="markerPosition"
            [radius]="radiusKm * 1000"
            [options]="circleOptions"
          />
        }
      </google-map>
    } @else {
      <div
        [style.width]="width"
        [style.height]="height"
        [class]="mapClass"
        class="bg-gray-100 flex items-center justify-center text-gray-400 text-sm"
      >
        @if (!isBrowser) {
          <span>Map (SSR)</span>
        } @else if (mapError) {
          <span>{{ mapError }}</span>
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
    @Input() mode: 'picker' | 'view' | 'radius' = 'view';
    @Input() lat: number | null | undefined = null;
    @Input() lng: number | null | undefined = null;
    @Input() radiusKm = 0;
    @Input() width = '100%';
    @Input() height = '350px';
    @Input() mapClass = 'rounded-xl overflow-hidden';
    @Input() zoom = 14;

    @Output() locationChange = new EventEmitter<LatLng>();

    private readonly platformId = inject(PLATFORM_ID);
    readonly isBrowser = isPlatformBrowser(this.platformId);

    apiLoaded = false;
    mapError: string | null = null;
    center: google.maps.LatLngLiteral = { lat: 18.4718, lng: -69.9513 }; // Santo Domingo default
    markerPosition: google.maps.LatLngLiteral | null = null;

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

    readonly circleOptions: google.maps.CircleOptions = {
        fillColor: '#FF3C97',
        fillOpacity: 0.12,
        strokeColor: '#FF3C97',
        strokeWeight: 2,
        strokeOpacity: 0.6,
    };

    ngOnInit(): void {
        if (!this.isBrowser) return;
        this.loadApi();
        this.syncPosition();
    }

    ngOnChanges(changes: SimpleChanges): void {
        if (changes['lat'] || changes['lng']) {
            this.syncPosition();
        }
    }

    private syncPosition(): void {
        if (this.lat != null && this.lng != null) {
            this.markerPosition = { lat: +this.lat, lng: +this.lng };
            this.center = { lat: +this.lat, lng: +this.lng };
        } else {
            this.markerPosition = null;
        }
    }

    private loadApi(): void {
        const apiKey = (environment.googleMapsApiKey ?? '').trim();
        if (!apiKey || apiKey.includes('YOUR_GOOGLE_MAPS_API_KEY')) {
            this.mapError = 'Google Maps no está configurado en este entorno.';
            this.apiLoaded = false;
            return;
        }

        if ((window as any).google?.maps) {
            this.markerOptions.animation = (window as any).google.maps.Animation?.DROP;
            this.apiLoaded = true;
            this.mapError = null;
            return;
        }
        const existing = document.getElementById('gmaps-script');
        if (existing) {
            existing.addEventListener('load', () => {
                this.markerOptions.animation = (window as any).google?.maps?.Animation?.DROP;
                this.apiLoaded = true;
            });
            return;
        }
        const script = document.createElement('script');
        script.id = 'gmaps-script';
        script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`;
        script.async = true;
        script.defer = true;
        script.onload = () => {
            this.markerOptions.animation = (window as any).google?.maps?.Animation?.DROP;
            this.apiLoaded = true;
            this.mapError = null;
        };
        script.onerror = () => {
            this.apiLoaded = false;
            this.mapError = 'No se pudo cargar Google Maps.';
        };
        document.head.appendChild(script);
    }

    onMapClick(event: google.maps.MapMouseEvent): void {
        if (!event.latLng || this.mode !== 'picker') return;
        const pos = { lat: event.latLng.lat(), lng: event.latLng.lng() };
        this.markerPosition = pos;
        this.locationChange.emit(pos);
    }
}
