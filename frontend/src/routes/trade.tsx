import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo, useEffect } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useVaultsQuery } from "@/services/hooks/useQuery/useVaultsQuery";
import { useTradeHistory } from "@/hooks/useTradeHistory";
import { PageHeader } from "@/components/ui/PageHeader";
import { SwapForm } from "./trade/_components/SwapForm";
import { VaultAssetsPanel } from "./trade/_components/VaultAssetsPanel";
import { TradeHistory } from "./portfolio/_components/TradeHistory";
import { generateMetadata } from "@/lib/metadata";
import { useRouteWsChannel } from "@/hooks/useRouteWsChannel";
import { useRealtimeSync } from "@/hooks/useRealtimeSync";
import { vaultHandler } from "@/services/ws/handlers/vaultHandler";
import { activityHandler } from "@/services/ws/handlers/activityHandler";
import { tradeSearchSchema } from "@/validations/trade";

export const Route = createFileRoute("/trade")({
  validateSearch: (search) => tradeSearchSchema.parse(search),
  head: () => ({
    meta: generateMetadata({
      title: "AMM Trade Console",
      description:
        "Execute high-precision Pyth Oracle AMM swaps directly on your Solana vaults.",
      path: "/trade",
      noIndex: true,
    }),
  }),
  component: TradePage,
});

export function TradePage() {
  const search = Route.useSearch();
  const wallet = useWallet();
  const walletAddress = wallet.publicKey?.toBase58() ?? "";

  const { data: fetchedVaults = [], isLoading: isFetchingVaults } =
    useVaultsQuery();

  // Filter vaults managed by current connected wallet, or fallback to all vaults for review
  const availableVaults = useMemo(() => {
    if (!walletAddress) return fetchedVaults;
    const managed = fetchedVaults.filter(
      (v) =>
        v.managerAddress &&
        v.managerAddress.toLowerCase() === walletAddress.toLowerCase() &&
        (v.status?.toLowerCase() === "active" ||
          v.status?.toLowerCase() === "fundraising"),
    );
    return managed.length > 0 ? managed : fetchedVaults;
  }, [fetchedVaults, walletAddress]);

  const [selectedVaultId, setSelectedVaultId] = useState<string>(
    search.vaultId ?? "",
  );

  useEffect(() => {
    if (search.vaultId) {
      setSelectedVaultId(search.vaultId);
    }
  }, [search.vaultId]);

  // Selected vault object
  const activeVault = useMemo(() => {
    if (selectedVaultId) {
      return availableVaults.find(
        (v) => v.id === selectedVaultId || v.address === selectedVaultId,
      );
    }
    return availableVaults[0];
  }, [availableVaults, selectedVaultId]);

  // Subscribe to real-time channels for active vault and trades
  const tradeChannels = useMemo(() => {
    const channels = ["global:trades", "global:activity"];
    if (walletAddress) channels.push(`portfolio:${walletAddress}`);
    if (activeVault?.id) {
      channels.push(
        `vault:${activeVault.id}:portfolio`,
        `vault:${activeVault.id}:activity`,
        `vault:${activeVault.id}`,
      );
    }
    if (activeVault?.address && activeVault.address !== activeVault.id) {
      channels.push(
        `vault:${activeVault.address}:portfolio`,
        `vault:${activeVault.address}:activity`,
        `vault:${activeVault.address}`,
      );
    }
    return channels;
  }, [activeVault, walletAddress]);

  useRouteWsChannel(tradeChannels, walletAddress);

  useRealtimeSync({
    handlers: [vaultHandler, activityHandler],
    walletAddress,
  });

  const vaultIds = useMemo(
    () => (activeVault ? [activeVault.id] : availableVaults.map((v) => v.id)),
    [activeVault, availableVaults],
  );
  const { trades, isLoading: tradesLoading } = useTradeHistory(vaultIds);

  return (
    <div className="space-y-6 pb-12 w-full relative">
      <PageHeader
        title="AMM Trade Console"
        subtitle="Execute high-speed on-chain swaps with Pyth real-time price feeds for your Solana vaults."
      />

      <div className="space-y-6">
        <div className="relative z-10">
          <SwapForm
            preselectedVaultId={activeVault?.id}
            vaults={availableVaults}
            isLoadingVaults={isFetchingVaults}
            onVaultChange={(id) => setSelectedVaultId(id)}
          />
        </div>

        <div className="flex flex-col gap-6">
          <VaultAssetsPanel
            vaultId={activeVault?.id}
            vaultName={activeVault?.metadata?.displayName}
            vaults={availableVaults}
            onVaultChange={(id) => setSelectedVaultId(id)}
          />

          <TradeHistory trades={trades} isLoading={tradesLoading} />
        </div>
      </div>
    </div>
  );
}
