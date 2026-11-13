import { clampOffset, coverScale, sourceRect, zoomOffset } from './crop-math';

describe('crop math', () => {
  it('covers the box on the short side', () => {
    expect(coverScale(1000, 500, 250)).toBe(0.5); // wide photo: height must reach 250
    expect(coverScale(400, 800, 200)).toBe(0.5); // tall photo: width must reach 200
  });

  it('never lets the image leave a gap', () => {
    expect(clampOffset(40, 500, 250)).toBe(0); // dragged too far right
    expect(clampOffset(-400, 500, 250)).toBe(-250); // dragged too far left
    expect(clampOffset(-100, 500, 250)).toBe(-100);
  });

  it('keeps the centre in place while zooming', () => {
    const before = sourceRect(-50, -20, 1, 200);
    const off = (o: number) => zoomOffset(o, 1, 2, 200);
    const after = sourceRect(off(-50), off(-20), 2, 200);
    expect(after.sx + after.size / 2).toBeCloseTo(before.sx + before.size / 2);
    expect(after.sy + after.size / 2).toBeCloseTo(before.sy + before.size / 2);
  });

  it('maps the box back to source pixels', () => {
    expect(sourceRect(-100, -50, 0.5, 250)).toEqual({ sx: 200, sy: 100, size: 500 });
  });
});
