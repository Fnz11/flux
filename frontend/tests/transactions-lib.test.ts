// @vitest-environment node

import assert from 'node:assert/strict'
import { describe, it, vi } from 'vitest'
import {
  ComputeBudgetProgram,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
} from '@solana/web3.js'
import { buildTransactionWithComputeBudget, sendTransaction } from '../src/lib/transactions'

describe('buildTransactionWithComputeBudget', () => {
  it('adds default compute price and limit instructions', () => {
    const tx = buildTransactionWithComputeBudget()

    assert.equal(tx.instructions.length, 2)
    assert.equal(tx.instructions[0].programId.equals(ComputeBudgetProgram.programId), true)
    assert.equal(tx.instructions[0].data[0], 3)
    assert.equal(tx.instructions[0].data.readBigUInt64LE(1), 1000n)
    assert.equal(tx.instructions[1].data[0], 2)
    assert.equal(tx.instructions[1].data.readUInt32LE(1), 200000)
  })

  it('uses custom compute budget values', () => {
    const tx = buildTransactionWithComputeBudget([], 25_000, 900_000)

    assert.equal(tx.instructions[0].data.readBigUInt64LE(1), 25_000n)
    assert.equal(tx.instructions[1].data.readUInt32LE(1), 900_000)
  })

  it('appends supplied instructions after compute budget instructions in order', () => {
    const first = new TransactionInstruction({ keys: [], programId: SystemProgram.programId })
    const second = new TransactionInstruction({
      keys: [],
      programId: new PublicKey('11111111111111111111111111111112'),
    })
    const tx = buildTransactionWithComputeBudget([first, second])

    assert.equal(tx.instructions.length, 4)
    assert.strictEqual(tx.instructions[2], first)
    assert.strictEqual(tx.instructions[3], second)
  })
})

describe('sendTransaction', () => {
  it('hydrates, signs, serializes, and sends a transaction through mocked Solana boundaries', async () => {
    const blockhash = '11111111111111111111111111111111'
    const serialized = Uint8Array.from([1, 2, 3])
    const signed = { serialize: vi.fn(() => serialized) }
    const connection = {
      getLatestBlockhash: vi.fn().mockResolvedValue({ blockhash }),
      sendRawTransaction: vi.fn().mockResolvedValue('signature-123'),
    }
    const publicKey = new PublicKey('11111111111111111111111111111112')
    const signer = { publicKey, signTransaction: vi.fn().mockResolvedValue(signed) }
    const tx = new Transaction()

    const signature = await sendTransaction(connection as never, tx, signer as never)

    assert.equal(signature, 'signature-123')
    assert.equal(tx.feePayer?.equals(publicKey), true)
    assert.equal(tx.recentBlockhash, blockhash)
    assert.deepStrictEqual(connection.getLatestBlockhash.mock.calls, [[]])
    assert.strictEqual(signer.signTransaction.mock.calls[0][0], tx)
    assert.deepStrictEqual(connection.sendRawTransaction.mock.calls, [[serialized]])
    assert.equal(signed.serialize.mock.calls.length, 1)
  })

  it('does not sign or send when blockhash retrieval fails', async () => {
    const error = new Error('RPC unavailable')
    const connection = {
      getLatestBlockhash: vi.fn().mockRejectedValue(error),
      sendRawTransaction: vi.fn(),
    }
    const signer = { publicKey: SystemProgram.programId, signTransaction: vi.fn() }

    await assert.rejects(sendTransaction(connection as never, new Transaction(), signer), error)
    assert.equal(signer.signTransaction.mock.calls.length, 0)
    assert.equal(connection.sendRawTransaction.mock.calls.length, 0)
  })

  it('propagates wallet signing failures without submitting raw bytes', async () => {
    const error = new Error('User rejected request')
    const connection = {
      getLatestBlockhash: vi.fn().mockResolvedValue({
        blockhash: '11111111111111111111111111111111',
      }),
      sendRawTransaction: vi.fn(),
    }
    const signer = {
      publicKey: SystemProgram.programId,
      signTransaction: vi.fn().mockRejectedValue(error),
    }

    await assert.rejects(sendTransaction(connection as never, new Transaction(), signer), error)
    assert.equal(connection.sendRawTransaction.mock.calls.length, 0)
  })
})
