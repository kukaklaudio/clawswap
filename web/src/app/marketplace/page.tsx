"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useWallet } from "@solana/wallet-adapter-react";
import { api, Need } from "@/lib/api";
import NeedCard from "@/components/NeedCard";
import StatsBar from "@/components/StatsBar";
import CreateNeedModal from "@/components/CreateNeedModal";

export default function MarketplacePage() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#25D0AB]" />
        </div>
      }
    >
      <MarketplaceContent />
    </Suspense>
  );
}

function MarketplaceContent() {
  const searchParams = useSearchParams();
  const wallet = useWallet();
  const [needs, setNeeds] = useState<Need[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [showCreate, setShowCreate] = useState(
    searchParams.get("action") === "create"
  );
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  const fetchNeeds = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.getNeeds(filter === "all" ? undefined : filter);
      setNeeds(data);
    } catch (error) {
      console.error("Error fetching needs:", error);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    fetchNeeds();
    const interval = setInterval(fetchNeeds, 15000);
    return () => clearInterval(interval);
  }, [fetchNeeds]);

  const filteredNeeds = needs.filter((need) => {
    const matchesSearch =
      !searchQuery ||
      need.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      need.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory =
      categoryFilter === "all" || need.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const categories = ["all", ...new Set(needs.map((n) => n.category))];

  return (
    <div>
      <StatsBar />

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold text-[#F7F7F7]">Marketplace</h1>
          <p className="text-[#7E7E7E] mt-1">
            {filteredNeeds.length} need{filteredNeeds.length !== 1 ? "s" : ""} available
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="px-6 py-2.5 bg-gradient-to-r from-[#25D0AB] to-[#70E1C8] rounded-lg font-semibold hover:brightness-110 transition-all text-sm flex items-center gap-2 text-[#0A0A0A]"
        >
          <span>+</span> Post a Need
        </button>
      </div>

      {/* Search + Filters Bar */}
      <div className="bg-[#111111] rounded-xl p-4 border border-white/[0.06] mb-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search needs..."
              className="w-full bg-[#0A0A0A] border border-white/[0.06] rounded-lg px-4 py-2 text-white placeholder-[#505050] focus:border-[#25D0AB] focus:outline-none text-sm"
            />
          </div>

          <div className="flex gap-2">
            {["all", "open", "inProgress", "completed"].map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                  filter === f
                    ? "bg-[#25D0AB] text-[#0A0A0A]"
                    : "bg-white/5 text-[#7E7E7E] hover:bg-white/10"
                }`}
              >
                {f === "all"
                  ? "All"
                  : f === "inProgress"
                  ? "In Progress"
                  : f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>

          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="bg-[#0A0A0A] border border-white/[0.06] rounded-lg px-3 py-2 text-sm text-white focus:border-[#25D0AB] focus:outline-none"
          >
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat === "all" ? "All Categories" : cat.charAt(0).toUpperCase() + cat.slice(1)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="flex justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#25D0AB]" />
        </div>
      ) : filteredNeeds.length === 0 ? (
        <div className="text-center py-20 bg-[#111111] rounded-2xl border border-white/[0.06]">
          <span className="text-5xl mb-4 block">🔍</span>
          <p className="text-[#7E7E7E] text-lg mb-2">No needs found</p>
          <p className="text-[#505050] text-sm mb-6">
            {searchQuery || categoryFilter !== "all"
              ? "Try adjusting your filters"
              : "Be the first to post a need!"}
          </p>
          <button
            onClick={() => setShowCreate(true)}
            className="px-6 py-2.5 bg-gradient-to-r from-[#25D0AB] to-[#70E1C8] rounded-lg font-semibold text-sm text-[#0A0A0A]"
          >
            + Post a Need
          </button>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredNeeds.map((need) => (
            <NeedCard key={need.id} need={need} />
          ))}
        </div>
      )}

      <CreateNeedModal
        isOpen={showCreate}
        onClose={() => setShowCreate(false)}
        onSuccess={fetchNeeds}
      />
    </div>
  );
}
