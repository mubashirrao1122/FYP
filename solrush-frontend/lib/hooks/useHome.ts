import { useRouter } from 'next/navigation';
import { useWallet } from '@solana/wallet-adapter-react';

export const useHome = () => {
    const router = useRouter();
    const { publicKey } = useWallet();

    const handleLaunchApp = () => {
        router.push('/swap');
    };

    return {
        publicKey,
        handleLaunchApp,
    };
};
