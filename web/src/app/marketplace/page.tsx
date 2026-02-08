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
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500" />
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
    // Auto-refresh every 15s
    const interval = setInterval(fetchNeeds, 15000);
    return () => clearInterval(interval);
  }, [fetchNeeds]);

  // Client-side filtering
  const filteredNeeds = needs.filter((need) => {
    const matchesSearch =
      !searchQuery ||
      need.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      need.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory =
      categoryFilter === "all" || need.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  // Get unique categories
  const categories = ["all", ...new Set(needs.map((n) => n.category))];

  return (
    <div>
      <StatsBar />

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold text-white">Marketplace</h1>
          <p className="text-gray-400 mt-1">
            {filteredNeeds.length} need{filteredNeeds.length !== 1 ? "s" : ""} available
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="px-6 py-2.5 bg-gradient-to-r from-purple-600 to-pink-600 rounded-lg font-semibold hover:from-purple-500 hover:to-pink-500 transition-all text-sm flex items-center gap-2"
        >
          <span>+</span> Post a Need
        </button>
      </div>

      {/* Search + Filters Bar */}
      <div className="bg-white/5 rounded-xl p-4 border border-white/10 mb-6">
        <div className="flex flex-col md:flex-row gap-4">
          {/* Search */}
          <div className="flex-1">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search needs..."
              className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:border-purple-500 focus:outline-none text-sm"
            />
          </div>

          {/* Status Filter */}
          <div className="flex gap-2">
            {["all", "open", "inProgress", "completed"].map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                  filter === f
                    ? "bg-purple-600 text-white"
                    : "bg-white/5 text-gray-400 hover:bg-white/10"
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

          {/* Category Filter */}
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-purple-500 focus:outline-none"
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
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500" />
        </div>
      ) : filteredNeeds.length === 0 ? (
        <div className="text-center py-20 bg-white/5 rounded-2xl border border-white/10">
          <span className="text-5xl mb-4 block">🔍</span>
          <p className="text-gray-400 text-lg mb-2">No needs found</p>
          <p className="text-gray-500 text-sm mb-6">
            {searchQuery || categoryFilter !== "all"
              ? "Try adjusting your filters"
              : "Be the first to post a need!"}
          </p>
          <button
            onClick={() => setShowCreate(true)}
            className="px-6 py-2.5 bg-gradient-to-r from-purple-600 to-pink-600 rounded-lg font-semibold text-sm"
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

      {/* Create Modal */}
      <CreateNeedModal
        isOpen={showCreate}
        onClose={() => setShowCreate(false)}
        onSuccess={fetchNeeds}
      />
    </div>
  );
}
