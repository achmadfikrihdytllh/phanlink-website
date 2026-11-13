import { fitWithin } from './image-shrink';

describe('fitWithin', () => {
  it('shrinks the longer side to the limit and keeps proportions', () => {
    expect(fitWithin(4000, 3000, 1600)).toEqual({ width: 1600, height: 1200 });
    expect(fitWithin(3000, 4000, 1600)).toEqual({ width: 1200, height: 1600 });
  });

  it('never enlarges a small image', () => {
    expect(fitWithin(800, 600, 1600)).toEqual({ width: 800, height: 600 });
  });

  it('never returns a zero side', () => {
    expect(fitWithin(5000, 1, 100)).toEqual({ width: 100, height: 1 });
  });
});
