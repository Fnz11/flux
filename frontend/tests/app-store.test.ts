import { describe, it, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { useAppStore } from '../src/stores/app-store'

describe('useAppStore', () => {
  beforeEach(() => {
    useAppStore.setState({
      currentUser: null,
      isManager: false,
      activeVaultId: null,
    })
  })

  it('sets current user address', () => {
    useAppStore.getState().setCurrentUser('5K911111111111111111111111111111')
    assert.equal(useAppStore.getState().currentUser, '5K911111111111111111111111111111')
  })

  it('toggles manager mode', () => {
    assert.equal(useAppStore.getState().isManager, false)
    useAppStore.getState().toggleMode()
    assert.equal(useAppStore.getState().isManager, true)
    useAppStore.getState().toggleMode()
    assert.equal(useAppStore.getState().isManager, false)
  })

  it('sets active vault id', () => {
    useAppStore.getState().setActiveVaultId('vault_quant_1')
    assert.equal(useAppStore.getState().activeVaultId, 'vault_quant_1')
  })
})
