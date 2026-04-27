import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";

import { Nav } from "./nav";

test("Nav links to home and Help", () => {
  render(<Nav />);
  expect(screen.getByRole("link", { name: "Alongside home" }).getAttribute("href")).toBe("/");
  expect(screen.getByRole("link", { name: "Help" }).getAttribute("href")).toBe("/help");
});
