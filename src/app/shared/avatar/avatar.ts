import { Component, computed, input } from '@angular/core';

import { assetUrl } from '../../core/util/asset-url';

/** Round-ish avatar: the user's photo when there is one, otherwise their initial. */
@Component({
  selector: 'pm-avatar',
  template: `
    @if (url(); as src) {
      <img [src]="src" [alt]="name()" />
    } @else {
      {{ initial() }}
    }
  `,
  styles: `
    :host {
      flex: none;
      display: inline-grid;
      place-items: center;
      overflow: hidden;
      width: var(--pm-av, 22px);
      height: var(--pm-av, 22px);
      background: var(--pm-ink);
      color: #fff;
      border: 1px solid var(--pm-ink);
      font: 800 calc(var(--pm-av, 22px) * 0.45) / 1 var(--pm-font-ui);
    }
    img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }
  `,
  host: { '[style.--pm-av.px]': 'size()' },
})
export class PmAvatar {
  name = input<string | null | undefined>('');
  src = input<string | null | undefined>(null);
  size = input(22);

  url = computed(() => assetUrl(this.src()));
  initial = computed(() => (this.name() ?? '?').charAt(0).toUpperCase());
}
