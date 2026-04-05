
if ! command -v jq &> /dev/null; then
    echo "Error: jq is not installed. Run 'sudo pacman -S jq' first."
    exit 1
fi

echo "Starting SolRush Localnet Environment..."

echo "--- Step 0: Starting PostgreSQL ---"
# Arch Linux uses systemctl
if command -v systemctl &> /dev/null; then
    sudo systemctl start postgresql
else
    sudo service postgresql start
fi

# Create the 'solrush' user + DB if they don't exist
sudo -u postgres psql -tc "SELECT 1 FROM pg_roles WHERE rolname='solrush';" | grep -q 1 || \
    sudo -u postgres psql -c "CREATE USER solrush WITH PASSWORD 'solrush';"

sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname='solrush';" | grep -q 1 || \
    sudo -u postgres createdb -O solrush solrush

echo "PostgreSQL ready at postgresql://solrush:solrush@localhost:5432/solrush"

# ─────────────────────────────────────────────────────────────
# 1. Start Solana Test Validator in a new terminal
# ─────────────────────────────────────────────────────────────
VALIDATOR_PID=""

# Try common terminal emulators for Arch/Linux
if command -v gnome-terminal &> /dev/null; then
    echo " Opening solana-test-validator in gnome-terminal..."
    gnome-terminal -- bash -c "solana-test-validator; exec bash"
elif command -v konsole &> /dev/null; then
    echo " Opening solana-test-validator in konsole..."
    konsole -e bash -c "solana-test-validator; exec bash" &
elif command -v xfce4-terminal &> /dev/null; then
    echo " Opening solana-test-validator in xfce4-terminal..."
    xfce4-terminal -e "bash -c 'solana-test-validator; exec bash'" &
elif command -v alacritty &> /dev/null; then
    echo " Opening solana-test-validator in alacritty..."
    alacritty -e bash -c "solana-test-validator; exec bash" &
else
    echo " No supported terminal found. Starting solana-test-validator in the background..."
    solana-test-validator > validator_output.log 2>&1 &
    VALIDATOR_PID=$!
fi

echo " Waiting 5 seconds for localnet to boot up..."
sleep 5

# ─────────────────────────────────────────────────────────────
# 2. Build and Deploy Anchor Programs
# ─────────────────────────────────────────────────────────────
echo "--- Step 2: Building and deploying Anchor programs ---"
cd solrush-dex
anchor build

echo "Deploying to localnet (this may take a moment)..."
DEPLOY_OUT=$(anchor deploy 2>&1)
echo "$DEPLOY_OUT"

# Extract the Program ID from deploy output
PROGRAM_ID=$(echo "$DEPLOY_OUT" | grep "Program Id:" | awk '{print $3}' | head -n 1)

if [ -n "$PROGRAM_ID" ]; then
    echo "Successfully deployed. New Program ID: $PROGRAM_ID"
    # Ensure directory existence before sed
    if [ -f "../solrush-frontend/.env.local" ]; then
        sed -i "s/^NEXT_PUBLIC_PROGRAM_ID=.*/NEXT_PUBLIC_PROGRAM_ID=$PROGRAM_ID/" ../solrush-frontend/.env.local
        echo " Injected new Program ID into solrush-frontend/.env.local"
    fi
else
    echo " Could not detect a new Program ID. Check deploy logs. Continuing anyway..."
fi

# ─────────────────────────────────────────────────────────────
# 3. Initialize Localnet Assets (Mints, Vaults, Pools)
# ─────────────────────────────────────────────────────────────
echo "--- Step 3: Initializing Localnet Assets ---"
echo "Running setup script to create mock tokens and generate config..."
npx ts-node scripts/setup-localnet.ts
cd ..

# ─────────────────────────────────────────────────────────────
# 4. Start the Python Chatbot Backend + Seed DB
# ─────────────────────────────────────────────────────────────
echo "--- Step 4: Starting AI Chatbot Backend ---"
cd solrush-chatbot
if [ -d "venv" ]; then
    source venv/bin/activate
fi

# Install any new dependencies
pip install asyncpg "SQLAlchemy[asyncio]" --quiet

# Seed the database with demo data
echo "Seeding database with demo data..."
python -m db.seed

# Start the backend in the background
python main.py &
CHATBOT_PID=$!
echo "Chatbot backend started (PID: $CHATBOT_PID)"

# ─────────────────────────────────────────────────────────────
# 5. Start the Next.js Frontend
# ─────────────────────────────────────────────────────────────
echo "--- Step 5: Starting Next.js Frontend ---"
cd ../solrush-frontend

# Sync mint addresses from localnet-config.json into .env.local
CONFIG_FILE="../localnet-config.json"
if [ -f "$CONFIG_FILE" ]; then
    echo "Syncing localnet mint addresses into .env.local..."

    USDC_MINT=$(jq -r '.mints.USDC // empty' "$CONFIG_FILE")
    USDT_MINT=$(jq -r '.mints.USDT // empty' "$CONFIG_FILE")
    WETH_MINT=$(jq -r '.mints.WETH // empty' "$CONFIG_FILE")
    RUSH_MINT=$(jq -r '.mints.RUSH // empty' "$CONFIG_FILE")
    RPC_URL=$(jq -r '.rpcUrl // "http://127.0.0.1:8899"' "$CONFIG_FILE")

    # Helper: upsert a key=value in .env.local
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
echo "  SolRush is starting up!"
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
    if [ -n "$CHATBOT_PID" ]; then kill $CHATBOT_PID; fi
    if [ -n "$VALIDATOR_PID" ]; then kill $VALIDATOR_PID; fi
    echo "Done."
    exit
}

trap cleanup SIGINT SIGTERM

npm run dev
