import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ProjectImage } from '../projects/models/image.model';

type ImageApi = Omit<ProjectImage, 'id' | 'projectId'> & {
  id?: string | number;
  _id?: string | number;
  projectId?: string | number;
};

@Injectable({
  providedIn: 'root'
})
export class ImageService {

  private apiUrl = 'http://localhost:8080/api/images';

  constructor(private http: HttpClient) {}

  getImagesByProject(projectId: string): Observable<ProjectImage[]> {
    return this.http.get<unknown>(`${this.apiUrl}/project/${projectId}`).pipe(
      map((response) => this.normalizeImages(response))
    );
  }

  uploadImage(formData: FormData): Observable<ProjectImage> {
    return this.http.post<unknown>(`${this.apiUrl}/upload`, formData).pipe(
      map((response) => this.normalizeImage(response))
    );
  }

  createImageFromUrl(payload: {
    projectId: string;
    url: string;
    description?: string;
    uploadedBy?: string;
  }): Observable<ProjectImage> {
    return this.http.post<unknown>(this.apiUrl, payload).pipe(
      map((response) => this.normalizeImage(response))
    );
  }

  deleteImage(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }

  private normalizeId(value: unknown): string | undefined {
    if (typeof value === 'string') {
      return value;
    }
    if (typeof value === 'number') {
      return String(value);
    }
    return undefined;
  }

  private normalizeImage(raw: unknown): ProjectImage {
    if (!raw || typeof raw !== 'object') {
      return { id: '', projectId: '', url: '' };
    }

    const candidate = raw as ImageApi;
    const resolvedId = this.normalizeId(candidate.id ?? candidate._id);
    const resolvedProjectId = this.normalizeId(candidate.projectId) ?? '';
    const url = typeof candidate.url === 'string' ? candidate.url : '';
    const description = typeof candidate.description === 'string' ? candidate.description : undefined;
    const uploadedAt = typeof candidate.uploadedAt === 'string' ? candidate.uploadedAt : undefined;
    const uploadedBy = typeof candidate.uploadedBy === 'string' ? candidate.uploadedBy : undefined;

    return {
      id: resolvedId ?? '',
      projectId: resolvedProjectId,
      url,
      description,
      uploadedAt,
      uploadedBy
    };
  }

  private normalizeImages(raw: unknown): ProjectImage[] {
    if (Array.isArray(raw)) {
      return raw.map((item) => this.normalizeImage(item));
    }

    if (raw && typeof raw === 'object') {
      const candidate = raw as { images?: unknown; data?: unknown };
      if (Array.isArray(candidate.images)) {
        return candidate.images.map((item) => this.normalizeImage(item));
      }
      if (Array.isArray(candidate.data)) {
        return candidate.data.map((item) => this.normalizeImage(item));
      }
    }

    return [];
  }
}
