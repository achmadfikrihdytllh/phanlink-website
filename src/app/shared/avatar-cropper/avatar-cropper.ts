import { Component, OnDestroy, OnInit, computed, input, output, signal } from '@angular/core';

import { clampOffset, coverScale, sourceRect, zoomOffset } from './crop-math';

/** Largest side of the square crop window on screen; it shrinks to fit small or landscape phones. */
const BOX_MAX = 280;
const BOX_MIN = 160;
/** Picture that gets uploaded. */
const OUTPUT = 256;

/** Crop window that fits the screen: side margins and dialog padding off the width, the rest of the dialog off the height. */
function fitBox(): number {
  const room = Math.min(window.innerWidth - 56, window.innerHeight - 300);
  return Math.max(BOX_MIN, Math.min(BOX_MAX, Math.floor(room)));
}
const MAX_ZOOM = 4;

/**
 * Crop dialog for a profile photo: drag to move, slide or scroll to zoom, then "Use photo".
 * Emits a square JPEG (256x256, plenty for the largest avatar on screen), so avatars always look the same however the original was shaped.
 */
@Component({
  selector: 'pm-avatar-cropper',
  host: { '(window:resize)': 'onResize()' },
  template: `
    <div class="back" (click)="cancelled.emit()"></div>
    <div class="dlg" role="dialog" aria-modal="true" aria-label="Crop photo" tabindex="-1" (keydown.escape)="cancelled.emit()">
      <h2>Crop photo</h2>

      <div
        class="stage"
        [style.width.px]="box()"
        [style.height.px]="box()"
        (pointerdown)="down($event)"
        (pointermove)="move($event)"
        (pointerup)="up($event)"
        (pointercancel)="up($event)"
        (wheel)="wheel($event)"
      >
        @if (src(); as s) {
          <img
            [src]="s"
            alt=""
            draggable="false"
            [style.width.px]="natW() * scale()"
            [style.height.px]="natH() * scale()"
            [style.left.px]="offX()"
            [style.top.px]="offY()"
          />
        }
        <span class="grid"></span>
      </div>

      <label class="zoom">
        <span>Zoom</span>
        <input type="range" min="1" [max]="maxZoom" step="0.01" [value]="zoom()" (input)="setZoom(+$any($event.target).value)" />
      </label>
      <small>Drag the photo to reposition it.</small>

      @if (failed()) {
        <p class="err">This image could not be opened. Pick another one.</p>
      }

      <div class="actions">
        <button type="button" class="ghost" (click)="cancelled.emit()">Cancel</button>
        <button type="button" class="ok" [disabled]="!ready() || busy()" (click)="confirm()">
          {{ busy() ? 'Working…' : 'Use photo' }}
        </button>
      </div>
    </div>
  `,
  styles: `
    :host {
      /* The app shell zooms the whole UI on phones/tablets (--z: 1.6 / 1.25); undo it here so the sizes
         below mean real pixels and fitBox() matches what is on screen. */
      zoom: calc(1 / var(--z, 1));
      position: fixed;
      inset: 0;
      z-index: 60;
      display: grid;
      place-items: center;
    }
    .back {
      position: absolute;
      inset: 0;
      background: rgba(13, 13, 15, 0.7);
    }
    .dlg {
      position: relative;
      display: grid;
      gap: 10px;
      justify-items: center;
      box-sizing: border-box;
      width: min(calc(100vw - 16px), 340px);
      max-height: calc(100dvh - 16px);
      overflow-y: auto;
      padding: 16px;
      background: var(--pm-paper, #fff);
      color: var(--pm-ink, #0d0d0f); /* the shell sets white text; this dialog is light */
      border: 2px solid var(--pm-ink, #0d0d0f);
      box-shadow: 6px 6px 0 var(--pm-red, #e4182c);
      outline: none;
    }
    h2 {
      margin: 0;
      font: 800 14px/1 var(--pm-font-ui);
      text-transform: uppercase;
      letter-spacing: 0.06em;
    }
    .stage {
      box-sizing: content-box; /* the box size is the photo area, border excluded */
      position: relative;
      overflow: hidden;
      background: #111;
      cursor: grab;
      touch-action: none;
      user-select: none;
      border: 2px solid var(--pm-ink, #0d0d0f);
    }
    .stage:active {
      cursor: grabbing;
    }
    img {
      position: absolute;
      max-width: none;
      pointer-events: none;
    }
    .grid {
      position: absolute;
      inset: 0;
      pointer-events: none;
      background:
        linear-gradient(to right, transparent 33%, rgba(255, 255, 255, 0.35) 33% 33.5%, transparent 33.5% 66%, rgba(255, 255, 255, 0.35) 66% 66.5%, transparent 66.5%),
        linear-gradient(to bottom, transparent 33%, rgba(255, 255, 255, 0.35) 33% 33.5%, transparent 33.5% 66%, rgba(255, 255, 255, 0.35) 66% 66.5%, transparent 66.5%);
    }
    .zoom {
      display: grid;
      grid-template-columns: auto 1fr;
      align-items: center;
      gap: 8px;
      width: 100%;
      font: 700 9px/1 var(--pm-font-ui);
      text-transform: uppercase;
    }
    .zoom input {
      width: 100%;
      min-height: 28px; /* easier to grab with a thumb */
      accent-color: var(--pm-red, #e4182c);
    }
    small {
      color: #666;
      font: 500 9px/1.3 var(--pm-font-ui);
    }
    .err {
      margin: 0;
      color: var(--pm-red, #e4182c);
      font: 700 9px/1.3 var(--pm-font-ui);
    }
    .actions {
      display: flex;
      gap: 8px;
      justify-content: flex-end;
      width: 100%;
    }
    button {
      min-height: 40px;
      padding: 8px 16px;
      border: 2px solid var(--pm-ink, #0d0d0f);
      font: 800 10px/1 var(--pm-font-ui);
      text-transform: uppercase;
      cursor: pointer;
    }
    .ghost {
      background: transparent;
    }
    .ok {
      background: var(--pm-red, #e4182c);
      color: #fff;
    }
    .ok:disabled {
      opacity: 0.5;
      cursor: default;
    }
  `,
})
export class PmAvatarCropper implements OnInit, OnDestroy {
  file = input.required<File>();
  cropped = output<File>();
  cancelled = output<void>();

