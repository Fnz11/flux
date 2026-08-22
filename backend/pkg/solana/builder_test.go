package solana

import (
	"encoding/base64"
	"testing"

	"github.com/gagliardetto/solana-go"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestBuildInitializeVaultTx(t *testing.T) {
	manager := solana.NewWallet()
	shareMint := solana.NewWallet()
	blockhash := solana.HashFromBytes([]byte("11111111111111111111111111111111"))

	params := CreateVaultParams{
		Manager:               manager.PublicKey(),
		ShareTokenMintKeypair: shareMint.PrivateKey,
		DepositMint:           NativeMint,
		MinRaiseAmount:        1000000000,
		PerformanceFeeBps:     1000,
		ManagementFeeBps:      200,
		LockupPeriodSec:       86400,
		AllowedOutputMints:    []solana.PublicKey{NativeMint},
		RecentBlockhash:       blockhash,
		ComputeUnitLimit:      200000,
		ComputeUnitPrice:      1000,
	}

	prep, err := BuildInitializeVaultTx(DefaultProgramID, params)
	require.NoError(t, err)
	assert.NotEmpty(t, prep.TransactionBase64)
	assert.False(t, prep.VaultAddress.IsZero())
	assert.Equal(t, shareMint.PublicKey(), prep.ShareTokenMint)

	raw, err := base64.StdEncoding.DecodeString(prep.TransactionBase64)
	require.NoError(t, err)
	assert.NotEmpty(t, raw)
}

func TestBuildDepositTx(t *testing.T) {
	investor := solana.NewWallet()
	vault := solana.NewWallet()
	shareMint := solana.NewWallet()
	blockhash := solana.HashFromBytes([]byte("11111111111111111111111111111111"))

	params := DepositParams{
		Investor:         investor.PublicKey(),
		Vault:            vault.PublicKey(),
		DepositMint:      NativeMint,
		ShareTokenMint:   shareMint.PublicKey(),
		Amount:           500000000,
		RecentBlockhash:  blockhash,
		ComputeUnitLimit: 200000,
		ComputeUnitPrice: 1000,
	}

	prep, err := BuildDepositTx(DefaultProgramID, params)
	require.NoError(t, err)
	assert.NotEmpty(t, prep.TransactionBase64)
	assert.Equal(t, vault.PublicKey(), prep.VaultAddress)
}

func TestBuildWithdrawTx(t *testing.T) {
	investor := solana.NewWallet()
	vault := solana.NewWallet()
	shareMint := solana.NewWallet()
	blockhash := solana.HashFromBytes([]byte("11111111111111111111111111111111"))

	params := WithdrawParams{
		Investor:         investor.PublicKey(),
		Vault:            vault.PublicKey(),
		WithdrawMint:     NativeMint,
		ShareTokenMint:   shareMint.PublicKey(),
		SharesToBurn:     250000000,
		RecentBlockhash:  blockhash,
		ComputeUnitLimit: 200000,
		ComputeUnitPrice: 1000,
	}

	prep, err := BuildWithdrawTx(DefaultProgramID, params)
	require.NoError(t, err)
	assert.NotEmpty(t, prep.TransactionBase64)
	assert.Equal(t, vault.PublicKey(), prep.VaultAddress)
}
