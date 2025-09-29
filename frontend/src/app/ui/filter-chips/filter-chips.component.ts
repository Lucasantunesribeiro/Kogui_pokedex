import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';

export interface FilterChip {
  label: string;
  value: string;
  disabled?: boolean;
}

@Component({
  selector: 'app-filter-chips',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './filter-chips.component.html',
  styleUrl: './filter-chips.component.css'
})
export class FilterChipsComponent {
  @Input() chips: FilterChip[] = [];
  @Input() activeValue: string = 'all';
  @Output() chipSelected = new EventEmitter<string>();

  onChipClick(chip: FilterChip): void {
    if (!chip.disabled) {
      this.chipSelected.emit(chip.value);
    }
  }

  isActive(value: string): boolean {
    return this.activeValue === value;
  }

  trackByValue(index: number, chip: FilterChip): string {
    return chip.value;
  }
}