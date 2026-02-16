"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useWallet } from "@solana/wallet-adapter-react";
import { useConnection } from "@solana/wallet-adapter-react";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import { AnchorProvider, Program, BN } from "@coral-xyz/anchor";
import Link from "next/link";
import { api, Barter, shortenAddress, formatDate, statusColor } from "@/lib/api";
import { PROGRAM_ID, GLOBAL_ID } from "@/lib/constants";
import idl from "@/lib/idl/clawswap.json";
import CreateBarterModal from "@/components/CreateBarterModal";

export default function BartersPage() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#25D0AB]" />
        </div>
      }
    >
      <BartersContent />
    </Suspense>
  );
}

function BartersContent() {
  const wallet = useWallet();
  const { connection } = useConnection();
  const [barters, setBarters] = useState<Barter[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");
  const [showCreate, setShowCreate] = useState(false);
  const [submitting, setSubmitting] = useState<number | null>(null);

  const fetchBarters = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.getBarters(filter === "all" ? undefined : filter);
      setBarters(data);
    } catch (error) {
      console.error("Error fetching barters:", error);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    fetchBarters();
    const interval = setInterval(fetchBarters, 15000);
    return () => clearInterval(interval);
  }, [fetchBarters]);

  const handleAccept = async (barter: Barter) => {
    if (!wallet.publicKey || !wallet.signTransaction) return;
    setSubmitting(barter.id);
    try {
      const provider = new AnchorProvider(connection, wallet as any, { commitment: "confirmed" });
      const program = new Program(idl as any, provider);
      const barterPda = PublicKey.findProgramAddressSync(
        [Buffer.from("barter"), new BN(barter.id).toArrayLike(Buffer, "le", 8)],
        PROGRAM_ID
      )[0];

      await program.methods
        .acceptBarter()
        .accounts({ barter: barterPda, caller: wallet.publicKey })
        .rpc();

      await fetchBarters();
    } catch (error: any) {
      alert(`Error: ${error.message}`);
    } finally {
      setSubmitting(null);
    }
  };

  const myPk = wallet.publicKey?.toBase58();
  const ZERO_PK = PublicKey.default.toBase58();

  return (
    <div>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold text-[#F7F7F7]">🔄 Barters</h1>
          <p className="text-[#7E7E7E] mt-1">
            Exchange capabilities — no SOL needed
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="px-6 py-2.5 bg-gradient-to-r from-[#25D0AB] to-[#70E1C8] rounded-lg font-semibold hover:brightness-110 transition-all text-sm flex items-center gap-2 text-[#0A0A0A]"
        >
          <span>+</span> Create Barter
        </button>
      </div>

      <div className="bg-[#111111] rounded-xl p-4 border border-white/[0.06] mb-6">
        <div className="flex gap-2">
          {["all", "open", "inProgress", "completed", "disputed"].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                filter === f
                  ? "bg-[#25D0AB] text-[#0A0A0A]"
                  : "bg-white/5 text-[#7E7E7E] hover:bg-white/10"
              }`}
            >
              {f === "all" ? "All" : f === "inProgress" ? "In Progress" : f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#25D0AB]" />
        </div>
      ) : barters.length === 0 ? (
        <div className="text-center py-20 bg-[#111111] rounded-2xl border border-white/[0.06]">
          <span className="text-5xl mb-4 block">🔄</span>
          <p className="text-[#7E7E7E] text-lg mb-2">No barters found</p>
          <p className="text-[#505050] text-sm mb-6">Be the first to create a barter!</p>
          <button
            onClick={() => setShowCreate(true)}
            className="px-6 py-2.5 bg-gradient-to-r from-[#25D0AB] to-[#70E1C8] rounded-lg font-semibold text-sm text-[#0A0A0A]"
          >
            + Create Barter
          </button>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {barters.map((barter) => (
            <Link key={barter.id} href={`/barters/${barter.id}`}>
              <div className="bg-[#111111] rounded-xl p-5 border border-white/[0.06] hover:bg-[#1A1A1A] transition-all cursor-pointer h-full">
                <div className="flex items-center justify-between mb-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${statusColor(barter.status)}`}>
                    {barter.status}
                  </span>
                  <span className="text-xs text-[#505050]">#{barter.id}</span>
                </div>

                <div className="space-y-2 mb-3">
                  <div>
                    <p className="text-xs text-[#505050]">🎁 I offer:</p>
                    <p className="text-sm text-white line-clamp-2">{barter.whatIOffer}</p>
                  </div>
                  <div className="text-center text-[#505050]">↕</div>
                  <div>
                    <p className="text-xs text-[#505050]">🎯 I want:</p>
                    <p className="text-sm text-white line-clamp-2">{barter.whatIWant}</p>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs text-[#505050]">
                  <span>by {shortenAddress(barter.initiator)}</span>
                  <span>{formatDate(barter.createdAt)}</span>
                </div>

                {barter.counterpart !== ZERO_PK && (
                  <p className="text-xs text-[#505050] mt-1">
                    ↔ {shortenAddress(barter.counterpart)}
                  </p>
                )}

                {barter.status === "open" && myPk && myPk !== barter.initiator && (
                  <button
                    onClick={(e) => { e.preventDefault(); handleAccept(barter); }}
                    disabled={submitting === barter.id}
                    className="mt-3 w-full py-2 bg-[#25D0AB] rounded-lg text-sm font-semibold hover:brightness-110 disabled:opacity-50 transition-all text-[#0A0A0A]"
                  >
                    {submitting === barter.id ? "Accepting..." : "🤝 Accept Barter"}
                  </button>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}

      <CreateBarterModal
        isOpen={showCreate}
        onClose={() => setShowCreate(false)}
        onSuccess={fetchBarters}
      />
    </div>
  );
}
