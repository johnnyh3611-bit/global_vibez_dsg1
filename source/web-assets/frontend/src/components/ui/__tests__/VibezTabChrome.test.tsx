import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { VibezTabChrome } from "../VibezTabChrome";

describe("VibezTabChrome", () => {
  it("shows the tab title and a labeled Close control", () => {
    render(<VibezTabChrome title="Quick Access" onClose={() => {}} />);
    expect(screen.getByText("Quick Access")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Close" })).toBeVisible();
  });

  it("stops propagation when Close is clicked", () => {
    const onClose = jest.fn();
    const parentClick = jest.fn();
    render(
      <div onClick={parentClick}>
        <VibezTabChrome
          title="Chat"
          onClose={onClose}
          closeTestId="chrome-close"
        />
      </div>
    );
    fireEvent.click(screen.getByTestId("chrome-close"));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(parentClick).not.toHaveBeenCalled();
  });
});
