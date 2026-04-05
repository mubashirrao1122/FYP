import { Connection } from "@solana/web3.js";
import { RPC_ENDPOINT } from "./constants";

let connection: Connection | null = null;

export const getConnection = (): Connection => {
  if (!connection) {
    connection = new Connection(RPC_ENDPOINT, {
      commitment: "confirmed",
      confirmTransactionInitialTimeout: 60000,
    });
  }
  return connection;
};

export const resetConnection = () => {
  connection = null;
};
