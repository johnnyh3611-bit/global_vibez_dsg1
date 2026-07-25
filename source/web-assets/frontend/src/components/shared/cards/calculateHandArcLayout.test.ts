import { calculateHandArcLayout } from "./calculateHandArcLayout";

describe("calculateHandArcLayout", () => {
  it("fans 13 cards within viewport with arc span", () => {
    const layout = calculateHandArcLayout({
      viewportWidth: 390,
      handSize: 13,
    });
    expect(layout.slots).toHaveLength(13);
    expect(layout.cardSize).toBe("sm");
    expect(layout.slots[0].angleDeg).toBeLessThan(0);
    expect(layout.slots[12].angleDeg).toBeGreaterThan(0);
    expect(layout.slots[0].marginLeft).toBe(0);
    expect(layout.slots[1].marginLeft).toBeLessThan(0);
  });

  it("uses md cards for short hands on desktop", () => {
    const layout = calculateHandArcLayout({
      viewportWidth: 1024,
      handSize: 5,
    });
    expect(layout.cardSize).toBe("md");
    expect(layout.cardWidth).toBe(72);
  });
});
