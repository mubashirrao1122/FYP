# SolRush DEX - Localnet Setup & Execution Guide

This guide covers everything required to run the SolRush platform on a local Solana validator (localnet). It covers three services: the blockchain programs, the AI chatbot backend, and the Next.js frontend.

---

## 🚀 1. How to Run the Application on Localnet

### Step 1: Start the Solana Local Test Validator
Run the Solana local ledger. It's recommended to do this in a separate, dedicated terminal.
```bash
solana-test-validator
```
*Note: Verify that `solana config get` is pointing your RPC URL to localhost (`http://127.0.0.1:8899`).*

### Step 2: Build & Deploy Smart Contracts (`solrush-dex`)
Open a new terminal window inside the `/solrush-dex` folder.
```bash
cd solrush-dex

# Install dependencies if you haven't
npm install

# Build the Anchor programs
anchor build

# Deploy the programs to the local test validator
anchor deploy
```
*(After deployment, take note of the new Program IDs outputted by Anchor. You will need to update them in the frontend and `Anchor.toml` if they've changed.)*

### Step 3: Run the AI Chatbot Backend (`solrush-chatbot`)
Open a new terminal window inside the `/solrush-chatbot` folder.
```bash
cd solrush-chatbot

# Activate the virtual environment
source venv/bin/activate

# Install requirements (if not done)
pip install -r requirements.txt

# Make sure you have a .env file set up based on .env.example with your Gemini API key:
# GOOGLE_API_KEY="your-api-key"

# Start the FastApi / LangGraph server on port 8000
python main.py
```

### Step 4: Run the Web Frontend (`solrush-frontend`)
Open a new terminal window inside the `/solrush-frontend` folder.
```bash
cd solrush-frontend

# Ensure the local environment file exists and is populated
# The file '.env.local' must contain:
# NEXT_PUBLIC_NETWORK=localnet
# NEXT_PUBLIC_RPC_URL=http://127.0.0.1:8899
# (Plus the Program IDs and Token Mints from your Anchor deployment)

# Install dependencies 
npm install

# Start the development server
npm run dev
```
The frontend should now be running on `http://localhost:3000`.

---

## 🛠️ 2. Files to Refactor for Localnet Compatibility

Before running the application smoothly on localnet, a few missing files and hardcoded logic pieces need fixing. *You do not need to fix these manually right now — this is an audit of what needs to change.*

### A. Frontend Network Logic & Provider Configuration
**File:** `/home/mubashir123/Documents/8th-sem/FYP/FYP/solrush-frontend/src/components/providers/AppWalletProvider.tsx`

* **Issue:** The localnet is defaulting to `WalletAdapterNetwork.Devnet`. The wallet adapter lacks an explicit localnet fallback.
* **Fix needed:** Refactor the network selection script to handle `localnet` gracefully.
```tsx
// Current implementation
const network = NETWORK === 'mainnet' ? WalletAdapterNetwork.Mainnet : WalletAdapterNetwork.Devnet;

// Needed Implementation
const network = NETWORK === 'mainnet' 
    ? WalletAdapterNetwork.Mainnet 
    : (NETWORK === 'localnet' ? 'localnet' as any : WalletAdapterNetwork.Devnet);
```

### B. Missing Constants File
**File:** `/home/mubashir123/Documents/8th-sem/FYP/FYP/solrush-frontend/src/lib/solana/constants.ts`

* **Issue:** The `AppWalletProvider.tsx` attempts to import `RPC_ENDPOINT` and `NETWORK` from `constants.ts`, but this file does not exist in the referenced repository path.
* **Fix needed:** Create the `constants.ts` file or correct the import to pull the network constants directly from `process.env.NEXT_PUBLIC_NETWORK`.

### C. Local Token Accounts & Mints Synchronization
**File:** `/home/mubashir123/Documents/8th-sem/FYP/FYP/solrush-frontend/.env.local`

* **Issue:** Localnet resets its state when you drop the ledger. If you redeploy tokens or the DEX program, the target mint addresses and program IDs will change.
* **Fix needed:** Make sure the IDs in `.env.local` accurately match the ones generated in the `solrush-dex` localnet deployment. Any mock data scripts must seed the exact mints referenced in the root `localnet-config.json`.

### D. Chatbot Environment Constraints (API Keys & Ports)
**File:** `/home/mubashir123/Documents/8th-sem/FYP/FYP/solrush-chatbot/agent.py`

* **Issue:** Cross-Origin requests (CORS) or hardcoded URLs between the chatbot Server (port 8000) and Frontend (port 3000) could break in local environments if not bound correctly.
* **Fix needed:** Ensure `main.py` has CORS correctly set up to explicitly accept requests from `http://localhost:3000`. 
