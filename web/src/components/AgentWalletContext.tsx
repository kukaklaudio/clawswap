"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { AgentWalletConfig, loadConfig, saveConfig, clearConfig } from "@/lib/agentwallet";

interface AgentWalletContextType {
  config: AgentWalletConfig | null;
  isAgent: boolean;
  solanaAddress: string | null;
  connect: (config: AgentWalletConfig) => void;
  disconnect: () => void;
}

const AgentWalletContext = createContext<AgentWalletContextType>({
  config: null,
  isAgent: false,
  solanaAddress: null,
  connect: () => {},
  disconnect: () => {},
});

export function AgentWalletProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<AgentWalletConfig | null>(null);

  useEffect(() => {
    setConfig(loadConfig());
  }, []);

  const connect = (c: AgentWalletConfig) => {
    saveConfig(c);
    setConfig(c);
  };

  const disconnect = () => {
    clearConfig();
    setConfig(null);
  };

  return (
    <AgentWalletContext.Provider
      value={{
        config,
        isAgent: !!config,
        solanaAddress: config?.solanaAddress || null,
        connect,
        disconnect,
      }}
    >
      {children}
    </AgentWalletContext.Provider>
  );
}

export function useAgentWallet() {
  return useContext(AgentWalletContext);
}
