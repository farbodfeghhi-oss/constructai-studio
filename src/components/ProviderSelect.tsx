import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export type AIProvider = "perplexity" | "monica";

export const MONICA_MODELS = [
  { value: "gpt-4o", label: "GPT-4o (Standard)" },
  { value: "gpt-4.1", label: "GPT-4.1" },
  { value: "gpt-4.1-mini", label: "GPT-4.1 Mini" },
  { value: "gpt-4o-mini", label: "GPT-4o Mini" },
  { value: "claude-sonnet-4-20250514", label: "Claude Sonnet 4" },
  { value: "claude-3-7-sonnet-latest", label: "Claude 3.7 Sonnet" },
  { value: "gemini-2.5-pro", label: "Gemini 2.5 Pro" },
  { value: "gemini-2.5-flash", label: "Gemini 2.5 Flash" },
  { value: "deepseek-chat", label: "DeepSeek V3" },
  { value: "o4-mini", label: "o4-mini (Reasoning)" },
] as const;

export type MonicaModel = typeof MONICA_MODELS[number]["value"];

interface ProviderSelectProps {
  value: AIProvider;
  onChange: (value: AIProvider) => void;
  monicaModel?: MonicaModel;
  onMonicaModelChange?: (value: MonicaModel) => void;
  className?: string;
}

export function ProviderSelect({ value, onChange, monicaModel, onMonicaModelChange, className }: ProviderSelectProps) {
  return (
    <div className="flex flex-wrap gap-2 items-center">
      <Select value={value} onValueChange={(v) => onChange(v as AIProvider)}>
        <SelectTrigger className={className || "w-[160px]"}>
          <SelectValue placeholder="KI-Anbieter" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="perplexity">🔍 Perplexity</SelectItem>
          <SelectItem value="monica">🤖 Monica AI</SelectItem>
        </SelectContent>
      </Select>

      {value === "monica" && onMonicaModelChange && (
        <Select value={monicaModel || "gpt-4o"} onValueChange={(v) => onMonicaModelChange(v as MonicaModel)}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Modell" />
          </SelectTrigger>
          <SelectContent>
            {MONICA_MODELS.map((m) => (
              <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  );
}
