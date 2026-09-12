import type { WSEventHandler } from "./types";
import type { PortfolioPosition } from "@/types";

export interface PortfolioPayload {
  wallet_address?: string;
  wallet?: string;
  vault_id?: string;
  pnl?: number | string;
  pnl_delta?: number | string;
}

export const portfolioHandler: WSEventHandler<PortfolioPayload> = {
  types: ["portfolio_update"],

  handleBatch: (messages, { queryClient }) => {
    if (messages.length === 0) return;

    for (const msg of messages) {
      const data = msg.data;
      if (!data) continue;

      const targetVault = data.vault_id;
      const pnlDelta =
        data.pnl_delta !== undefined ? Number(data.pnl_delta) : undefined;
      const absolutePnl = data.pnl !== undefined ? Number(data.pnl) : undefined;

      if (pnlDelta === undefined && absolutePnl === undefined) continue;

      queryClient.setQueriesData<PortfolioPosition[]>(
        { queryKey: ["portfolio"] },
        (oldPositions) => {
          if (!oldPositions || oldPositions.length === 0) return oldPositions;

          return oldPositions.map((pos) => {
            if (
              targetVault &&
              pos.vaultId !== targetVault &&
              pos.vaultAddress !== targetVault
            ) {
              return pos;
            }

            const delta =
              pnlDelta !== undefined ? pnlDelta : absolutePnl! - (pos.pnl || 0);
            const updatedPnl = (pos.pnl || 0) + delta;
            const updatedCurrentValue = Math.max(
              0,
              (pos.totalInvested || 0) + updatedPnl,
            );
            const updatedPnlPercent =
              pos.totalInvested > 0
                ? (updatedPnl / pos.totalInvested) * 100
                : 0;

            return {
              ...pos,
              currentValue: updatedCurrentValue,
              pnl: updatedPnl,
              pnlPercent: updatedPnlPercent,
            };
          });
        },
      );
    }
  },
};
