const add = (a: number, b: number): number => a + b;

describe('add', () => {
  it('should return 2', () => {
    expect(add(1, 1)).toBe(2);
  });
});
