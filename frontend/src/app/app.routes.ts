import { Routes } from '@angular/router';

import { FavoritesPageComponent } from './pages/favorites/favorites.page';
import { LoginPageComponent } from './pages/login/login.page';
import { PasswordResetPageComponent } from './pages/password-reset/password-reset.page';
import { PokemonPageComponent } from './pages/pokemon/pokemon.page';
import { TeamPageComponent } from './pages/team/team.page';
import { adminGuard } from './admin.guard';
import { authGuard } from './auth.guard';
import { AdminUsersPageComponent } from './pages/admin-users/admin-users.page';

export const routes: Routes = [
  { path: '', component: PokemonPageComponent, title: 'Pokédx Digital' },
  { path: 'login', component: LoginPageComponent, title: 'Entrar' },
  { path: 'favorites', component: FavoritesPageComponent, canActivate: [authGuard], title: 'Favoritos' },
  { path: 'team', component: TeamPageComponent, canActivate: [authGuard], title: 'Equipe' },
  {
    path: 'account/password',
    component: PasswordResetPageComponent,
    canActivate: [authGuard],
    title: 'Alterar senha'
  },
  {
    path: 'password-reset',
    component: PasswordResetPageComponent,
    title: 'Redefinir senha'
  },
  {
    path: 'password-reset/:uid/:token',
    component: PasswordResetPageComponent,
    title: 'Redefinir senha'
  },
  {
    path: 'admin/users',
    component: AdminUsersPageComponent,
    canActivate: [adminGuard],
    title: 'Gestão de usuários'
  },
  { path: '**', redirectTo: '' }
];
