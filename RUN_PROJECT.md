# How to Run SolRush DEX

This guide will help you run the SolRush DEX on your local machine.

## Prerequisites

-   **Solana Tool Suite** (v1.18 or later)
-   **Anchor** (v0.30 or later)
-   **Node.js** (v18 or later)
-   **Yarn** or **NPM**

## 1. Start Local Validator

Open a terminal and start the Solana local validator. This simulates the blockchain on your machine.

```bash
solana-test-validator
```

Keep this terminal open.

## 2. Build and Deploy Blockchain Program

Open a new terminal and navigate to the `solrush-dex` directory:

```bash
cd solrush-dex
```

Build the program:

```bash
anchor build
```

Deploy the program to your local validator:

```bash
anchor deploy --provider.cluster localnet
```

**Important:** Note the "Program Id" from the deployment output. It should match `HiBkUd2QX61NNJkAwU48EadUs9HDgKnbDFJ3Zoq6uFMp`.
If it's different, you must update:
1.  `programs/solrush-dex/src/lib.rs`: `declare_id!("...")`
2.  `Anchor.toml`: `[programs.localnet] solrush_dex = "..."`
3.  `../solrush-frontend/lib/constants.ts` (if applicable)

## 3. Configure Frontend

Navigate to the frontend directory:

```bash
cd ../solrush-frontend
```

Install dependencies (if not already done):

```bash
npm install
```

## 4. Run Frontend

Start the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## 5. Setup Wallet & Airdrop

1.  Install **Phantom** or **Solflare** wallet extension.
2.  Switch network to **Localhost** (Settings -> Developer Settings -> Change Network -> Localhost).
3.  Copy your wallet address.
4.  Airdrop SOL to your wallet (in terminal):

```bash
solana airdrop 10 <YOUR_WALLET_ADDRESS> --url localhost
```

## 6. Testing the App

1.  Connect your wallet on the web app.
2.  Go to **Pools** -> **Create Pool**.
3.  You'll need Mint addresses for tokens. You can create dummy tokens using the SPL Token CLI or use the "Faucet" if implemented (currently manual creation is required for custom tokens, or use SOL and a dummy mint).

**Tip:** To create a dummy token for testing:
```bash
spl-token create-token
spl-token create-account <TOKEN_ADDRESS>
spl-token mint <TOKEN_ADDRESS> 1000
```
