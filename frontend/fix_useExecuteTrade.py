import re

with open('src/hooks/useExecuteTrade.ts', 'r') as f:
    content = f.read()

# 1. Imports
content = content.replace("import { useAnchorWallet, useConnection } from '@solana/wallet-adapter-react'", "import { useAnchorWallet, useConnection, useWallet } from '@solana/wallet-adapter-react'")

# 2. Hook variables
content = content.replace("const wallet = useAnchorWallet()", "const anchorWallet = useAnchorWallet()\n  const { signMessage } = useWallet()")

# 3. All usages inside the hook
content = content.replace("if (!wallet) {", "if (!anchorWallet) {")
content = content.replace("wallet.publicKey", "anchorWallet.publicKey")
content = content.replace("getProgram(connection, wallet)", "getProgram(connection, anchorWallet)")
content = content.replace("wallet.signTransaction", "anchorWallet.signTransaction")
content = content.replace("sendTransaction(connection, tx, wallet)", "sendTransaction(connection, tx, anchorWallet)")

# 4. Auth block
auth_old = """if ((!currentToken || isTokenExpired(currentToken)) && 'signMessage' in wallet && typeof (wallet as unknown as { signMessage?: (msg: Uint8Array) => Promise<Uint8Array> }).signMessage === 'function') {
              await ensureWalletAuthenticated(userAddr, (wallet as unknown as { signMessage: (msg: Uint8Array) => Promise<Uint8Array> }).signMessage).catch(() => {})
            }"""
auth_new = """if ((!currentToken || isTokenExpired(currentToken)) && signMessage) {
              await ensureWalletAuthenticated(userAddr, signMessage).catch(() => {})
            }"""
content = content.replace(auth_old, auth_new)

# 5. Dependency array for useCallback
content = content.replace("[wallet, connection", "[anchorWallet, signMessage, connection")

with open('src/hooks/useExecuteTrade.ts', 'w') as f:
    f.write(content)
