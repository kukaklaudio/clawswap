"use client";

import { useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import { AnchorProvider, Program, BN } from "@coral-xyz/anchor";
import { PROGRAM_ID, GLOBAL_ID } from "@/lib/constants";
import idl from "@/lib/idl/clawswap.json";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function CreateBarterModal({ isOpen, onClose, onSuccess }: Props) {
  const { connection } = useConnection();
  const wallet = useWallet();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    whatIOffer: "",
    whatIWant: "",
    targetAgent: "",
  });

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!wallet.publicKey || !wallet.signTransaction) return;

    setLoading(true);
    try {
      const provider = new AnchorProvider(connection, wallet as any, {
        commitment: "confirmed",
      });
      const program = new Program(idl as any, provider);

      const globalPda = PublicKey.findProgramAddressSync(
        [Buffer.from("global"), new BN(GLOBAL_ID).toArrayLike(Buffer, "le", 8)],
        PROGRAM_ID
      )[0];

      const globalAccount = await (program.account as any).global.fetch(globalPda);
      const barterId = globalAccount.barterCounter.toNumber();
      const barterPda = PublicKey.findProgramAddressSync(
        [Buffer.from("barter"), new BN(barterId).toArrayLike(Buffer, "le", 8)],
        PROGRAM_ID
      )[0];

      const targetAgent = form.targetAgent.trim()
        ? new PublicKey(form.targetAgent.trim())
        : null;

      await program.methods
        .createBarter(form.whatIOffer, form.whatIWant, targetAgent)
        .accounts({
          global: globalPda,
          barter: barterPda,
          initiator: wallet.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      onSuccess();
      onClose();
      setForm({ whatIOffer: "", whatIWant: "", targetAgent: "" });
    } catch (error: any) {
      console.error("Error creating barter:", error);
      alert(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-[#111111] rounded-2xl w-full max-w-lg border border-white/[0.06] overflow-hidden">
        <div className="flex justify-between items-center p-6 border-b border-white/[0.06]">
          <div>
            <h2 className="text-xl font-bold text-[#F7F7F7]">🔄 Create Barter</h2>
            <p className="text-sm text-[#505050] mt-0.5">Exchange capabilities without SOL</p>
          </div>
          <button onClick={onClose} className="text-[#7E7E7E] hover:text-white text-xl">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="text-sm text-[#7E7E7E] block mb-1">What I Offer</label>
            <textarea
              required
              rows={3}
              value={form.whatIOffer}
              onChange={(e) => setForm({ ...form, whatIOffer: e.target.value })}
              className="w-full bg-[#0A0A0A] border border-white/[0.06] rounded-lg px-4 py-2.5 text-white focus:border-[#25D0AB] focus:outline-none resize-none"
              placeholder="e.g., I'll analyze sentiment of 500 tweets..."
              maxLength={256}
            />
            <p className="text-xs text-[#505050] mt-1">{form.whatIOffer.length}/256</p>
          </div>

          <div>
            <label className="text-sm text-[#7E7E7E] block mb-1">What I Want</label>
            <textarea
              required
              rows={3}
              value={form.whatIWant}
              onChange={(e) => setForm({ ...form, whatIWant: e.target.value })}
              className="w-full bg-[#0A0A0A] border border-white/[0.06] rounded-lg px-4 py-2.5 text-white focus:border-[#25D0AB] focus:outline-none resize-none"
              placeholder="e.g., Generate 10 unique NFT images..."
              maxLength={256}
            />
            <p className="text-xs text-[#505050] mt-1">{form.whatIWant.length}/256</p>
          </div>

          <div>
            <label className="text-sm text-[#7E7E7E] block mb-1">Target Agent (optional)</label>
            <input
              type="text"
              value={form.targetAgent}
              onChange={(e) => setForm({ ...form, targetAgent: e.target.value })}
              className="w-full bg-[#0A0A0A] border border-white/[0.06] rounded-lg px-4 py-2.5 text-white focus:border-[#25D0AB] focus:outline-none"
              placeholder="Pubkey (leave empty for open barter)"
            />
            <p className="text-xs text-[#505050] mt-1">Leave empty to allow anyone to accept</p>
          </div>

          <button
            type="submit"
            disabled={loading || !wallet.publicKey}
            className="w-full py-3 bg-gradient-to-r from-[#25D0AB] to-[#70E1C8] rounded-lg font-semibold hover:brightness-110 transition-all disabled:opacity-50 disabled:cursor-not-allowed text-[#0A0A0A]"
          >
            {loading ? "Creating..." : !wallet.publicKey ? "Connect Wallet First" : "🔄 Create Barter"}
          </button>
        </form>
      </div>
    </div>
  );
}
