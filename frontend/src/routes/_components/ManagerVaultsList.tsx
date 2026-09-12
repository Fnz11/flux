import { useState, useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { useVaultsQuery } from "@/services/hooks/useQuery/useVaultsQuery";
import { SweepButton } from "@/components/ui/SweepButton";
import { SectionCard } from "@/components/ui/SectionCard";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableEmpty,
  SortableTableHead,
  Pagination,
} from "@/components/ui/table";
import { TableRowSkeleton } from "@/components/ui/TableSkeleton";
import { Shield, PlusCircle, LayoutGrid, LayoutList } from "lucide-react";
import { ManagedVaultRow } from "./ManagedVaultRow";
import { VaultCard } from "../vaults/_components/VaultCard";
import { VaultInvestCardSkeleton } from "../invest/_components/VaultInvestCardSkeleton";
import { useTableSort } from "@/hooks/useTableSort";
import { cn } from "@/lib/utils";

type ManagedVaultSortColumn =
  "displayName" | "status" | "tvl" | "pnl" | "created_at";

export function ManagerVaultsList({
  walletAddress,
}: {
  walletAddress?: string;
}) {
  const { data: allVaults = [], isLoading } = useVaultsQuery();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(8);
  const [viewMode, setViewMode] = useState<"table" | "grid">("table");

  const { sortBy, sortOrder, handleSort } =
    useTableSort<ManagedVaultSortColumn>({
      sortBy: "created_at",
      defaultOrder: "desc",
      allowClear: true,
    });

  // Filter vaults managed by current wallet
  const vaults = useMemo(() => {
    const list = walletAddress
      ? allVaults.filter(
          (v) => v.managerAddress.toLowerCase() === walletAddress.toLowerCase(),
        )
      : allVaults;

    const activeList = list.length > 0 ? list : allVaults;

    if (!sortBy || !sortOrder) return activeList;

    return [...activeList].sort((a, b) => {
      let aVal: number | string = 0;
      let bVal: number | string = 0;

      switch (sortBy) {
        case "displayName":
          aVal = (a.metadata.displayName || a.id).toLowerCase();
          bVal = (b.metadata.displayName || b.id).toLowerCase();
          break;
        case "status":
          aVal = a.status.toLowerCase();
          bVal = b.status.toLowerCase();
          break;
        case "tvl":
          aVal = a.tvl || 0;
          bVal = b.tvl || 0;
          break;
        case "pnl":
          aVal = a.pnlPercent || 0;
          bVal = b.pnlPercent || 0;
          break;
        case "created_at": {
          const timeA = new Date(a.createdAt || 0).getTime();
          const timeB = new Date(b.createdAt || 0).getTime();
          aVal = isNaN(timeA) ? 0 : timeA;
          bVal = isNaN(timeB) ? 0 : timeB;
          break;
        }
      }

      if (typeof aVal === "string" && typeof bVal === "string") {
        return sortOrder === "asc"
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal);
      }
      return sortOrder === "asc"
        ? (aVal as number) - (bVal as number)
        : (bVal as number) - (aVal as number);
    });
  }, [allVaults, walletAddress, sortBy, sortOrder]);

  const totalPages = Math.max(1, Math.ceil(vaults.length / pageSize));
  const pagedVaults = vaults.slice((page - 1) * pageSize, page * pageSize);

  return (
    <SectionCard
      icon={<Shield className="size-4 text-primary-coral" />}
      title="Managed Vaults"
      description="Investment vaults created & managed by your account"
      className="flex-1 flex flex-col justify-between"
      rightContent={
        <div className="flex items-center gap-2.5">
          {/* View Mode Switcher */}
          <div className="flex items-center rounded-xl bg-bg-inset p-1 border border-border-subtle shrink-0">
            <button
              type="button"
              onClick={() => setViewMode("table")}
              aria-label="Table view"
              className={cn(
                "rounded-lg p-1 text-xs transition-colors cursor-pointer",
                viewMode === "table"
                  ? "bg-bg-elevated text-primary-coral shadow-xs"
                  : "text-text-tertiary hover:text-text-primary",
              )}
            >
              <LayoutList className="size-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode("grid")}
              aria-label="Cards view"
              className={cn(
                "rounded-lg p-1 text-xs transition-colors cursor-pointer",
                viewMode === "grid"
                  ? "bg-bg-elevated text-primary-coral shadow-xs"
                  : "text-text-tertiary hover:text-text-primary",
              )}
            >
              <LayoutGrid className="size-3.5" />
            </button>
          </div>

          <Link to="/vaults/create">
            <SweepButton className="h-8 text-xs font-semibold">
              <PlusCircle className="mr-1.5 size-3.5" />
              Create Vault
            </SweepButton>
          </Link>
        </div>
      }
    >
      {viewMode === "grid" ? (
        <div className="space-y-6">
          {isLoading ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: pageSize }).map((_, i) => (
                <VaultInvestCardSkeleton key={i} />
              ))}
            </div>
          ) : vaults.length === 0 ? (
            <div className="flex h-64 flex-col items-center justify-center rounded-2xl border border-dashed border-border-subtle p-6 text-center">
              <PlusCircle className="size-8 text-text-muted mb-2" />
              <h3 className="text-sm font-semibold text-text-primary">
                No Vaults Created Yet
              </h3>
              <p className="mt-1 text-xs text-text-secondary max-w-sm">
                Launch your own Solana investment vault and start attracting
                capital today.
              </p>
              <Link to="/vaults/create" className="mt-4">
                <SweepButton className="h-8 text-xs">
                  Create Your First Vault
                </SweepButton>
              </Link>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {pagedVaults.map((vault) => (
                <VaultCard key={vault.id} vault={vault} />
              ))}
            </div>
          )}

          {vaults.length > 0 && (
            <div className="pt-2">
              <Pagination
                page={page}
                totalPages={totalPages}
                totalItems={vaults.length}
                pageSize={pageSize}
                pageSizeOptions={[6, 8, 12, 24]}
                onPageChange={setPage}
                onPageSizeChange={(newSize: number) => {
                  setPageSize(newSize);
                  setPage(1);
                }}
                itemLabel="vaults"
                isLoading={isLoading}
              />
            </div>
          )}
        </div>
      ) : (
        <Table
          className="min-w-[640px]"
          containerClassName="min-h-[400px]"
          footer={
            <Pagination
              page={page}
              totalPages={totalPages}
              totalItems={vaults.length}
              pageSize={pageSize}
              pageSizeOptions={[5, 8, 15, 30]}
              onPageChange={setPage}
              onPageSizeChange={(newSize: number) => {
                setPageSize(newSize);
                setPage(1);
              }}
              itemLabel="vaults"
              isLoading={isLoading}
            />
          }
        >
          <TableHeader>
            <TableRow>
              <SortableTableHead
                column="displayName"
                sortBy={sortBy}
                sortOrder={sortOrder}
                onSort={handleSort}
                className="py-3 px-6"
              >
                VAULT NAME
              </SortableTableHead>
              <SortableTableHead
                column="status"
                sortBy={sortBy}
                sortOrder={sortOrder}
                onSort={handleSort}
                className="py-3 px-4"
              >
                STATUS
              </SortableTableHead>
              <SortableTableHead
                column="tvl"
                sortBy={sortBy}
                sortOrder={sortOrder}
                onSort={handleSort}
                align="right"
                className="py-3 px-4"
              >
                TVL
              </SortableTableHead>
              <SortableTableHead
                column="pnl"
                sortBy={sortBy}
                sortOrder={sortOrder}
                onSort={handleSort}
                align="right"
                className="py-3 px-4"
              >
                PNL
              </SortableTableHead>
              <SortableTableHead
                column="created_at"
                sortBy={sortBy}
                sortOrder={sortOrder}
                onSort={handleSort}
                align="right"
                className="py-3 px-4"
              >
                CREATED
              </SortableTableHead>
              <TableHead className="py-3 px-4 select-none">
                PERFORMANCE
              </TableHead>
              <TableHead className="py-3 px-6 text-right select-none">
                ACTION
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRowSkeleton
                columns={7}
                rows={5}
                cellAligns={[
                  "left",
                  "left",
                  "right",
                  "right",
                  "right",
                  "right",
                  "right",
                ]}
                cellWidths={[
                  "w-36",
                  "w-16",
                  "w-20",
                  "w-16",
                  "w-20",
                  "w-20",
                  "w-16",
                ]}
              />
            ) : vaults.length === 0 ? (
              <TableEmpty
                colSpan={7}
                icon={<PlusCircle className="size-5" />}
                title="No Vaults Created Yet"
                description="Launch your own Solana investment vault and start attracting capital today."
                minHeight="min-h-[300px]"
                action={
                  <Link to="/vaults/create">
                    <SweepButton className="h-8 text-xs">
                      Create Your First Vault
                    </SweepButton>
                  </Link>
                }
              />
            ) : (
              pagedVaults.map((vault) => (
                <ManagedVaultRow key={vault.id} vault={vault} />
              ))
            )}
          </TableBody>
        </Table>
      )}
    </SectionCard>
  );
}
