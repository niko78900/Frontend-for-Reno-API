import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

export interface GeocodeResult {
  latitude: number;
  longitude: number;
  label: string;
}

interface NominatimResponse {
  lat: string;
  lon: string;
  display_name?: string;
}

@Injectable({
  providedIn: 'root'
})
export class GeocodingService {
  private readonly endpoint = 'https://nominatim.openstreetmap.org/search';

  constructor(private http: HttpClient) {}

  geocodeAddress(address: string): Observable<GeocodeResult | null> {
    const query = address?.trim();
    if (!query) {
      return of(null);
    }

    const params = new HttpParams()
      .set('q', query)
      .set('format', 'json')
      .set('limit', '1')
      .set('addressdetails', '1');

    const headers = new HttpHeaders({
      'Accept-Language': 'en',
      Accept: 'application/json',
    });

    return this.http.get<NominatimResponse[]>(this.endpoint, { params, headers }).pipe(
      map((results) => {
        if (!Array.isArray(results) || !results.length) {
          return null;
        }

        const first = results[0];
        const latitude = Number(first?.lat);
        const longitude = Number(first?.lon);

        if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
          return null;
        }

        return {
          latitude,
          longitude,
          label: first?.display_name || query
        };
      }),
      catchError((err) => {
        console.warn('Geocoding failed', err);
        return of(null);
      })
    );
  }
}
