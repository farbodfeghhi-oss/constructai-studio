import { HeroSection } from "@/components/dashboard/HeroSection";
import { StatsCounter } from "@/components/dashboard/StatsCounter";
import { CapabilityGrid } from "@/components/dashboard/CapabilityGrid";
import { LiveAnalysisFeed } from "@/components/dashboard/LiveAnalysisFeed";
import { AiModelsBar } from "@/components/dashboard/AiModelsBar";
import { useDashboardAssets } from "@/hooks/useDashboardAssets";

export default function Dashboard() {
  const { assets, generating, regenerate, regenerateKey, regeneratingKeys } = useDashboardAssets();

  return (
    <div className="p-4 md:p-8 space-y-8 max-w-[1600px] mx-auto">
      <HeroSection
        heroUrl={assets["hero"]}
        generating={generating}
        isRegenerating={regeneratingKeys.has("hero")}
        onRegenerate={() => regenerateKey("hero")}
        onRegenerateAll={regenerate}
      />
      <StatsCounter />
      <AiModelsBar />
      <CapabilityGrid assets={assets} regeneratingKeys={regeneratingKeys} onRegenerateKey={regenerateKey} />
      <LiveAnalysisFeed />
      <footer className="pt-8 pb-4 border-t border-border/40 text-center">
        <div className="flex flex-wrap items-center justify-center gap-2 text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
          <span>MechAI v1.0</span>
          <span>·</span>
          <span>Perplexity · Monica · Picsart</span>
          <span>·</span>
          <span>DIN / ISO / EN</span>
          <span>·</span>
          <span>Solid Edge Workflow</span>
        </div>
      </footer>
    </div>
  );
}
