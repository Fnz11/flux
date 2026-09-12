import type { WSEventHandler } from "./types";
import type { Vault, PortfolioPosition, ApiTrade, ApiTradeHistoryResponse } from "@/types";
import type { VaultBalance } from "@/services/apis/rest-api/vault.service";

export interface VaultPayload {
  vault_id?: string;
  vault_address?: string;
  vault_name?: string;
  tvl?: number | string;
  pnl_percent?: number | string;
  input_token?: string;
  output_token?: string;
  amount_in?: number | string;
  amount_out?: number | string;
  trade_type?: string;
  price_at_execution?: number | string;
  transaction_signature?: string;
  id?: string;
  actor_id?: string;
  executed_at?: string;
}

interface VaultDelta {
  tvl?: number;
  pnlPercent?: number;
  trades?: Array<{
    id?: string;
    vaultId?: string;
    actorId?: string;
    tradeType?: string;
    inputToken?: string;
    outputToken?: string;
    amountIn?: number;
    amountOut?: number;
    priceAtExecution?: number;
    transactionSignature?: string;
    executedAt?: string;
  }>;
}

export const vaultHandler: WSEventHandler<VaultPayload> = {
  types: ["vault_portfolio_update", "vault_update", "trade_confirmed"],

  handleBatch: (messages, { queryClient }) => {
    const updates = new Map<string, VaultDelta>();

    for (const msg of messages) {
      const data = msg.data;
      const key = data?.vault_address || data?.vault_id;
      if (!key) continue;

      const current = updates.get(key) || {};
      if (data.tvl !== undefined) {
        current.tvl = Number(data.tvl);
      }
      if (data.pnl_percent !== undefined) {
        current.pnlPercent = Number(data.pnl_percent);
      }
      if (data.input_token || data.output_token) {
        current.trades = current.trades || [];
        current.trades.push({
          id: data.id || `trade_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          vaultId: data.vault_id || key,
          actorId: data.actor_id || '',
          tradeType: data.trade_type || 'Buy',
          inputToken: data.input_token,
          outputToken: data.output_token,
          amountIn:
            data.amount_in !== undefined ? Number(data.amount_in) : undefined,
          amountOut:
            data.amount_out !== undefined ? Number(data.amount_out) : undefined,
          priceAtExecution:
            data.price_at_execution !== undefined
              ? Number(data.price_at_execution)
              : undefined,
          transactionSignature: data.transaction_signature || '',
          executedAt: data.executed_at || new Date().toISOString(),
        });
      }
      updates.set(key, current);
      if (data.vault_id && data.vault_id !== key) {
        updates.set(data.vault_id, current);
      }
    }

    if (updates.size === 0) return;

    // 1. Mutate list of vaults cache in-memory
    queryClient.setQueriesData<Vault[]>(
      { queryKey: ["vaults"] },
      (oldVaults) => {
        if (!oldVaults) return oldVaults;
        let changed = false;

        const next = oldVaults.map((vault) => {
          const delta =
            updates.get(vault.address) ||
            (vault.id ? updates.get(vault.id) : undefined);
          if (!delta) return vault;

          changed = true;
          return {
            ...vault,
            tvl: delta.tvl !== undefined ? delta.tvl : vault.tvl,
            pnlPercent:
              delta.pnlPercent !== undefined
                ? delta.pnlPercent
                : vault.pnlPercent,
          };
        });

        return changed ? next : oldVaults;
      },
    );

    // 2. Mutate individual vault query cache in-memory
    queryClient.setQueriesData<Vault>({ queryKey: ["vault"] }, (oldVault) => {
      if (!oldVault) return oldVault;
      const delta =
        updates.get(oldVault.address) ||
        (oldVault.id ? updates.get(oldVault.id) : undefined);
      if (!delta) return oldVault;

      return {
        ...oldVault,
        tvl: delta.tvl !== undefined ? delta.tvl : oldVault.tvl,
        pnlPercent:
          delta.pnlPercent !== undefined
            ? delta.pnlPercent
            : oldVault.pnlPercent,
      };
    });

    // 3. Mutate user's connected positions in-memory (Shares Owned, Current Valuation, Unrealized PnL)
    queryClient.setQueriesData<PortfolioPosition[]>(
      { queryKey: ["portfolio"] },
      (oldPositions) => {
        if (!oldPositions || oldPositions.length === 0) return oldPositions;
        let changed = false;

        const next = oldPositions.map((pos) => {
          const delta =
            (pos.vaultAddress ? updates.get(pos.vaultAddress) : undefined) ||
            (pos.vaultId ? updates.get(pos.vaultId) : undefined);
          if (!delta) return pos;

          changed = true;
          let updatedPnlPercent = pos.pnlPercent || 0;
          if (delta.pnlPercent !== undefined) {
            updatedPnlPercent = Number(delta.pnlPercent);
          }

          const totalInvested = pos.totalInvested || 0;
          let updatedCurrentValue = pos.currentValue || 0;
          let updatedPnl = pos.pnl || 0;

          if (totalInvested > 0) {
            updatedPnl = (totalInvested * updatedPnlPercent) / 100;
            updatedCurrentValue = Math.max(0, totalInvested + updatedPnl);
          }

          return {
            ...pos,
            currentValue: updatedCurrentValue,
            pnl: updatedPnl,
            pnlPercent: updatedPnlPercent,
          };
        });

        return changed ? next : oldPositions;
      },
    );

    // 4. Mutate vault asset holdings in-memory without REST refetch
    for (const [key, delta] of updates.entries()) {
      queryClient.setQueriesData<VaultBalance[]>(
        { queryKey: ["vaultBalances", key] },
        (oldBalances) => {
          if (!oldBalances || oldBalances.length === 0) return oldBalances;

          let balances = [...oldBalances];

          if (delta.trades && delta.trades.length > 0) {
            for (const trade of delta.trades) {
              if (trade.inputToken && trade.amountIn) {
                const idx = balances.findIndex(
                  (b) =>
                    b.symbol?.toLowerCase() === trade.inputToken?.toLowerCase(),
                );
                if (idx >= 0) {
                  balances[idx] = {
                    ...balances[idx],
                    amount: Math.max(0, balances[idx].amount - trade.amountIn),
                  };
                }
              }
              if (trade.outputToken && trade.amountOut) {
                const idx = balances.findIndex(
                  (b) =>
                    b.symbol?.toLowerCase() ===
                    trade.outputToken?.toLowerCase(),
                );
                if (idx >= 0) {
                  balances[idx] = {
                    ...balances[idx],
                    amount: balances[idx].amount + trade.amountOut,
                  };
                }
              }
            }
          }

          if (delta.tvl !== undefined && delta.tvl > 0) {
            const prevTotalUsd = balances.reduce(
              (sum, b) => sum + (b.usdValue || 0),
              0,
            );
            if (prevTotalUsd > 0) {
              const ratio = delta.tvl / prevTotalUsd;
              balances = balances.map((b) => ({
                ...b,
                usdValue: b.usdValue * ratio,
              }));
            }
          }

          return balances;
        },
      );

      // 5. Mutate vault trade history cache in-memory without REST refetch
      if (delta.trades && delta.trades.length > 0) {
        queryClient.setQueriesData<ApiTradeHistoryResponse | { trades?: ApiTrade[] }>(
          { queryKey: ["trades", key] },
          (oldTrades) => {
            if (!oldTrades) return oldTrades;
            const existingTrades = Array.isArray((oldTrades as any).trades)
              ? (oldTrades as any).trades
              : Array.isArray(oldTrades)
                ? (oldTrades as any)
                : [];

            const newTrades: ApiTrade[] = (delta.trades || []).map((t) => ({
              id: t.id || `trade_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
              vault_id: t.vaultId || key,
              actor_id: t.actorId || '',
              transaction_signature: t.transactionSignature || '',
              trade_type: (t.tradeType as any) || 'Buy',
              input_token: t.inputToken || '',
              output_token: t.outputToken || '',
              amount_in: t.amountIn || 0,
              amount_out: t.amountOut || 0,
              price_at_execution: t.priceAtExecution || 0,
              executed_at: t.executedAt || new Date().toISOString(),
            }));

            const combined = [...newTrades, ...existingTrades];
            if ('trades' in (oldTrades as any)) {
              return {
                ...(oldTrades as any),
                trades: combined,
              };
            }
            return combined as any;
          },
        );
      }
    }
  },
};
