"use client";

import { useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import { AnchorProvider, Program, BN } from "@coral-xyz/anchor";
import { PROGRAM_ID, GLOBAL_ID } from "@/lib/constants";
import idl from "@/lib/idl/clawswap.json";

const CATEGORIES = [
  { value: "development", label: "💻 Development", desc: "Code review, bug fixes, smart contracts" },
  { value: "data", label: "📊 Data Analysis", desc: "Sentiment, trends, market data" },
  { value: "design", label: "🎨 Design", desc: "UI/UX, graphics, branding" },
  { value: "writing", label: "✍️ Writing", desc: "Content, docs, copywriting" },
  { value: "research", label: "🔬 Research", desc: "Market research, analysis, reports" },
  { value: "ai-ml", label: "🧠 AI/ML", desc: "Model training, inference, NLP" },
  { value: "defi", label: "💰 DeFi", desc: "Yield strategies, arbitrage, analytics" },
  { value: "other", label: "🔧 Other", desc: "Everything else" },
];

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function CreateNeedModal({ isOpen, onClose, onSuccess }: Props) {
  const { connection } = useConnection();
  const wallet = useWallet();
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    title: "",
    description: "",
    category: "development",
    budget: "0.1",
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
      const needId = globalAccount.needCounter.toNumber();
      const needPda = PublicKey.findProgramAddressSync(
        [Buffer.from("need"), new BN(needId).toArrayLike(Buffer, "le", 8)],
        PROGRAM_ID
      )[0];

      await program.methods
        .createNeed(
          form.title,
          form.description,
          form.category,
          new BN(Math.round(parseFloat(form.budget) * 1e9)),
          null
        )
        .accounts({
          global: globalPda,
          need: needPda,
          creator: wallet.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      onSuccess();
      onClose();
      setForm({ title: "", description: "", category: "development", budget: "0.1" });
      setStep(1);
    } catch (error: any) {
      console.error("Error creating need:", error);
      alert(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-[#111111] rounded-2xl w-full max-w-lg border border-white/[0.06] overflow-hidden">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-white/[0.06]">
          <div>
            <h2 className="text-xl font-bold text-[#F7F7F7]">Post a Need</h2>
            <p className="text-sm text-[#505050] mt-0.5">
              Step {step} of 2 — {step === 1 ? "What do you need?" : "Details & Budget"}
            </p>
          </div>
          <button
            onClick={() => { onClose(); setStep(1); }}
            className="text-[#7E7E7E] hover:text-white text-xl"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <label className="text-sm text-[#7E7E7E] block mb-2">
                  Category
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {CATEGORIES.map((cat) => (
                    <button
                      key={cat.value}
                      type="button"
                      onClick={() => setForm({ ...form, category: cat.value })}
                      className={`text-left p-3 rounded-lg border transition-all ${
                        form.category === cat.value
                          ? "border-[#25D0AB] bg-[#25D0AB]/10"
                          : "border-white/[0.06] bg-white/5 hover:bg-white/[0.07]"
                      }`}
                    >
                      <p className="text-sm font-medium text-white">
                        {cat.label}
                      </p>
                      <p className="text-xs text-[#505050]">{cat.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="button"
                onClick={() => setStep(2)}
                className="w-full py-3 bg-gradient-to-r from-[#25D0AB] to-[#70E1C8] rounded-lg font-semibold hover:brightness-110 transition-all text-[#0A0A0A]"
              >
                Next →
              </button>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div>
                <label className="text-sm text-[#7E7E7E] block mb-1">
                  Title
                </label>
                <input
                  type="text"
                  required
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="w-full bg-[#0A0A0A] border border-white/[0.06] rounded-lg px-4 py-2.5 text-white focus:border-[#25D0AB] focus:outline-none"
                  placeholder="e.g., Analyze sentiment of 500 Solana tweets"
                  maxLength={64}
                />
                <p className="text-xs text-[#505050] mt-1">
                  {form.title.length}/64 characters
                </p>
              </div>

              <div>
                <label className="text-sm text-[#7E7E7E] block mb-1">
                  Description
                </label>
                <textarea
                  required
                  rows={4}
                  value={form.description}
                  onChange={(e) =>
                    setForm({ ...form, description: e.target.value })
                  }
                  className="w-full bg-[#0A0A0A] border border-white/[0.06] rounded-lg px-4 py-2.5 text-white focus:border-[#25D0AB] focus:outline-none resize-none"
                  placeholder="Describe exactly what you need, expected output format, and any requirements..."
                  maxLength={256}
                />
                <p className="text-xs text-[#505050] mt-1">
                  {form.description.length}/256 characters
                </p>
              </div>

              <div>
                <label className="text-sm text-[#7E7E7E] block mb-1">
                  Budget (SOL)
                </label>
                <div className="flex gap-2">
                  {["0.01", "0.05", "0.1", "0.5", "1"].map((amount) => (
                    <button
                      key={amount}
                      type="button"
                      onClick={() => setForm({ ...form, budget: amount })}
                      className={`px-3 py-1.5 rounded-lg text-sm transition-all ${
                        form.budget === amount
                          ? "bg-[#25D0AB] text-[#0A0A0A]"
                          : "bg-white/5 text-[#7E7E7E] hover:bg-white/10"
                      }`}
                    >
                      {amount}
                    </button>
                  ))}
                  <input
                    type="number"
                    step="0.001"
                    min="0.001"
                    required
                    value={form.budget}
                    onChange={(e) =>
                      setForm({ ...form, budget: e.target.value })
                    }
                    className="flex-1 bg-[#0A0A0A] border border-white/[0.06] rounded-lg px-3 py-1.5 text-white text-sm focus:border-[#25D0AB] focus:outline-none"
                    placeholder="Custom"
                  />
                </div>
              </div>

              {/* Summary */}
              <div className="bg-[#0A0A0A] rounded-lg p-4 border border-white/[0.06]">
                <p className="text-xs text-[#505050] mb-2">Summary</p>
                <div className="flex justify-between text-sm">
                  <span className="text-[#7E7E7E]">Category</span>
                  <span className="text-white">
                    {CATEGORIES.find((c) => c.value === form.category)?.label}
                  </span>
                </div>
                <div className="flex justify-between text-sm mt-1">
                  <span className="text-[#7E7E7E]">Budget</span>
                  <span className="text-[#25D0AB] font-semibold">
                    {form.budget} SOL
                  </span>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="px-6 py-3 bg-white/5 border border-white/[0.06] rounded-lg font-semibold hover:bg-white/10 transition-all"
                >
                  ← Back
                </button>
                <button
                  type="submit"
                  disabled={loading || !wallet.publicKey}
                  className="flex-1 py-3 bg-gradient-to-r from-[#25D0AB] to-[#70E1C8] rounded-lg font-semibold hover:brightness-110 transition-all disabled:opacity-50 disabled:cursor-not-allowed text-[#0A0A0A]"
                >
                  {loading
                    ? "Creating..."
                    : !wallet.publicKey
                    ? "Connect Wallet First"
                    : `Post Need (${form.budget} SOL budget)`}
                </button>
              </div>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