  /** Side of the crop window in px, fitted to the screen (see fitBox). */
  box = signal(fitBox());
  readonly maxZoom = MAX_ZOOM;

  src = signal<string | null>(null);
  natW = signal(1);
  natH = signal(1);
  zoom = signal(1);
  offX = signal(0);
  offY = signal(0);
  ready = signal(false);
  failed = signal(false);
  busy = signal(false);

  private base = computed(() => coverScale(this.natW(), this.natH(), this.box()));
  scale = computed(() => this.base() * this.zoom());

  private img: HTMLImageElement | null = null;
  private drag: { id: number; x: number; y: number } | null = null;

  ngOnInit(): void {
    const url = URL.createObjectURL(this.file());
    const img = new Image();

    img.onload = () => {
      this.img = img;
      this.natW.set(img.naturalWidth);
      this.natH.set(img.naturalHeight);
      this.zoom.set(1);
      // Start centred.
      this.offX.set((this.box() - img.naturalWidth * this.scale()) / 2);
      this.offY.set((this.box() - img.naturalHeight * this.scale()) / 2);
      this.src.set(url);
      this.ready.set(true);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      this.failed.set(true);
    };
    img.src = url;
  }

  ngOnDestroy(): void {
    const url = this.src();
    if (url) URL.revokeObjectURL(url);
  }

  down(e: PointerEvent): void {
    if (!this.ready()) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    this.drag = { id: e.pointerId, x: e.clientX, y: e.clientY };
  }

  move(e: PointerEvent): void {
    if (!this.drag || this.drag.id !== e.pointerId) return;

    const dx = e.clientX - this.drag.x;
    const dy = e.clientY - this.drag.y;
    this.drag = { id: e.pointerId, x: e.clientX, y: e.clientY };

    this.offX.set(clampOffset(this.offX() + dx, this.natW() * this.scale(), this.box()));
    this.offY.set(clampOffset(this.offY() + dy, this.natH() * this.scale(), this.box()));
  }

  up(e: PointerEvent): void {
    if (this.drag?.id === e.pointerId) this.drag = null;
  }

  wheel(e: WheelEvent): void {
    e.preventDefault();
    this.setZoom(this.zoom() * (e.deltaY < 0 ? 1.08 : 0.92));
  }

  /** Phone rotated or window resized: refit the box and keep showing the same part of the photo. */
  onResize(): void {
    const next = fitBox();
    const old = this.box();
    if (next === old) return;

    if (!this.ready()) {
      this.box.set(next);
      return;
    }

    const oldScale = this.scale();
    const centreX = (old / 2 - this.offX()) / oldScale;
    const centreY = (old / 2 - this.offY()) / oldScale;

    this.box.set(next); // the cover scale follows the new box
    const scale = this.scale();

    this.offX.set(clampOffset(next / 2 - centreX * scale, this.natW() * scale, next));
    this.offY.set(clampOffset(next / 2 - centreY * scale, this.natH() * scale, next));
  }

  setZoom(value: number): void {
    if (!this.ready()) return;

    const next = Math.min(MAX_ZOOM, Math.max(1, value));
    const oldScale = this.scale();
    const newScale = this.base() * next;

    this.zoom.set(next);
    const box = this.box();
    this.offX.set(clampOffset(zoomOffset(this.offX(), oldScale, newScale, box), this.natW() * newScale, box));
    this.offY.set(clampOffset(zoomOffset(this.offY(), oldScale, newScale, box), this.natH() * newScale, box));
  }

  confirm(): void {
    const img = this.img;
    if (!img || this.busy()) return;
    this.busy.set(true);

    const { sx, sy, size } = sourceRect(this.offX(), this.offY(), this.scale(), this.box());
    const canvas = document.createElement('canvas');
    canvas.width = OUTPUT;
    canvas.height = OUTPUT;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      this.busy.set(false);
      this.failed.set(true);
      return;
    }
    ctx.fillStyle = '#fff'; // PNG transparency becomes white instead of black in the JPEG
    ctx.fillRect(0, 0, OUTPUT, OUTPUT);
    ctx.drawImage(img, sx, sy, size, size, 0, 0, OUTPUT, OUTPUT);

    canvas.toBlob(
      (blob) => {
        this.busy.set(false);
        if (!blob) {
          this.failed.set(true);
          return;
        }
        this.cropped.emit(new File([blob], 'avatar.jpg', { type: 'image/jpeg' }));
      },
      'image/jpeg',
      0.88,
    );
  }
}