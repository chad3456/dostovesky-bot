import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SettingsPanel } from "@/components/reader/settings-panel";
import type { Preferences } from "@/lib/types";

const PREFS: Preferences = {
  theme: "light",
  fontFamily: "serif",
  fontSize: 18,
  lineHeight: 1.6,
  margin: 24,
  justify: true,
  flow: "paginated",
};

describe("SettingsPanel", () => {
  it("increases font size when the + control is clicked", () => {
    const onChange = vi.fn();
    render(<SettingsPanel prefs={PREFS} onChange={onChange} onClose={() => {}} />);
    fireEvent.click(screen.getByLabelText("Increase Font size"));
    expect(onChange).toHaveBeenCalledWith({ fontSize: 19 });
  });

  it("switches theme when a theme swatch is clicked", () => {
    const onChange = vi.fn();
    render(<SettingsPanel prefs={PREFS} onChange={onChange} onClose={() => {}} />);
    fireEvent.click(screen.getByLabelText("Dark"));
    expect(onChange).toHaveBeenCalledWith({ theme: "dark" });
  });

  it("toggles justify off", () => {
    const onChange = vi.fn();
    render(<SettingsPanel prefs={PREFS} onChange={onChange} onClose={() => {}} />);
    fireEvent.click(screen.getByRole("switch"));
    expect(onChange).toHaveBeenCalledWith({ justify: false });
  });

  it("changes layout flow to scrolled", () => {
    const onChange = vi.fn();
    render(<SettingsPanel prefs={PREFS} onChange={onChange} onClose={() => {}} />);
    fireEvent.click(screen.getByText("Scroll"));
    expect(onChange).toHaveBeenCalledWith({ flow: "scrolled" });
  });
});
