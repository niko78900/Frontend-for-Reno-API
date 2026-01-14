import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export type AppMessageTone = 'info' | 'error' | 'success';

export interface AppMessage {
  text: string;
  tone: AppMessageTone;
}

@Injectable({
  providedIn: 'root'
})
export class AppMessageService {
  private readonly messageSubject = new BehaviorSubject<AppMessage | null>(null);
  readonly message$ = this.messageSubject.asObservable();

  show(text: string, tone: AppMessageTone = 'info'): void {
    const trimmed = text.trim();
    if (!trimmed) {
      return;
    }
    this.messageSubject.next({ text: trimmed, tone });
  }

  clear(): void {
    this.messageSubject.next(null);
  }
}
