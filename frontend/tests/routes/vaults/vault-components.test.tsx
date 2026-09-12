import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeVault } from "./fixtures";

const mocks = vi.hoisted(() => ({
  sparkline: [1, 2, 3] as number[] | undefined,
}));

vi.mock("@tanstack/react-router", () => ({
  Link: ({
    children,
    to,
    params,
    search,
  }: {
    children: React.ReactNode;
    to: string;
    params?: { id: string };
    search?: { vaultId: string };
  }) => {
    const href = params
      ? to.replace("$id", params.id)
      : search
        ? `${to}?vaultId=${search.vaultId}`
        : to;
    return <a href={href}>{children}</a>;
  },
}));

vi.mock("../../../src/services/hooks/useQuery/useVaultSparklineQuery", () => ({
  useVaultSparklineQuery: () => ({ data: mocks.sparkline }),
}));

vi.mock("@solana/wallet-adapter-react", () => ({
  useWallet: () => ({
    publicKey: { toBase58: () => "ManagerAddress1111222233334444" },
    connected: true,
  }),
}));

vi.mock("../../../src/components/ui/tooltip", () => ({
  TooltipProvider: ({ children }: { children: React.ReactNode }) => children,
  Tooltip: ({ children }: { children: React.ReactNode }) => children,
}));

import { VaultCard } from "../../../src/routes/vaults/_components/VaultCard";
import { VaultSparkline } from "../../../src/routes/vaults/_components/VaultSparkline";
import { VaultsTable } from "../../../src/routes/vaults/_components/VaultsTable";

describe("VaultsTable", () => {
  beforeEach(() => {
    mocks.sparkline = [1, 2, 3];
  });

  it("renders formatted vault values", () => {
    render(<VaultsTable vaults={[makeVault()]} onSort={vi.fn()} />);
    expect(screen.getByText("Alpha Vault")).toBeInTheDocument();
    expect(screen.getByText("by Mana...4444")).toBeInTheDocument();
    expect(screen.getByText("$5,000 USD")).toBeInTheDocument();
    expect(screen.getByText("42")).toBeInTheDocument();
    expect(screen.getByText("Jan 15, 2026")).toBeInTheDocument();
  });

  it("uses fallback name, assets, and minimum", () => {
    const vault = makeVault({
      metadata: { displayName: "", description: "", focusAssets: [] },
      minRaiseAmount: 0,
      investorCount: undefined,
    });
    render(<VaultsTable vaults={[vault]} onSort={vi.fn()} />);
    expect(screen.getByText("Vault Vaul...4444")).toBeInTheDocument();
    expect(screen.getByText("$1 USD")).toBeInTheDocument();
    expect(screen.getByText("SOL")).toBeInTheDocument();
    expect(screen.getByText("USDC")).toBeInTheDocument();
  });

  it("formats negative PNL without plus sign", () => {
    render(
      <VaultsTable
        vaults={[makeVault({ pnlPercent: -3.456 })]}
        onSort={vi.fn()}
      />,
    );
    expect(screen.getByText("-3.46%")).toHaveClass("text-status-error");
  });

  it("sorts by click", () => {
    const onSort = vi.fn();
    render(<VaultsTable vaults={[makeVault()]} onSort={onSort} />);
    fireEvent.click(screen.getByRole("columnheader", { name: /INVESTORS/ }));
    expect(onSort).toHaveBeenCalledWith("investors");
  });

  it.each(["Enter", " "])("sorts by %s keyboard activation", (key) => {
    const onSort = vi.fn();
    render(<VaultsTable vaults={[makeVault()]} onSort={onSort} />);
    fireEvent.keyDown(screen.getByRole("columnheader", { name: /CREATED/ }), {
      key,
    });
    expect(onSort).toHaveBeenCalledWith("created_at");
  });

  it("exposes active sort direction", () => {
    render(
      <VaultsTable
        vaults={[makeVault()]}
        sortBy="pnl"
        sortOrder="asc"
        onSort={vi.fn()}
      />,
    );
    expect(screen.getByRole("columnheader", { name: /PNL/ })).toHaveAttribute(
      "aria-sort",
      "ascending",
    );
  });

  it("links each action to vault details", () => {
    render(<VaultsTable vaults={[makeVault()]} onSort={vi.fn()} />);
    const vaultLink = screen
      .getAllByRole("link")
      .find((el) => el.getAttribute("href")?.startsWith("/vaults/"));
    expect(vaultLink).toHaveAttribute("href", "/vaults/vault-1");
  });

  it("renders sparkline fallback when query has no points", () => {
    mocks.sparkline = undefined;
    const { container } = render(
      <VaultsTable vaults={[makeVault()]} onSort={vi.fn()} />,
    );
    expect(container.querySelector("polyline")).toBeInTheDocument();
  });
});

describe("VaultSparkline", () => {
  it("renders positive and negative chart colors", () => {
    const { container, rerender } = render(<VaultSparkline data={[3, 4, 2]} />);
    expect(container.querySelector("polyline")).toHaveAttribute(
      "stroke",
      "#10B981",
    );
    rerender(<VaultSparkline data={[3, 2, 1]} isPositive={false} />);
    expect(container.querySelector("polyline")).toHaveAttribute(
      "stroke",
      "#EF4444",
    );
  });
});

describe("VaultCard", () => {
  it("renders metrics and total fees", () => {
    render(<VaultCard vault={makeVault()} />);
    expect(screen.getByText("1500 BPS")).toBeInTheDocument();
    expect(screen.getByText("1700 BPS")).toBeInTheDocument();
    expect(screen.getByText(/125\.00K/)).toBeInTheDocument();
    expect(screen.getByText("USD")).toBeInTheDocument();
  });

  it("renders edit, trade, and view destinations", () => {
    render(<VaultCard vault={makeVault()} />);
    expect(screen.getByRole("link", { name: "Edit" })).toHaveAttribute(
      "href",
      "/vaults/vault-1/edit",
    );
    expect(screen.getByRole("link", { name: "Trade" })).toHaveAttribute(
      "href",
      "/trade?vaultId=vault-1",
    );
    expect(screen.getByRole("link", { name: "View" })).toHaveAttribute(
      "href",
      "/vaults/vault-1",
    );
  });

  it("uses ID fallback title", () => {
    render(
      <VaultCard
        vault={makeVault({
          metadata: { displayName: "", description: "", focusAssets: [] },
        })}
      />,
    );
    expect(
      within(screen.getByText("Vault vault-1").closest("div")!).getByText(
        "Active",
      ),
    ).toBeInTheDocument();
  });
});
