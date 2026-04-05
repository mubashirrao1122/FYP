
#!/usr/bin/env bash
set -euo pipefail

if ! command -v jq &> /dev/null; then
    echo "Error: jq is not installed. Run 'sudo pacman -S jq' first."
    exit 1
fi

# ─────────────────────────────────────────────────────────────
# Flags
# ─────────────────────────────────────────────────────────────
for arg in "$@"; do
    case $arg in
        --help|-h)
            echo "Usage: ./start.sh"
            echo "  Starts the full SolRush localnet environment."
            exit 0
            ;;
    esac
done

echo ""
echo "==========================================="
echo "  SolRush Localnet — Staggered Startup"
echo "==========================================="
echo ""

# ─────────────────────────────────────────────────────────────
# Pre-flight: kill zombie processes & free ports
# ─────────────────────────────────────────────────────────────
echo "--- Pre-flight: cleaning up old processes ---"
pkill -f solana-test-validator || true
pkill -f solana-faucet || true
fuser -k 8899/tcp 2>/dev/null || true
fuser -k 8000/tcp 2>/dev/null || true
sleep 2

echo "Removing old test-ledger directory..."
rm -rf ./test-ledger

# ─────────────────────────────────────────────────────────────
# Pre-flight: increase system limits for solana-test-validator
# ─────────────────────────────────────────────────────────────
echo "--- Setting system limits for validator ---"
CURRENT_MAP_COUNT=$(sysctl -n vm.max_map_count 2>/dev/null || echo 0)
if [[ "$CURRENT_MAP_COUNT" -lt 1000000 ]]; then
    echo "  Increasing vm.max_map_count to 1000000..."
    sudo sysctl -w vm.max_map_count=1000000
fi
ulimit -n 65535 2>/dev/null || true
echo ""

# ─────────────────────────────────────────────────────────────
# Step 1: Start PostgreSQL  (wait 2s)
# ─────────────────────────────────────────────────────────────
echo "--- Step 1: Starting PostgreSQL ---"
if command -v systemctl &> /dev/null; then
    sudo systemctl start postgresql
else
    sudo service postgresql start
fi

sudo -u postgres psql -tc "SELECT 1 FROM pg_roles WHERE rolname='solrush';" | grep -q 1 || \
    sudo -u postgres psql -c "CREATE USER solrush WITH PASSWORD 'solrush';"

sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname='solrush';" | grep -q 1 || \
    sudo -u postgres createdb -O solrush solrush

echo "✅ PostgreSQL ready"
echo "  Staggering… waiting 2 seconds"
sleep 2

# ─────────────────────────────────────────────────────────────
# Step 2: Start Validator in background  (wait 20s)
# ─────────────────────────────────────────────────────────────
echo ""
echo "--- Step 2: Starting solana-test-validator (background) ---"

# Memory-optimized flags for low-RAM environments
VALIDATOR_FLAGS="--reset --rpc-port 8899 --faucet-port 9900 --bind-address 127.0.0.1 --limit-ledger-size 50000000 --slots-per-epoch 32"

VALIDATOR_PID=""
solana-test-validator $VALIDATOR_FLAGS > validator_output.log 2>&1 &
VALIDATOR_PID=$!
echo "  Validator PID: $VALIDATOR_PID"
echo "  Staggering… waiting 20 seconds for validator to stabilize"
sleep 20

# Health check: verify validator is responding
echo "  Verifying validator is alive on port 8899..."
RETRIES=0
MAX_RETRIES=6
while ! solana cluster-version --url http://127.0.0.1:8899 &>/dev/null; do
    RETRIES=$((RETRIES + 1))
    if [[ $RETRIES -ge $MAX_RETRIES ]]; then
        echo ""
        echo "❌ Validator is NOT running after $((20 + MAX_RETRIES * 5)) seconds."
        echo "   Likely killed by OOM. Try:"
        echo "     1. Close browser / heavy apps to free RAM"
        echo "     2. Check: journalctl -k | grep -i 'oom\\|kill'"
        echo "     3. Manually run: solana-test-validator $VALIDATOR_FLAGS"
        exit 1
    fi
    echo "    Retry $RETRIES/$MAX_RETRIES — waiting 5 more seconds..."
    sleep 5
done
echo "✅ Validator is running: $(solana cluster-version --url http://127.0.0.1:8899)"

# Airdrop SOL to the Phantom wallet
PHANTOM_WALLET="8Qmx5CZtR22YRKvjXkCgfMXfg5n9BHMmJmwCAno4cxrf"
echo "  Airdropping 100 SOL to Phantom wallet ($PHANTOM_WALLET)..."
solana airdrop 100 "$PHANTOM_WALLET" --url http://127.0.0.1:8899 2>/dev/null || echo "  ⚠️  Airdrop failed — re-run manually if needed"
echo ""

# ─────────────────────────────────────────────────────────────
# Step 3: Anchor Build & Deploy  (wait 5s after)
# ─────────────────────────────────────────────────────────────
echo "--- Step 3: Building and deploying Anchor programs ---"
cd solrush-dex
anchor build

echo "Deploying to localnet..."
DEPLOY_OUT=$(anchor deploy 2>&1)
echo "$DEPLOY_OUT"

