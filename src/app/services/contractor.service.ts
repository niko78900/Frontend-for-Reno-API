import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class ContractorService {

  private apiUrl = 'http://localhost:8080/api/contractors';

  constructor(private http: HttpClient) {}

  // GET ALL CONTRACTORS
  getAllContractors(): Observable<any[]> {
    return this.http.get<any[]>(this.apiUrl);
  }

  // GET BY ID
  getContractorById(id: string): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/${id}`);
  }

  // CREATE CONTRACTOR
  createContractor(contractor: any): Observable<any> {
    return this.http.post<any>(this.apiUrl, contractor);
  }

  // DELETE CONTRACTOR
  deleteContractor(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }
}
