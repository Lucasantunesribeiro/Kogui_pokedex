import { Injectable, signal } from '@angular/core';

export type FeedbackType = 'success' | 'error' | 'info';

export interface FeedbackMessage {
  type: FeedbackType;
  message: string;
}

@Injectable({ providedIn: 'root' })
export class FeedbackService {
  readonly message = signal<FeedbackMessage | null>(null);

  notifySuccess(message: string): void {
    this.message.set({ type: 'success', message });
  }

  notifyError(message: string): void {
    this.message.set({ type: 'error', message });
  }

  notifyInfo(message: string): void {
    this.message.set({ type: 'info', message });
  }

  clear(): void {
    this.message.set(null);
  }
}
