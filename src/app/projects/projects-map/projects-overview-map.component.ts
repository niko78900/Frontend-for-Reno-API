import {
  AfterViewInit,
  Component,
  ElementRef,
  Input,
  NgZone,
  OnChanges,
  OnDestroy,
  SimpleChanges,
  ViewChild
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import * as L from 'leaflet';
import { Project } from '../models/project.model';
import { calculateEtaDays } from '../utils/eta.util';

@Component({
  selector: 'app-projects-overview-map',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './projects-overview-map.component.html',
  styleUrls: ['./projects-overview-map.component.css']
})
export class ProjectsOverviewMapComponent implements AfterViewInit, OnChanges, OnDestroy {
  @Input() projects: Project[] = [];
  @Input() loading = false;

  @ViewChild('mapContainer', { static: true }) mapContainer?: ElementRef<HTMLDivElement>;

  selectedProject?: Project;

  private map?: L.Map;
  private markersLayer?: L.LayerGroup;
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

  constructor(
    private router: Router,
    private zone: NgZone
  ) {}

  ngAfterViewInit(): void {
    this.initMap();
    this.plotMarkers();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['projects'] && !changes['projects'].firstChange) {
      this.plotMarkers();
    }
  }

  ngOnDestroy(): void {
    this.map?.remove();
  }

  getProgressValue(project?: Project): number {
    if (!project) {
      return 0;
    }
    if (project.finished) {
      return 100;
    }
    const value = Number(project.progress ?? 0);
    if (Number.isNaN(value) || value < 0) {
      return 0;
    }
    return Math.min(100, value);
  }

  getEtaDays(project?: Project): number | undefined {
    if (!project || project.finished) {
      return undefined;
    }
    return calculateEtaDays({
      baseEtaWeeks: project.eta,
      workers: project.number_of_workers ?? project.numberOfWorkers ?? 0,
      progressPercent: this.getProgressValue(project)
    });
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

    this.markersLayer = L.layerGroup().addTo(this.map);
    window.setTimeout(() => this.map?.invalidateSize(), 100);
  }

  private plotMarkers(): void {
    if (!this.map || !this.markersLayer) {
      return;
    }

    this.markersLayer.clearLayers();

    const located = (this.projects ?? []).filter((project) => this.hasCoordinates(project));
    if (!located.length) {
      this.selectedProject = undefined;
      this.map.setView(this.defaultView, this.defaultZoom);
      return;
    }

    const bounds = L.latLngBounds([]);

    located.forEach((project) => {
      const latLng = L.latLng(project.latitude as number, project.longitude as number);
      bounds.extend(latLng);

      const marker = L.marker(latLng, {
        icon: this.markerIcon,
        title: project.name
      });

      const popup = this.buildMarkerPopup(project);

      marker.on('click', () => {
        this.zone.run(() => {
          this.selectedProject = project;
          marker.openPopup();
          this.onNavigate(project);
        });
      });

      marker.bindTooltip(project.name || 'Project', {
        direction: 'top',
        offset: [0, -10],
        opacity: 0.9
      });

      marker.bindPopup(popup);
      marker.addTo(this.markersLayer as L.LayerGroup);
    });

    this.map.fitBounds(bounds, { padding: [32, 32], maxZoom: 15 });
  }

  private hasCoordinates(project?: Project): project is Project & { latitude: number; longitude: number } {
    return Number.isFinite(project?.latitude) && Number.isFinite(project?.longitude);
  }

  private buildMarkerPopup(project: Project): L.Popup {
    const popup = L.popup({
      closeButton: false,
      autoPan: true,
      maxWidth: 320,
      className: 'overview-map__popup-wrapper'
    });

    const container = L.DomUtil.create('div', 'overview-map__popup');
    const title = L.DomUtil.create('h4', 'overview-map__popup-title', container);
    title.textContent = project.name || 'Project';

    const address = L.DomUtil.create('p', 'overview-map__popup-address', container);
    address.textContent = project.address || 'Address not provided';

    const eta = this.getEtaDays(project);
    const etaLine = L.DomUtil.create('p', 'overview-map__popup-meta', container);
    etaLine.textContent = eta !== undefined
      ? `ETA: ${eta} day${eta === 1 ? '' : 's'}`
      : 'ETA not set';

    const projectId = this.resolveProjectId(project);
    if (projectId) {
      container.dataset['projectId'] = projectId;
      const link = L.DomUtil.create('button', 'overview-map__popup-link', container);
      link.type = 'button';
      link.textContent = 'View project';
      L.DomEvent.on(link, 'click', (event) => {
        L.DomEvent.stop(event);
        this.zone.run(() => this.onNavigate(project));
      });
    }

    L.DomEvent.on(container, 'click', (event) => {
      L.DomEvent.stop(event);
      this.zone.run(() => this.onNavigate(project));
    });

    L.DomEvent.disableClickPropagation(container);
    L.DomEvent.disableScrollPropagation(container);

    popup.setContent(container);
    return popup;
  }

  private resolveProjectId(project: Project): string | undefined {
    const withMongoId = project as Project & { _id?: string; projectId?: string; project_id?: string };
    const id = project.id ?? withMongoId._id ?? withMongoId.projectId ?? withMongoId.project_id;
    return typeof id === 'number' ? String(id) : id;
  }

  onNavigate(project?: Project): void {
    const target = project ?? this.selectedProject;
    const projectId = target ? this.resolveProjectId(target) : undefined;

    if (!target || !projectId) {
      console.warn('Cannot navigate to project because id is missing', target);
      return;
    }

    this.zone.run(() => {
      this.router.navigate(['/projects', projectId], { state: { project: target } });
    });
  }
}
