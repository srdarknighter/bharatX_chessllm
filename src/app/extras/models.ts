import {MultiModelLLM} from "./types";

export const llms: MultiModelLLM[] = [
    { provider: "OpenAI", model: "gpt-4o" },
    { provider: "OpenAI", model: "gpt-4o-mini" },
    { provider: "OpenAI", model: "gpt-4-turbo" },
    { provider: "OpenAI", model: "gpt-3.5-turbo" },
    { provider: "Mistral", model: "pixtral-12b-2409" },
    { provider: "Anthropic", model: "claude-3-5-sonnet-20240620" },
    { provider: "Google", model: "gemini-1.5-flash" },
    { provider: "Google", model: "gemini-1.5-pro" },
    { provider: "Human", model: "human"},
]