import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';

export interface PokemonCardData {
  id: number;
  name: string;
  types: string[];
  stats: {
    hp: number;
    attack: number;
    defense: number;
  };
  imageUrl?: string;
}

@Component({
  selector: 'app-pokemon-card',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './pokemon-card.component.html',
  styleUrl: './pokemon-card.component.css'
})
export class PokemonCardComponent {
  @Input() pokemon!: PokemonCardData;

  formatId(id: number): string {
    return `#${String(id).padStart(3, '0')}`;
  }

  formatName(name: string): string {
    if (!name) return '';
    return name.charAt(0).toUpperCase() + name.slice(1);
  }

  getTypeColor(type: string): string {
    const colors: { [key: string]: string } = {
      fire: 'var(--type-fire)',
      water: 'var(--type-water)',
      grass: 'var(--type-grass)',
      electric: 'var(--type-electric)',
      poison: 'var(--type-poison)',
      flying: 'var(--type-flying)',
      bug: 'var(--type-bug)',
      psychic: 'var(--type-psychic)',
      ice: 'var(--type-ice)',
      rock: 'var(--type-rock)',
      dragon: 'var(--type-dragon)',
      normal: 'var(--type-normal)'
    };
    return colors[type.toLowerCase()] || colors['normal'];
  }

  getStatWidth(value: number): string {
    const normalized = Math.min(100, Math.max(0, Math.round(value * 0.8)));
    return `${normalized}%`;
  }
}