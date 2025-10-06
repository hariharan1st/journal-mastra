import { Agent } from "@mastra/core/agent";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { loadToolConfiguration } from "../lib/parsing/tool-config-parser.js";
import { createDynamicToolGenerator } from "../services/dynamic-tool-generator.js";
import { ollama } from "../models/ollama.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Load configuration from file
 */
function loadConfig(configPath: string) {
  const configFile = readFileSync(configPath, "utf-8");
  return loadToolConfiguration(configFile);
}

/**
 * Create agent with dynamic tools from configuration
 *
 * @param configPath - Path to configuration JSON file
 * @returns Configured Mastra agent
 */
export async function createDynamicConfigAgent(
  configPath: string
): Promise<Agent> {
  // Load and validate configuration
  const config = loadConfig(configPath);

  // Generate tools from configuration
  const generator = createDynamicToolGenerator();
  const tools = await generator.generateTools(config);

  // Convert tools array to tools object for Mastra
  const toolsObject = tools.reduce(
    (acc, tool) => {
      acc[tool.id] = tool;
      return acc;
    },
    {} as Record<string, any>
  );

  // Create agent with generated tools
  const agent = new Agent({
    name: "dynamic-config-agent",
    instructions: `You are a helpful assistant with access to dynamic data logging tools.
    
You can help users log various types of data using the available tools. Each tool 
corresponds to a specific type of data entry (mood, habits, etc.).

When a user wants to log data:
1. Identify which tool is most appropriate
2. Gather all required information from the user
3. Validate the data matches the expected format
4. Use the tool to persist the data
5. Confirm successful logging to the user

Be conversational and helpful. Ask clarifying questions if needed.`,
    model: ollama.languageModel("qwen2.5-coder:7b"),
    tools: toolsObject,
  });

  return agent;
}

/**
 * Create mood tracking agent
 */
export async function createMoodTrackingAgent(): Promise<Agent> {
  const configPath = join(
    __dirname,
    "../../../config/examples/mood-tracker.json"
  );
  return createDynamicConfigAgent(configPath);
}

/**
 * Create habit tracking agent
 */
export async function createHabitTrackingAgent(): Promise<Agent> {
  const configPath = join(
    __dirname,
    "../../../config/examples/habit-tracker.json"
  );
  return createDynamicConfigAgent(configPath);
}

// Export default agent for testing
export const dynamicConfigAgent = await createMoodTrackingAgent();
