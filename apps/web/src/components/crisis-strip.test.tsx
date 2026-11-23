import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";

import { CrisisStrip } from "./crisis-strip";

test("CrisisStrip renders the helpline link", () => {
  render(<CrisisStrip />);
  const link = screen.getByRole("link", {
    name: /call the alzheimer's association 24\/7 helpline/i,
  });
  expect(link.getAttribute("href")).toBe("tel:8002723900");
  expect(link.textContent).toContain("800-272-3900");
});
