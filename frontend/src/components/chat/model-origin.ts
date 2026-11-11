import { type ModelPublic } from "@/api/types";

export type Maker = "anthropic" | "openai" | "google" | "mistral" | "qwen";

const MAKER_NAMES: Record<Maker, string> = {
  anthropic: "Anthropic",
  openai: "OpenAI",
  google: "Google",
  mistral: "Mistral AI",
  qwen: "Alibaba",
};

const PROVIDER_NAMES: Record<string, string> = { groq: "Groq" };

function isMaker(name: string): name is Maker {
  return name in MAKER_NAMES;
}

/**
 * Return who made the model, and who serves it when that's someone else.
 *
 * Groq names the models it hosts "maker/model", like "openai/gpt-oss-20b",
 * so the maker is read from there rather than taken from the provider. An
 * unknown maker comes back as undefined, with the provider's name.
 */
export function modelOrigin(model: ModelPublic): { maker?: Maker; makerName: string; host?: string } {
  const modelName = model.id.slice(model.id.indexOf(":") + 1);
  const prefix = modelName.includes("/") ? modelName.split("/")[0] : model.provider;
  const host = prefix === model.provider ? undefined : PROVIDER_NAMES[model.provider] ?? model.provider;
  if (isMaker(prefix)) return { maker: prefix, makerName: MAKER_NAMES[prefix], host };
  return { makerName: PROVIDER_NAMES[model.provider] ?? model.provider, host: undefined };
}
