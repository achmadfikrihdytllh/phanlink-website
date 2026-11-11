import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth-guard';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () =>
      import('./features/auth/login/login').then((m) => m.Login),
  },
  {
    path: 'register',
    loadComponent: () =>
      import('./features/auth/register/register').then((m) => m.Register),
  },
  {
    path: 'forgot-password',
    loadComponent: () =>
      import('./features/auth/forgot-password/forgot-password').then((m) => m.ForgotPassword),
  },
  {
    path: 'reset-password',
    loadComponent: () =>
      import('./features/auth/reset-password/reset-password').then((m) => m.ResetPassword),
  },
  {
    // Phantom Messenger shell: rail + one page per section.
    path: '',
    loadComponent: () => import('./features/shell/shell').then((m) => m.Shell),
    canActivate: [authGuard],
    children: [
      {
        path: 'messages',
        loadComponent: () =>
          import('./features/messages/messages').then((m) => m.Messages),
      },
      {
        path: 'profile',
        loadComponent: () =>
          import('./features/profile/profile').then((m) => m.Profile),
      },
      {
        path: 'settings',
        loadComponent: () =>
          import('./features/settings/settings').then((m) => m.Settings),
      },
      {
        path: 'groups',
        loadComponent: () =>
          import('./features/groups/groups').then((m) => m.Groups),
      },
      {
        path: 'saved',
        loadComponent: () =>
          import('./features/saved/saved').then((m) => m.Saved),
      },
      {
        path: 'contacts',
        loadComponent: () =>
          import('./features/contacts/contacts').then((m) => m.Contacts),
      },
      {
        path: 'search',
        loadComponent: () =>
          import('./features/search/search').then((m) => m.Search),
      },
      { path: '', redirectTo: 'messages', pathMatch: 'full' },
    ],
  },
  // Old URL kept alive so existing bookmarks still land somewhere sensible.
  { path: 'chat', redirectTo: 'messages' },
  { path: '**', redirectTo: 'messages' },
];
