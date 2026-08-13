# Multi-platform note: this image tag only publishes amd64. Build with
# --platform=linux/amd64 (set in docker-compose.yml) so the arm64 host can run it.
FROM solanafoundation/anchor:v1.0.2 AS builder

WORKDIR /workspace

# Ensure a wallet keypair exists for anchor build/localnet
RUN mkdir -p ~/.config/solana && solana-keygen new --no-bip39-passphrase --silent -o ~/.config/solana/id.json || true

# Copy everything
COPY . .

# Place the committed program keypair where anchor expects it, so the built
# binary keeps the declared program ID (FJY6JUzQybrA5CbM9jgnTJtndhEU6vBAFF5vCuvq6Ais).
# Ensure target/deploy directory exists before anchor build
RUN mkdir -p target/deploy && \
    cp deploy/fbyt_clone_vault-keypair.json target/deploy/fbyt_clone_vault-keypair.json

# Run build to compile the smart contracts (creates target/deploy/fbyt_clone_vault.so)
RUN anchor build && \
    mkdir -p target/deploy && \
    cp programs/fbyt-clone-vault/target/deploy/fbyt_clone_vault.so target/deploy/fbyt_clone_vault.so

EXPOSE 8899 8900

CMD ["solana-test-validator", "--reset", "--bpf-program", "FJY6JUzQybrA5CbM9jgnTJtndhEU6vBAFF5vCuvq6Ais", "/workspace/target/deploy/fbyt_clone_vault.so"]