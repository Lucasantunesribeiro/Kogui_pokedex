import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';

import { HeaderBannerComponent } from '../../ui/header-banner/header-banner.component';
import { StatsStripComponent, StatsData } from '../../ui/stats-strip/stats-strip.component';
import { FilterChipsComponent, FilterChip } from '../../ui/filter-chips/filter-chips.component';
import { PokemonCardComponent, PokemonCardData } from '../../ui/pokemon-card/pokemon-card.component';

@Component({
  selector: 'app-pokedex-home',
  standalone: true,
  imports: [
    CommonModule,
    HeaderBannerComponent,
    StatsStripComponent,
    FilterChipsComponent,
    PokemonCardComponent
  ],
  templateUrl: './pokedex-home.component.html',
  styleUrl: './pokedex-home.component.css'
})
export class PokedexHomeComponent {
  stats: StatsData = {
    pokemon: 6,
    types: 18,
    generations: 9
  };

  filterChips: FilterChip[] = [
    { label: 'Todos', value: 'all' },
    { label: 'Fogo', value: 'fire' },
    { label: 'Água', value: 'water' },
    { label: 'Grama', value: 'grass' },
    { label: 'Elétrico', value: 'electric' }
  ];

  activeFilter = 'all';

  mockPokemon: PokemonCardData[] = [
    {
      id: 1,
      name: 'bulbasaur',
      types: ['grass', 'poison'],
      stats: { hp: 45, attack: 49, defense: 49 },
      imageUrl: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/1.png'
    },
    {
      id: 4,
      name: 'charmander',
      types: ['fire'],
      stats: { hp: 39, attack: 52, defense: 43 },
      imageUrl: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/4.png'
    },
    {
      id: 7,
      name: 'squirtle',
      types: ['water'],
      stats: { hp: 44, attack: 48, defense: 65 },
      imageUrl: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/7.png'
    }
  ];

  onFilterChange(value: string): void {
    this.activeFilter = value;
  }

  get filteredPokemon(): PokemonCardData[] {
    if (this.activeFilter === 'all') {
      return this.mockPokemon;
    }
    return this.mockPokemon.filter(pokemon =>
      pokemon.types.some(type => type.toLowerCase() === this.activeFilter)
    );
  }

  trackByPokemonId(index: number, pokemon: PokemonCardData): number {
    return pokemon.id;
  }
}