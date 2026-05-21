// electron/llm/AssistLLM.ts
// MODE: Assist - Passive observation (low priority)
// Provides brief observational insights, NEVER suggests what to say
// Uses LLMHelper for centralized routing and universal prompts

import { LLMHelper } from "../LLMHelper";
import { UNIVERSAL_ASSIST_PROMPT } from "./prompts";

export class AssistLLM {
    private llmHelper: LLMHelper;

    constructor(llmHelper: LLMHelper) {
        this.llmHelper = llmHelper;
    }

    /**
     * Generate passive observational insight
     * @param context - Current conversation context
     * @returns Insight (no post-clamp; prompt enforces brevity)
     */
    async generate(context: string): Promise<string> {
        try {
            if (!context.trim()) {
                return "";
            }

            // Centralized LLM logic
            // Providing a specific instruction to be a proactive knowledge assistant
            const instruction = "Provide 1-3 highly relevant facts, definitions, or bullet points to help the candidate answer the current topic. Focus on technical concepts (APIs, SQL, Networking) or behavioral frameworks (STAR, de-escalation). Be extremely concise. Do NOT suggest what to say verbatim.";

            return await this.llmHelper.chat(
                instruction,
                undefined, // no image
                context,
                UNIVERSAL_ASSIST_PROMPT,
                "llama-3.1-8b-instant" // Force fast model for passive assist
            );

        } catch (error) {
            console.error("[AssistLLM] Generation failed:", error);
            return "";
        }
    }
}
