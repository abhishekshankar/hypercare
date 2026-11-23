import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";

import { ScreenHeader } from "./screen-header";

test("ScreenHeader renders the title", () => {
  render(<ScreenHeader title="Home" />);
  expect(screen.getByRole("heading", { level: 1, name: "Home" })).toBeTruthy();
});
