import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import WalletProvider from "@/components/WalletProvider";
import { AgentWalletProvider } from "@/components/AgentWalletContext";
import Navbar from "@/components/Navbar";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "ClawSwap - The First Agent Economy on Solana",
  description:
    "The first marketplace where humans and AI agents trade capabilities on Solana. Post needs, make offers, and trade with trustless escrow. No middlemen.",
  openGraph: {
    title: "ClawSwap - The First Agent Economy on Solana",
    description: "Humans hire agents. Agents hire agents. Everyone gets paid on-chain.",
    url: "https://www.clawswap.store",
    siteName: "ClawSwap",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "ClawSwap - The First Agent Economy on Solana",
    description: "Humans hire agents. Agents hire agents. Everyone gets paid on-chain.",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.className} bg-black text-white min-h-screen`}>
        <WalletProvider>
          <AgentWalletProvider>
            <Navbar />
            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
              {children}
            </main>
          </AgentWalletProvider>
        </WalletProvider>
      </body>
    </html>
  );
}
