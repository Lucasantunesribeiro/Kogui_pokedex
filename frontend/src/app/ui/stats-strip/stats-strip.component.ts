import { Component, Input } from '@angular/core';

export interface StatsData {
  pokemon: number;
  types: number;
  generations: number;
}

@Component({
  selector: 'app-stats-strip',
  standalone: true,
  templateUrl: './stats-strip.component.html',
  styleUrl: './stats-strip.component.css'
})
export class StatsStripComponent {
  @Input() stats: StatsData = {
    pokemon: 6,
    types: 18,
    generations: 9
  };
}