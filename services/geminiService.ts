import { GoogleGenAI } from "@google/genai";

// Ensure the API key is available from environment variables
if (!process.env.API_KEY) {
    throw new Error("API_KEY environment variable not set.");
}

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

/**
 * Generates a tailored interview answer using the Gemini API.
 * @param experience - The user's professional experience, resume, or skills.
 * @param question - The interview question asked.
 * @returns A promise that resolves to the generated answer as a string.
 */
export const generateAnswer = async (experience: string, question: string): Promise<string> => {
    try {
        // Fix: Use systemInstruction for persona and instructions, as per Gemini API guidelines.
        const systemInstruction = `You are an expert interview coach. Your task is to generate a SUPER CONCISE and PUNCHY answer for a user in a live interview.

**CRITICAL RULES:**
- **BE EXTREMELY BRIEF:** The answer MUST be between three and five sentences. NO MORE. This is the most important rule.
- **SOUND HUMAN:** Use a confident, conversational tone. Write from the first-person ("I", "my team"). Avoid robotic or overly formal language.
- **GET STRAIGHT TO THE POINT:** Do not include any preamble or filler. Start with the core answer immediately.
- **USE THE USER'S EXPERIENCE:** Base the entire answer on the provided "User's Experience" context. Do not invent information.
- **FOCUS ON IMPACT:** For behavioral questions, briefly touch on the situation and action, but emphasize the positive result.`;

        const contents = `
            **User's Experience:**
            ---
            ${experience}
            ---

            **Interview Question:**
            "${question}"

            **Your Suggested Answer:**
        `;
        
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: contents,
            config: {
                systemInstruction: systemInstruction,
            },
        });

        return response.text;

    } catch (error) {
        console.error("Error generating answer with Gemini API:", error);
        // Provide a more user-friendly error message
        if (error instanceof Error && error.message.includes('API key not valid')) {
             throw new Error("The API key is invalid. Please check your configuration.");
        }
        throw new Error("Failed to generate an answer. Please try again later.");
    }
};