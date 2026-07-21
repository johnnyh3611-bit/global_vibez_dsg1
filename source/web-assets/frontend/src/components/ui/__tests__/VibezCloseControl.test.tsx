import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { VibezCloseControl, vibezCloseControlClass } from "../VibezCloseControl";

describe("VibezCloseControl", () => {
  it("renders a visible Close label (not icon-only)", () => {
    render(<VibezCloseControl onClick={() => {}} />);
    expect(screen.getByRole("button", { name: "Close" })).toBeInTheDocument();
    expect(screen.getByText("Close")).toBeVisible();
  });

  it("supports contextual labels", () => {
    const onClick = jest.fn();
    render(
      <VibezCloseControl
        onClick={onClick}
        label="Close menu"
        testId="close-menu"
      />
    );
    const btn = screen.getByTestId("close-menu");
    expect(btn).toHaveTextContent("Close menu");
    fireEvent.click(btn);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("exports glass-style class tokens", () => {
    const cls = vibezCloseControlClass({ size: "sm" });
    expect(cls).toContain("rounded-xl");
    expect(cls).toContain("border-white/15");
    expect(cls).toContain("bg-white/5");
  });
});
