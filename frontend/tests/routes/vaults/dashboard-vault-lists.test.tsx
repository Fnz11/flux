import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { makePosition, makeVault } from "./fixtures";

const mocks = vi.hoisted(() => ({
  positions: [] as ReturnType<typeof makePosition>[],
  vaultQuery: { data: [] as ReturnType<typeof makeVault>[], isLoading: false },
}));

vi.mock("@tanstack/react-router", () => ({
  Link: ({
    children,
    to,
    params,
  }: {
    children: React.ReactNode;
    to: string;
    params?: { id: string };
  }) => <a href={params ? to.replace("$id", params.id) : to}>{children}</a>,
}));

vi.mock("../../../src/stores", () => ({
  usePortfolioStore: (selector: (state: { positions: unknown[] }) => unknown) =>
    selector({ positions: mocks.positions }),
}));
vi.mock("../../../src/services/hooks/useQuery/useVaultsQuery", () => ({
  useVaultsQuery: () => mocks.vaultQuery,
}));
vi.mock("../../../src/services/hooks/useQuery/useVaultSparklineQuery", () => ({
  useVaultSparklineQuery: () => ({ data: [1, 2, 3] }),
}));

import { InvestorVaultsList } from "../../../src/routes/_components/InvestorVaultsList";
import { ManagerVaultsList } from "../../../src/routes/_components/ManagerVaultsList";

describe("InvestorVaultsList", () => {
  beforeEach(() => {
    mocks.positions = [];
  });

  it("renders empty state and explore link", () => {
    render(<InvestorVaultsList />);
    expect(screen.getByText("No Active Investments")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Explore Vaults" }),
    ).toHaveAttribute("href", "/vaults");
  });

  it("renders populated investment values", () => {
    mocks.positions = [makePosition()];
    render(<InvestorVaultsList />);
    expect(screen.getByText("Alpha Vault")).toBeInTheDocument();
    expect(screen.getByText("12.3456")).toBeInTheDocument();
    expect(screen.getByText("$1,400.00")).toBeInTheDocument();
    expect(screen.getByText("+40.00%")).toBeInTheDocument();
  });

  it("sorts by column header click", () => {
    mocks.positions = [
      makePosition({
        vaultId: "low",
        vaultName: "Low PNL",
        currentValue: 500,
        pnlPercent: 1,
      }),
      makePosition({
        vaultId: "high",
        vaultName: "High PNL",
        currentValue: 100,
        pnlPercent: 90,
      }),
    ];
    render(<InvestorVaultsList />);
    fireEvent.click(screen.getByText("PNL"));
    const rows = screen.getAllByRole("row").slice(1);
    expect(within(rows[0]).getByText("High PNL")).toBeInTheDocument();
  });
});

describe("ManagerVaultsList", () => {
  beforeEach(() => {
    mocks.vaultQuery = { data: [], isLoading: false };
  });

  it("renders loading state", () => {
    mocks.vaultQuery.isLoading = true;
    const { container } = render(<ManagerVaultsList />);
    expect(container.querySelector(".animate-pulse")).toBeInTheDocument();
  });

  it("renders empty state and creation links", () => {
    render(<ManagerVaultsList />);
    expect(screen.getByText("No Vaults Created Yet")).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /Create/ })).toHaveLength(2);
  });

  it("filters managed vaults case-insensitively", () => {
    mocks.vaultQuery.data = [
      makeVault({
        id: "mine",
        managerAddress: "ABC",
        metadata: { displayName: "Mine", description: "", focusAssets: [] },
      }),
      makeVault({
        id: "other",
        managerAddress: "XYZ",
        metadata: { displayName: "Other", description: "", focusAssets: [] },
      }),
    ];
    render(<ManagerVaultsList walletAddress="abc" />);
    expect(screen.getByText("Mine")).toBeInTheDocument();
    expect(screen.queryByText("Other")).not.toBeInTheDocument();
  });

  it("renders populated manager metrics and details link", () => {
    mocks.vaultQuery.data = [makeVault()];
    render(<ManagerVaultsList />);
    expect(screen.getByText("$125,000.00")).toBeInTheDocument();
    expect(screen.getByText("+12.34%")).toBeInTheDocument();
    expect(
      screen
        .getAllByRole("link")
        .some((link) => link.getAttribute("href") === "/vaults/vault-1"),
    ).toBe(true);
  });
});
