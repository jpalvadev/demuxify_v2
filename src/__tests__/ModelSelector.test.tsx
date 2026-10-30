import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ModelSelector } from "../components/ModelSelector";
import { BS_ROFORMER_PROFILE } from "../lib/modelConfig";

describe("ModelSelector Component", () => {
  it("renders desktop selector with Studio and Fast options and allows toggling", () => {
    const handleSelect = vi.fn();
    render(
      <ModelSelector
        selectedModelId="bs-roformer-4stem"
        onSelectModel={handleSelect}
        isMobile={false}
      />
    );

    // Verify presence of Studio and Fast options
    expect(screen.getAllByText(/studio/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/bs-roformer 4-stem/i)).toBeInTheDocument();
    expect(screen.getAllByText(/fast/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/mdx-net 4-stem/i)).toBeInTheDocument();

    // Verify download size indications
    expect(screen.getByText(/~270 MB/i)).toBeInTheDocument();
    expect(screen.getByText(/~45 MB/i)).toBeInTheDocument();

    // Click Fast / MDX-Net option
    const fastOption = screen.getByRole("radio", { name: /fast/i });
    fireEvent.click(fastOption);
    expect(handleSelect).toHaveBeenCalledWith("mdx-net-4stem");
  });

  it("locks model selection on mobile devices and displays device protection advisory", () => {
    const handleSelect = vi.fn();
    render(
      <ModelSelector
        selectedModelId="mdx-net-4stem"
        onSelectModel={handleSelect}
        isMobile={true}
      />
    );

    // Advisory banner should be visible
    expect(
      screen.getByText(/mobile-optimized model active/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/preserve memory and prevent browser crashes/i)
    ).toBeInTheDocument();

    // Model options should not allow switching to desktop model or should indicate locked
    const desktopOption = screen.queryByRole("radio", { name: /studio/i });
    if (desktopOption) {
      expect(desktopOption).toBeDisabled();
    }
  });

  it("displays trade-off explanations clearly for active model", () => {
    render(
      <ModelSelector
        selectedModelId="bs-roformer-4stem"
        onSelectModel={vi.fn()}
        isMobile={false}
      />
    );

    expect(
      screen.getByText(BS_ROFORMER_PROFILE.explanation)
    ).toBeInTheDocument();
  });
});
