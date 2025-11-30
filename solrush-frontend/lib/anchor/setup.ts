import { Program, Idl, AnchorProvider, setProvider } from "@project-serum/anchor";
import { Connection, PublicKey } from "@solana/web3.js";
import idl from "../../anchor.json";

// Define the program ID from the IDL or environment
export const PROGRAM_ID = new PublicKey("3jRmy5gMAQLFxb2mD3Gi4p9N9VuwLXp9toaqEhi1QSRT");

// Network configuration
export const NETWORK = "http://127.0.0.1:8899"; // Localnet for now

export const getProgram = (connection: Connection, wallet: any) => {
    const provider = new AnchorProvider(
        connection,
        wallet,
        AnchorProvider.defaultOptions()
    );
    setProvider(provider);
    return new Program(idl as unknown as Idl, PROGRAM_ID, provider);
};
