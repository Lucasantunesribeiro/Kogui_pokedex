import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject } from '@angular/core';

import { TeamSlotItem } from '../../services/api.service';
import { FeedbackService } from '../../services/feedback.service';
import { UserCollectionsStore } from '../../services/user-collections.store';

interface DisplaySlot {
  slot: number;
  pokemon?: TeamSlotItem;
}

@Component({
  selector: 'app-team-page',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './team.page.html',
  styleUrl: './team.page.css'
})
export class TeamPageComponent implements OnInit {
  private readonly collections = inject(UserCollectionsStore);
  private readonly feedback = inject(FeedbackService);

  readonly team = this.collections.team;
  readonly loading = this.collections.teamLoading;

  readonly displaySlots = computed<DisplaySlot[]>(() => {
    const current = this.collections.team();
    return Array.from({ length: 6 }, (_, index) => {
      const slotNumber = index + 1;
      const pokemon = current.find((item) => item.slot === slotNumber);
      return { slot: slotNumber, pokemon };
    });
  });

  ngOnInit(): void {
    if (!this.loading() && this.team().length === 0) {
      this.collections.refreshTeam();
    }
  }

  removeFromTeam(slot: TeamSlotItem): void {
    const updatedIds = this.team()
      .filter((item) => item.pokemon_id !== slot.pokemon_id)
      .sort((a, b) => a.slot - b.slot)
      .map(({ pokemon_id }) => pokemon_id);

    this.collections.setTeam(updatedIds).subscribe({
      next: () => this.feedback.notifyInfo('Pokémon removido da equipe.'),
      error: (err) => {
        const detail = err?.error?.detail ?? err?.error?.pokemon_ids?.[0];
        this.feedback.notifyError(detail ?? 'Erro ao atualizar equipe.');
      }
    });
  }

  clearTeam(): void {
    this.collections.clearTeam().subscribe({
      next: () => this.feedback.notifyInfo('Equipe esvaziada.'),
      error: (err) => {
        const detail = err?.error?.detail ?? err?.error?.pokemon_ids?.[0];
        this.feedback.notifyError(detail ?? 'Erro ao atualizar equipe.');
      }
    });
  }

  formatName(name?: string | null): string {
    if (!name) {
      return '';
    }
    return name.charAt(0).toUpperCase() + name.slice(1);
  }

  formatId(id?: number): string {
    if (!id) {
      return '';
    }
    return `#${String(id).padStart(3, '0')}`;
  }
}
