import {
  AfterViewInit,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  Output,
  SimpleChanges,
  ViewChild
} from '@angular/core';
import { CommonModule } from '@angular/common';
import * as L from 'leaflet';

export interface ProjectCoordinates {
  latitude: number;
  longitude: number;
}

@Component({
  selector: 'app-project-location-map',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './project-location-map.component.html',
  styleUrls: ['./project-location-map.component.css']
})
export class ProjectLocationMapComponent implements AfterViewInit, OnChanges, OnDestroy {
  @Input() coordinates: ProjectCoordinates | null = null;
  @Input() addressLabel?: string;
  @Input() hint = 'Drag the marker to fine-tune the site location.';
  @Input() allowManualPlacement = true;
  @Output() coordinatesChange = new EventEmitter<ProjectCoordinates>();
  @Output() mapInteracted = new EventEmitter<void>();

  @ViewChild('mapContainer', { static: true }) mapContainer?: ElementRef<HTMLDivElement>;

  private map?: L.Map;
  private marker?: L.Marker;
  private readonly defaultView: L.LatLngExpression = [39.5, -98.35];
  private readonly defaultZoom = 4;
  private readonly markerIcon = L.icon({
    iconRetinaUrl: new URL('leaflet/dist/images/marker-icon-2x.png', import.meta.url).toString(),
    iconUrl: new URL('leaflet/dist/images/marker-icon.png', import.meta.url).toString(),
    shadowUrl: new URL('leaflet/dist/images/marker-shadow.png', import.meta.url).toString(),
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
  });

  ngAfterViewInit(): void {
    this.initMap();
    this.syncMarker(true);
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['coordinates'] && !changes['coordinates'].firstChange) {
      this.syncMarker();
    }
  }

  ngOnDestroy(): void {
    this.map?.remove();
  }

  private initMap(): void {
    if (this.map || !this.mapContainer) {
      return;
    }

    this.map = L.map(this.mapContainer.nativeElement, {
      worldCopyJump: true,
      zoomControl: true
    }).setView(this.defaultView, this.defaultZoom);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(this.map);

    this.map.on('click', (event: L.LeafletMouseEvent) => {
      if (!this.allowManualPlacement) {
        return;
      }
      this.setMarker(event.latlng, false);
      this.emitCoordinates(event.latlng.lat, event.latlng.lng);
    });

    window.setTimeout(() => this.map?.invalidateSize(), 100);
  }

  private syncMarker(panToMarker = false): void {
    if (!this.map) {
      return;
    }

    if (this.hasCoordinates(this.coordinates)) {
      this.setMarker([this.coordinates!.latitude, this.coordinates!.longitude], panToMarker);
      return;
    }

    if (this.marker) {
      this.marker.remove();
      this.marker = undefined;
    }

    if (panToMarker) {
      this.map.setView(this.defaultView, this.defaultZoom);
    }
  }

  private setMarker(position: L.LatLngExpression, panToMarker = true): void {
    if (!this.map) {
      return;
    }

    if (!this.marker) {
      this.marker = L.marker(position, {
        draggable: this.allowManualPlacement,
        icon: this.markerIcon
      }).addTo(this.map);

      this.marker.on('dragend', () => {
        const latLng = this.marker?.getLatLng();
        if (!latLng) {
          return;
        }
        this.emitCoordinates(latLng.lat, latLng.lng);
      });
    } else {
      this.marker.setLatLng(position);
    }

    if (panToMarker) {
      const nextZoom = Math.max(this.map.getZoom(), 13);
      this.map.setView(this.marker.getLatLng(), nextZoom);
    }
  }

  private emitCoordinates(latitude: number, longitude: number): void {
    this.coordinatesChange.emit({ latitude, longitude });
    this.mapInteracted.emit();
  }

  private hasCoordinates(coords?: ProjectCoordinates | null): coords is ProjectCoordinates {
    return Number.isFinite(coords?.latitude) && Number.isFinite(coords?.longitude);
  }
}
