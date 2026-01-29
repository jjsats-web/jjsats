import { render, screen } from "@testing-library/react";

import SummaryCard from "../SummaryCard";

describe("SummaryCard", () => {
  it("renders VAT label when vatIncluded is true", () => {
    render(
      <SummaryCard
        totals={{ subtotal: 1000, vat: 70, discount: 0, total: 1070 }}
        vatIncluded
      />,
    );

    expect(screen.getByText("VAT 7%")).toBeInTheDocument();
  });

  it("renders non-VAT label when vatIncluded is false", () => {
    render(
      <SummaryCard
        totals={{ subtotal: 1000, vat: 0, discount: 0, total: 1000 }}
        vatIncluded={false}
      />,
    );

    expect(screen.getByText("ไม่รวม VAT")).toBeInTheDocument();
  });
});
