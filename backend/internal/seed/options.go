package seed

import "time"

// Options controls the size and shape of the seeded dataset.
type Options struct {
	Users          int // number of real on-chain user accounts (>= UsersMin)
	VaultsPerUser  int // minimum vaults managed by each user (>= VaultsPerUserMin)
	TradesPerVault int // approximate number of trades generated per vault
	Days           int // how far back trade/price history goes
	MetricDays     int // how far back the daily vault_metrics / price_history series goes
	Clean          bool
	RPCURL         string
	AirdropSOL     float64 // initial SOL airdropped to each user (target, topped-up on demand)
	VaultSOL       float64 // SOL airdropped to each vault account so it can act as sender
	Wallet         string  // optional specific wallet address to seed/include
}

const (
	UsersMin          = 25
	VaultsPerUserMin  = 4
	DefaultUsers      = 30
	DefaultVaultsPU   = 5
	DefaultTrades     = 14
	DefaultDays       = 90
	DefaultMetricDays = 30
	DefaultRPC        = "http://localhost:8899"
	DefaultAirdropSOL = 600
	DefaultVaultSOL   = 250
)

func DefaultOptions() Options {
	return Options{
		Users:          DefaultUsers,
		VaultsPerUser:  DefaultVaultsPU,
		TradesPerVault: DefaultTrades,
		Days:           DefaultDays,
		MetricDays:     DefaultMetricDays,
		RPCURL:         DefaultRPC,
		AirdropSOL:     DefaultAirdropSOL,
		VaultSOL:       DefaultVaultSOL,
	}
}

func (o *Options) StartTime() time.Time {
	return time.Now().UTC().AddDate(0, 0, -o.Days)
}
