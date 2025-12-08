/**
 * Application Configuration
 * Centralized config for network settings, explorer URLs, etc.
 */

export type NetworkType = 'devnet' | 'testnet' | 'mainnet-beta';

interface NetworkConfig {
    name: string;
    endpoint: string;
    wsEndpoint: string;
    explorerUrl: string;
}

const NETWORKS: Record<NetworkType, NetworkConfig> = {
    devnet: {
        name: 'Devnet',
        endpoint: 'https://api.devnet.solana.com',
        wsEndpoint: 'wss://api.devnet.solana.com',
        explorerUrl: 'https://explorer.solana.com',
    },
    testnet: {
        name: 'Testnet',
        endpoint: 'https://api.testnet.solana.com',
        wsEndpoint: 'wss://api.testnet.solana.com',
        explorerUrl: 'https://explorer.solana.com',
    },
    'mainnet-beta': {
        name: 'Mainnet',
        endpoint: 'https://api.mainnet-beta.solana.com',
        wsEndpoint: 'wss://api.mainnet-beta.solana.com',
        explorerUrl: 'https://explorer.solana.com',
    },
};

// Get current network from environment
export const CURRENT_NETWORK: NetworkType = 
    (process.env.NEXT_PUBLIC_NETWORK as NetworkType) || 'devnet';

// Get current network config
export const networkConfig = NETWORKS[CURRENT_NETWORK];

// RPC endpoint (can be overridden by env)
export const RPC_ENDPOINT = 
    process.env.NEXT_PUBLIC_RPC_URL || networkConfig.endpoint;

// Explorer URL helpers
export const getExplorerUrl = (
    path: string,
    type: 'tx' | 'address' | 'block' = 'tx'
): string => {
    const cluster = CURRENT_NETWORK === 'mainnet-beta' ? '' : `?cluster=${CURRENT_NETWORK}`;
    return `${networkConfig.explorerUrl}/${type}/${path}${cluster}`;
};

export const getTransactionUrl = (signature: string): string => 
    getExplorerUrl(signature, 'tx');

export const getAddressUrl = (address: string): string => 
    getExplorerUrl(address, 'address');

export const getBlockUrl = (block: number): string => 
    getExplorerUrl(block.toString(), 'block');

// Application settings
export const appConfig = {
    name: 'SolRush DEX',
    description: 'Decentralized Exchange on Solana',
    network: CURRENT_NETWORK,
    networkConfig,
    rpcEndpoint: RPC_ENDPOINT,
    
    // Feature flags
    features: {
        limitOrders: true,
        rewards: true,
        analytics: false, // Coming soon
    },
    
    // Default settings
    defaults: {
        slippageBps: 50, // 0.5%
        transactionDeadline: 300, // 5 minutes
        refreshInterval: 30000, // 30 seconds
    },
    
    // Social links
    links: {
        twitter: 'https://twitter.com/solrushdex',
        discord: 'https://discord.gg/solrush',
        github: 'https://github.com/solrush',
        docs: 'https://docs.solrush.io',
    },
};

export default appConfig;
