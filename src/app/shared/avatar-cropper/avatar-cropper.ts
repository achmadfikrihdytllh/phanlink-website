import { Component, OnDestroy, OnInit, computed, input, output, signal } from '@angular/core';

import { clampOffset, coverScale, sourceRect, zoomOffset } from './crop-math';

/** Side of the square crop window on screen, and of the picture that gets uploaded. */
const BOX = 280;
const OUTPUT = 512;
const MAX_ZOOM = 4;

/**
 * Crop dialog for a profile photo: drag to move, slide or scroll to zoom, then "Use photo".
 * Emits a square JPEG (512x512), so avatars always look the same however the original was shaped.
 */
@Component({
  selector: 'pm-avatar-cropper',
  template: `
    <div class="back" (click)="cancelled.emit()"></div>
    <div class="dlg" role="dialog" aria-modal="true" aria-label="Crop photo" tabindex="-1" (keydown.escape)="cancelled.emit()">
      <h2>Crop photo</h2>

      <div
        class="stage"
        [style.width.px]="box"
        [style.height.px]="box"
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
      width: min(92vw, 340px);
      padding: 16px;
      background: var(--pm-paper, #fff);
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
      padding: 8px 14px;
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

  readonly box = BOX;
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

  private base = computed(() => coverScale(this.natW(), this.natH(), BOX));
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
      this.offX.set((BOX - img.naturalWidth * this.scale()) / 2);
      this.offY.set((BOX - img.naturalHeight * this.scale()) / 2);
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

    this.offX.set(clampOffset(this.offX() + dx, this.natW() * this.scale(), BOX));
    this.offY.set(clampOffset(this.offY() + dy, this.natH() * this.scale(), BOX));
  }

  up(e: PointerEvent): void {
    if (this.drag?.id === e.pointerId) this.drag = null;
  }

  wheel(e: WheelEvent): void {
    e.preventDefault();
    this.setZoom(this.zoom() * (e.deltaY < 0 ? 1.08 : 0.92));
  }

  setZoom(value: number): void {
    if (!this.ready()) return;

    const next = Math.min(MAX_ZOOM, Math.max(1, value));
    const oldScale = this.scale();
    const newScale = this.base() * next;

    this.zoom.set(next);
    this.offX.set(clampOffset(zoomOffset(this.offX(), oldScale, newScale, BOX), this.natW() * newScale, BOX));
    this.offY.set(clampOffset(zoomOffset(this.offY(), oldScale, newScale, BOX), this.natH() * newScale, BOX));
  }

  confirm(): void {
    const img = this.img;
    if (!img || this.busy()) return;
    this.busy.set(true);

    const { sx, sy, size } = sourceRect(this.offX(), this.offY(), this.scale(), BOX);
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
      0.9,
    );
  }
}
