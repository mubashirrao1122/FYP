import { Connection, PublicKey } from "@solana/web3.js";
import { Program } from "@project-serum/anchor";
import { getProgram as getAnchorProgram, getReadOnlyProgram, PROGRAM_ID } from "../anchor/setup";

// Anchor program instance cache
let program: Program | null = null;
let readOnlyProgram: Program | null = null;

/**
 * Get the Anchor program instance with wallet
 * @param connection Solana connection
 * @param wallet Connected wallet
 * @returns Anchor program instance or null
 */
export const getProgram = (connection: Connection, wallet?: any): Program | null => {
  if (!wallet) {
    // Return read-only program if no wallet provided
    return getReadOnlyProgramInstance(connection);
  }

  try {
    // Create new program instance with current wallet and connection
    program = getAnchorProgram(connection, wallet);
    return program;
  } catch (error) {
    console.error("Failed to get program:", error);
    return null;
  }
};

/**
 * Get read-only program instance (no wallet required)
 * @param connection Solana connection
 * @returns Read-only Anchor program instance
 */
export const getReadOnlyProgramInstance = (connection: Connection): Program | null => {
  try {
    // Use cached instance if available and connection matches
    if (!readOnlyProgram) {
      readOnlyProgram = getReadOnlyProgram(connection);
    }
    return readOnlyProgram;
  } catch (error) {
    console.error("Failed to get read-only program:", error);
    return null;
  }
};

/**
 * Reset program cache
 */
export const resetProgram = () => {
  program = null;
  readOnlyProgram = null;
};

/**
 * Initialize the Anchor program
 * @param connection Solana connection
 * @param wallet Connected wallet
 * @returns Initialized Anchor program
 */
export const initializeProgram = async (
  connection: Connection,
  wallet: any
): Promise<Program | null> => {
  try {
    if (!wallet) {
      console.warn("No wallet provided for program initialization");
      return getReadOnlyProgramInstance(connection);
    }

    program = getAnchorProgram(connection, wallet);

    if (!program) {
      throw new Error("Failed to initialize program");
    }

    console.log("Anchor program initialized successfully");
    return program;
  } catch (error) {
    console.error("Failed to initialize program:", error);
    return null;
  }
};

// Export program ID for easy access
export { PROGRAM_ID };
