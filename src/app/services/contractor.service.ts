import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Contractor, ContractorExpertise } from '../projects/models/project.model';

@Injectable({
  providedIn: 'root'
})
export class ContractorService {

  private apiUrl = 'http://localhost:8080/api/contractors';

  constructor(private http: HttpClient) {}

  // GET ALL CONTRACTORS
  getAllContractors(): Observable<Contractor[]> {
    return this.http.get<Contractor[]>(this.apiUrl);
  }

  // GET BY ID
  getContractorById(id: string): Observable<Contractor> {
    return this.http.get<Contractor>(`${this.apiUrl}/${id}`);
  }

  // GET EXPERTISE ENUMS
  getExpertiseOptions(): Observable<ContractorExpertise[]> {
    return this.http.get<ContractorExpertise[]>(`${this.apiUrl}/expertise`);
  }

  // CREATE CONTRACTOR
  createContractor(contractor: Contractor): Observable<Contractor> {
    return this.http.post<Contractor>(this.apiUrl, contractor);
  }

  // DELETE CONTRACTOR
  deleteContractor(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }
}
