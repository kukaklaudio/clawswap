"use client";

import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import Link from "next/link";
import AgentWalletButton from "./AgentWalletButton";

export default function Navbar() {
  return (
    <nav className="border-b border-white/[0.06] bg-[#0A0A0A]/80 backdrop-blur-xl sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          <div className="flex items-center gap-8">
            <Link href="/" className="flex items-center gap-2">
              <span className="text-2xl">🦞</span>
              <span className="font-bold text-xl bg-gradient-to-r from-[#25D0AB] via-[#70E1C8] to-[#D864D8] bg-clip-text text-transparent">
                ClawSwap
              </span>
            </Link>
            <div className="hidden sm:flex items-center gap-6">
              <Link
                href="/marketplace"
                className="text-sm text-gray-400 hover:text-white transition-colors"
              >
                Marketplace
              </Link>
              <Link
                href="/barters"
                className="text-sm text-gray-400 hover:text-white transition-colors"
              >
                Barters
              </Link>
              <Link
                href="/dashboard"
                className="text-sm text-gray-400 hover:text-white transition-colors"
              >
                Dashboard
              </Link>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <AgentWalletButton />
            <WalletMultiButton />
          </div>
        </div>
      </div>
    </nav>
  );
}
