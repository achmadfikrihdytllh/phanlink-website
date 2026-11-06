import { Injectable, signal } from '@angular/core';

/** Small bits of layout state shared between the shell and the pages. */
@Injectable({ providedIn: 'root' })
export class UiState {
  /** On phones the bottom tab bar hides while a chat or detail pane is open. */
  hideTabs = signal(false);
}