# Sync Program ID everywhere
cd ..
echo ""
echo "--- Syncing Program ID across all project files ---"
bash sync-program-id.sh "$DEPLOY_OUT"
cd solrush-dex

echo "  Staggering… waiting 5 seconds"
sleep 5

# ─────────────────────────────────────────────────────────────
# Step 4: Asset Setup scripts  (wait 5s after)
# ─────────────────────────────────────────────────────────────
echo ""
echo "--- Step 4: Initializing Localnet Assets ---"
echo "Creating mock tokens and generating config..."
npx ts-node scripts/setup-localnet.ts

echo ""
echo "--- Step 4b: Initializing SOL/USDC Liquidity Pool ---"
npx ts-node scripts/setup-sol-usdc-pool.ts || echo "  ⚠️  SOL/USDC pool setup error"

echo ""
echo "--- Step 4c: Initializing SOL/USDT Liquidity Pool ---"
npx ts-node scripts/setup-sol-usdt-pool.ts || echo "  ⚠️  SOL/USDT pool setup error"

cd ..
echo "  Staggering… waiting 5 seconds"
sleep 5

# ─────────────────────────────────────────────────────────────
# Step 5: AI Chatbot Backend (background, wait 5s)
# ─────────────────────────────────────────────────────────────
echo ""
echo "--- Step 5: Starting AI Chatbot Backend ---"
cd solrush-chatbot
if [ -d "venv" ]; then
    source venv/bin/activate
fi

pip install asyncpg "SQLAlchemy[asyncio]" --quiet 2>/dev/null || true

echo "Seeding database..."
python -m db.seed 2>/dev/null || true

python main.py > ../chatbot_output.log 2>&1 &
CHATBOT_PID=$!
echo "✅ Chatbot backend started (PID: $CHATBOT_PID)"
cd ..
echo "  Staggering… waiting 5 seconds"
sleep 5

# ─────────────────────────────────────────────────────────────
# Step 6: Next.js Frontend (foreground)
# ─────────────────────────────────────────────────────────────
echo ""
echo "--- Step 6: Starting Next.js Frontend ---"
cd solrush-frontend

# Sync mint addresses from localnet-config.json into .env.local
CONFIG_FILE="../localnet-config.json"
if [ -f "$CONFIG_FILE" ]; then
    echo "Syncing localnet mint addresses into .env.local..."

    USDC_MINT=$(jq -r '.mints.USDC // empty' "$CONFIG_FILE")
    USDT_MINT=$(jq -r '.mints.USDT // empty' "$CONFIG_FILE")
    WETH_MINT=$(jq -r '.mints.WETH // empty' "$CONFIG_FILE")
    RUSH_MINT=$(jq -r '.mints.RUSH // empty' "$CONFIG_FILE")
    SOL_MINT=$(jq -r '.mints.SOL // "So11111111111111111111111111111111111111112"' "$CONFIG_FILE")
    RPC_URL=$(jq -r '.rpcUrl // "http://127.0.0.1:8899"' "$CONFIG_FILE")

    upsert_env() {
        local key="$1" val="$2"
        if [ -z "$val" ]; then return; fi
        if [ ! -f .env.local ]; then touch .env.local; fi
        if grep -q "^${key}=" .env.local 2>/dev/null; then
            sed -i "s|^${key}=.*|${key}=${val}|" .env.local
        else
            echo "${key}=${val}" >> .env.local
        fi
        echo "  ✅ ${key}=${val}"
    }

    upsert_env "NEXT_PUBLIC_SOL_MINT"   "$SOL_MINT"
    upsert_env "NEXT_PUBLIC_USDC_MINT"  "$USDC_MINT"
    upsert_env "NEXT_PUBLIC_USDT_MINT"  "$USDT_MINT"
    upsert_env "NEXT_PUBLIC_WETH_MINT"  "$WETH_MINT"
    upsert_env "NEXT_PUBLIC_RUSH_MINT"  "$RUSH_MINT"
    upsert_env "NEXT_PUBLIC_RPC_URL"    "$RPC_URL"
    upsert_env "NEXT_PUBLIC_NETWORK"    "localnet"

    echo "✅ Mint addresses synced."
else
    echo "⚠️  localnet-config.json not found — skipping mint sync."
fi

echo ""
echo "==========================================="
echo "  SolRush is running!"
echo "  Frontend:   http://localhost:3000"
echo "  Chatbot:    http://localhost:8000"
echo "  Validator:  http://127.0.0.1:8899"
echo "  Database:   postgresql://localhost:5432/solrush"
echo "==========================================="
echo ""

# ─────────────────────────────────────────────────────────────
# Cleanup Trap
# ─────────────────────────────────────────────────────────────
cleanup() {
    echo ""
    echo "Shutting down background processes..."
    [ -n "$CHATBOT_PID" ] && kill "$CHATBOT_PID" 2>/dev/null
    [ -n "$VALIDATOR_PID" ] && kill "$VALIDATOR_PID" 2>/dev/null
    echo "Done."
    exit
}

trap cleanup SIGINT SIGTERM

npm run dev
