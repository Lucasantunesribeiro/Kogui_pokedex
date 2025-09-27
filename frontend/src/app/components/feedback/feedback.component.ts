import { CommonModule } from '@angular/common';
import { Component, computed, inject } from '@angular/core';

import { FeedbackService } from '../../services/feedback.service';

@Component({
  selector: 'app-feedback',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './feedback.component.html',
  styleUrl: './feedback.component.css'
})
export class FeedbackComponent {
  private readonly feedback = inject(FeedbackService);
  readonly message = computed(() => this.feedback.message());

  close(): void {
    this.feedback.clear();
  }
}
