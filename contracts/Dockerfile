FROM solanafoundation/anchor:v0.32.1 AS builder

WORKDIR /workspace

# Copy everything
COPY . .

# Run build to compile the smart contracts (this creates the .so files in target/)
RUN anchor build

# By default, run a local testnet with the contracts deployed
# The frontend and backend can connect to this container on port 8899
EXPOSE 8899 8900

CMD ["anchor", "localnet"]
