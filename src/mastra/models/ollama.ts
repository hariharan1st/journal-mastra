import { createOllama } from "ollama-ai-provider-v2";

export const ollama = createOllama({
  baseURL: "http://192.168.40.25:11434/api",
});
