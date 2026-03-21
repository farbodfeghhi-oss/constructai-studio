import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export type AIProvider = "perplexity" | "monica";

interface ProviderSelectProps {
  value: AIProvider;
  onChange: (value: AIProvider) => void;
  className?: string;
}

export function ProviderSelect({ value, onChange, className }: ProviderSelectProps) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as AIProvider)}>
      <SelectTrigger className={className || "w-[180px]"}>
        <SelectValue placeholder="KI-Anbieter" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="perplexity">🔍 Perplexity</SelectItem>
        <SelectItem value="monica">🤖 Monica AI</SelectItem>
      </SelectContent>
    </Select>
  );
}
