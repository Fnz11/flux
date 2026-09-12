import { Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import { TableRow, TableCell } from "@/components/ui/table";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { AddressPill } from "@/components/ui/AddressPill";
import { VaultSparkline } from "../vaults/_components/VaultSparkline";
import { cn } from "@/lib/utils";
import type { Vault } from "@/types";
import { formatCurrency, formatDate } from "@/lib/format";
import { getEffectiveSparkline } from "@/lib/sparkline";

export function ManagedVaultRow({ vault }: { vault: Vault }) {
  const pnl = vault.pnlPercent ?? 0;
  const isPositive = pnl >= 0;
  const sparkline = getEffectiveSparkline(vault);
  const colorClass = isPositive ? "text-status-success" : "text-status-error";
  const displayName =
    vault.metadata?.displayName ||
    `Vault ${vault.address.slice(0, 4)}...${vault.address.slice(-4)}`;

  const initials = displayName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <TableRow className="group hover:bg-bg-elevated/80 transition-colors">
      <TableCell className="py-4 px-6 whitespace-nowrap">
        <div className="flex items-center gap-3">
          {vault.metadata?.coverImageUrl ? (
            <img
              src={vault.metadata.coverImageUrl}
              alt={displayName}
              className="h-10 w-10 rounded-xl object-cover border border-white/12 shadow-sm shrink-0 bg-white/5"
            />
          ) : (
            <Avatar className="h-10 w-10 shrink-0 border border-white/10">
              <AvatarFallback seed={vault.address || vault.id || displayName}>
                {initials}
              </AvatarFallback>
            </Avatar>
          )}
          <div>
            <div className="font-semibold text-sm flex items-center gap-2">
              <span className="text-text-primary">{displayName}</span>
              <StatusBadge status={vault.status} />
            </div>
            <div className="mt-0.5">
              {vault.managerAddress ? (
                <AddressPill
                  prefix="by "
                  address={vault.managerAddress}
                  length={4}
                />
              ) : (
                <span className="text-xs text-text-tertiary font-mono">
                  by You
                </span>
              )}
            </div>
          </div>
        </div>
      </TableCell>
      <TableCell className="py-4 px-4 whitespace-nowrap">
        <StatusBadge status={vault.status} />
      </TableCell>
      <TableCell className="py-4 px-4 text-right font-mono whitespace-nowrap text-xs font-bold text-status-success">
        {formatCurrency(vault.tvl)}
      </TableCell>
      <TableCell
        className={cn(
          "py-4 px-4 text-right font-mono font-semibold whitespace-nowrap text-xs",
          colorClass,
        )}
      >
        {isPositive ? `+${pnl.toFixed(2)}%` : `${pnl.toFixed(2)}%`}
      </TableCell>
      <TableCell className="py-4 px-4 text-right font-mono text-xs whitespace-nowrap text-text-tertiary">
        {formatDate(vault.createdAt)}
      </TableCell>
      <TableCell className="py-4 px-4 whitespace-nowrap">
        <VaultSparkline data={sparkline} isPositive={isPositive} />
      </TableCell>
      <TableCell className="py-4 px-6 whitespace-nowrap text-right">
        <Link
          to="/vaults/$id"
          params={{ id: vault.id }}
          className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold text-primary-coral hover:bg-primary-coral/10 transition-colors"
        >
          View
          <ChevronRight className="size-3.5" />
        </Link>
      </TableCell>
    </TableRow>
  );
}
