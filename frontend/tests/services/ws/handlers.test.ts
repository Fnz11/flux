import { describe, it, expect, beforeEach } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import { vaultHandler } from "@/services/ws/handlers/vaultHandler";
import { portfolioSummaryHandler } from "@/services/ws/handlers/portfolioSummaryHandler";
import { activityHandler } from "@/services/ws/handlers/activityHandler";
import type { PortfolioSummaryResponse } from "@/services/apis/rest-api/portfolioSummary.service";
import type { GlobalTransactionsResponse } from "@/services/apis/rest-api/transactions.service";
import type { Vault } from "@/types";

describe("Modular WebSocket Event Handlers", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient();
  });

  describe("portfolioSummaryHandler", () => {
    it("updates total_pnl and current_value atomically on portfolio_summary_update delta", () => {
      queryClient.setQueryData<PortfolioSummaryResponse>(
        ["portfolio-summary"],
        {
          wallet: "wallet-1",
          vault_count: 5,
          total_invested: 1000,
          current_value: 1050,
          unrealized_pnl: 50,
          total_pnl: 50,
          pnl_percent: 5,
        },
      );

      portfolioSummaryHandler.handleBatch(
        [
          {
            type: "portfolio_summary_update",
            data: { pnl_delta: 25 },
            timestamp: Date.now(),
          },
        ],
        { queryClient, walletAddress: "wallet-1" },
      );

      const updated = queryClient.getQueryData<PortfolioSummaryResponse>([
        "portfolio-summary",
      ]);
      expect(updated?.total_pnl).toBe(75);
      expect(updated?.current_value).toBe(1075);
      expect(updated?.pnl_percent).toBe(7.5);
    });
  });

  describe("vaultHandler", () => {
    it("mutates vault TVL and PnL in cached vault list on vault_update", () => {
      const initialVaults: Vault[] = [
        {
          id: "v-1",
          address: "v-addr-1",
          name: "Vault 1",
          tvl: 10000,
          pnlPercent: 5,
        } as any,
      ];

      queryClient.setQueryData<Vault[]>(["vaults"], initialVaults);

      vaultHandler.handleBatch(
        [
          {
            type: "vault_update",
            data: {
              vault_id: "v-addr-1",
              tvl: 12500,
              pnl_percent: 8.5,
            },
            timestamp: Date.now(),
          },
        ],
        { queryClient },
      );

      const updated = queryClient.getQueryData<Vault[]>(["vaults"]);
      expect(updated?.[0].tvl).toBe(12500);
      expect(updated?.[0].pnlPercent).toBe(8.5);
    });

    it("mutates user portfolio positions in-memory when vault PnL changes", () => {
      queryClient.setQueryData(
        ["portfolio", "wallet-1"],
        [
          {
            vaultId: "v-1",
            vaultAddress: "v-addr-1",
            vaultName: "Vault 1",
            sharesOwned: 100,
            totalInvested: 1000,
            averageEntryPrice: 10,
            currentValue: 1000,
            pnl: 0,
            pnlPercent: 0,
          },
        ],
      );

      vaultHandler.handleBatch(
        [
          {
            type: "trade_confirmed",
            data: {
              vault_id: "v-1",
              vault_address: "v-addr-1",
              tvl: 12000,
              pnl_percent: 10,
            },
            timestamp: Date.now(),
          },
        ],
        { queryClient },
      );

      const positions = queryClient.getQueryData<any[]>([
        "portfolio",
        "wallet-1",
      ]);
      expect(positions?.[0].pnlPercent).toBe(10);
      expect(positions?.[0].pnl).toBe(100);
      expect(positions?.[0].currentValue).toBe(1100);
    });

    it("mutates vault balances in-memory on incoming trade execution without refetching", () => {
      queryClient.setQueryData(
        ["vaultBalances", "v-1"],
        [
          {
            mint: "SOL-mint",
            symbol: "SOL",
            amount: 10,
            usdValue: 1500,
          },
          {
            mint: "USDC-mint",
            symbol: "USDC",
            amount: 1000,
            usdValue: 1000,
          },
        ],
      );

      vaultHandler.handleBatch(
        [
          {
            type: "trade_confirmed",
            data: {
              vault_id: "v-1",
              input_token: "SOL",
              output_token: "USDC",
              amount_in: 2,
              amount_out: 300,
              tvl: 2600,
            },
            timestamp: Date.now(),
          },
        ],
        { queryClient },
      );

      const balances = queryClient.getQueryData<any[]>([
        "vaultBalances",
        "v-1",
      ]);
      expect(balances?.[0].symbol).toBe("SOL");
      expect(balances?.[0].amount).toBe(8);
      expect(balances?.[1].symbol).toBe("USDC");
      expect(balances?.[1].amount).toBe(1300);
      // USD value scaled to match 2600 TVL
      const totalUsd = balances?.reduce((sum, b) => sum + b.usdValue, 0);
      expect(Math.round(totalUsd || 0)).toBe(2600);
    });
  });

  describe("activityHandler", () => {
    it("prepends confirmed trades to transactions query cache and increments total count", () => {
      queryClient.setQueryData<GlobalTransactionsResponse>(["transactions"], {
        total: 10,
        items: [],
      });

      activityHandler.handleBatch(
        [
          {
            type: "trade_confirmed",
            data: {
              id: "tx-1",
              action: "deposit",
              amount: 500,
              symbol: "USDC",
              vault_id: "v-1",
              vault_name: "Test Vault",
              signature: "sig-123",
            },
            timestamp: Date.now(),
          },
        ],
        { queryClient, walletAddress: "wallet-1" },
      );

      const updated = queryClient.getQueryData<GlobalTransactionsResponse>([
        "transactions",
      ]);
      expect(updated?.total).toBe(11);
      expect(updated?.items[0].id).toBe("tx-1");
      expect(updated?.items[0].amount).toBe(500);
    });
  });
});
