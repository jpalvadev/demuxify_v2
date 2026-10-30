import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ModelSelector } from "../components/ModelSelector";
import { BS_ROFORMER_PROFILE } from "../lib/modelConfig";

describe("ModelSelector Component", () => {
  it("renders desktop selector with 3 profiles (Studio, Balanced, Ultra Fast) and allows toggling", () => {
    const handleSelect = vi.fn();
    render(
      <ModelSelector
        selectedModelId="bs-roformer-4stem"
        onSelectModel={handleSelect}
        isMobile={false}
      />
    );

    // Verify presence of Studio, Balanced, and Ultra Fast options
    expect(screen.getAllByText(/studio/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/bs-roformer 4-stem/i)).toBeInTheDocument();
    expect(screen.getAllByText(/balanced/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/ht-demucs 4-stem/i)).toBeInTheDocument();
    expect(screen.getAllByText(/ultra fast/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/open-unmix 4-stem/i)).toBeInTheDocument();

    // Verify download size indications
    expect(screen.getByText(/~270 MB/i)).toBeInTheDocument();
    expect(screen.getByText(/~54 MB/i)).toBeInTheDocument();
    expect(screen.getByText(/~35 MB/i)).toBeInTheDocument();

    // Click Ultra Fast / Open-Unmix option
    const ultraFastOption = screen.getByRole("radio", { name: /ultra fast/i });
    fireEvent.click(ultraFastOption);
    expect(handleSelect).toHaveBeenCalledWith("open-unmix-4stem");

    // Click Balanced / HT-Demucs option
    const balancedOption = screen.getByRole("radio", { name: /balanced/i });
    fireEvent.click(balancedOption);
    expect(handleSelect).toHaveBeenCalledWith("htdemucs-4stem");
  });

  it("displays device protection advisory on mobile and allows choosing between mobile profiles", () => {
    const handleSelect = vi.fn();
    render(
      <ModelSelector
        selectedModelId="open-unmix-4stem"
        onSelectModel={handleSelect}
        isMobile={true}
      />
    );

    // Advisory banner should be visible for mobile-friendly profile
    expect(
      screen.getByText(/mobile-optimized model active/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/preserve memory and prevent browser crashes/i)
    ).toBeInTheDocument();

    // Radio options should be interactive on mobile
    const balancedOption = screen.getByRole("radio", { name: /balanced/i });
    fireEvent.click(balancedOption);
    expect(handleSelect).toHaveBeenCalledWith("htdemucs-4stem");
  });

  it("displays warning advisory when Studio profile is selected on mobile", () => {
    render(
      <ModelSelector
        selectedModelId="bs-roformer-4stem"
        onSelectModel={vi.fn()}
        isMobile={true}
      />
    );

    expect(
      screen.getByText(/studio profile on mobile warning/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/studio mode requires ~1\.5 gb memory/i)
    ).toBeInTheDocument();
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
