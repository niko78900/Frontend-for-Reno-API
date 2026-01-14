import { Inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Contractor, ContractorExpertise } from '../projects/models/project.model';
import { APP_CONFIG, AppConfig } from '../config/app-config';

type ContractorApi = Omit<Contractor, 'id'> & {
  id?: string | number;
  _id?: string | number;
};

@Injectable({
  providedIn: 'root'
})
export class ContractorService {

  private apiUrl: string;

  constructor(
    private http: HttpClient,
    @Inject(APP_CONFIG) appConfig: AppConfig
  ) {
    const apiBaseUrl = (appConfig?.apiBaseUrl ?? '').trim().replace(/\/+$/, '');
    this.apiUrl = apiBaseUrl ? `${apiBaseUrl}/api/contractors` : '/api/contractors';
  }

  // GET ALL CONTRACTORS
  getAllContractors(): Observable<Contractor[]> {
    return this.http.get<unknown>(this.apiUrl).pipe(
      map((response) => this.normalizeContractors(response))
    );
  }

  // GET BY ID
  getContractorById(id: string): Observable<Contractor> {
    return this.http.get<unknown>(`${this.apiUrl}/${id}`).pipe(
      map((response) => this.normalizeContractor(response))
    );
  }

  // GET EXPERTISE ENUMS
  getExpertiseOptions(): Observable<ContractorExpertise[]> {
    return this.http.get<ContractorExpertise[]>(`${this.apiUrl}/expertise`);
  }

  // CREATE CONTRACTOR
  createContractor(contractor: Contractor): Observable<Contractor> {
    return this.http.post<unknown>(this.apiUrl, contractor).pipe(
      map((response) => this.normalizeContractor(response))
    );
  }

  // DELETE CONTRACTOR
  deleteContractor(id: string): Observable<void> {
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

  private normalizeContractor(raw: unknown): Contractor {
    if (!raw || typeof raw !== 'object') {
      return { id: '' } as Contractor;
    }

    const candidate = raw as ContractorApi;
    const resolvedId = this.normalizeId(candidate.id ?? candidate._id);
    const { _id, id, ...rest } = candidate;
    return { ...rest, id: resolvedId ?? '' };
  }

  private normalizeContractors(raw: unknown): Contractor[] {
    if (!Array.isArray(raw)) {
      return [];
    }
    return raw.map((item) => this.normalizeContractor(item));
  }
}
