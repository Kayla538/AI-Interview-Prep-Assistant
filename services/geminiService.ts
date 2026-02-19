
import { GoogleGenAI, Modality } from "@google/genai";

// Ensure the API key is available from environment variables
if (!process.env.API_KEY) {
    throw new Error("API_KEY environment variable not set.");
}

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

/**
 * Generates a tailored interview story using the Gemini API and streams the response.
 * @param experience - The user's professional experience, resume, or skills.
 * @param question - The interview question asked.
 * @param onChunk - A callback function that receives chunks of the generated story as they arrive.
 */
export const generateAnswerStream = async (
    experience: string,
    question: string,
    onChunk: (chunk: string) => void
): Promise<void> => {
    try {
        const systemInstruction = `You are a world-class career strategist. Your job is to pull off a compelling interview story that sounds like a real person—not a machine. 

**The Human-Professional Style (Mandatory):**
*   **Tone:** Avoid "Robotic Formality." Be direct and professional, but slightly conversational. Use active, punchy verbs like "pull off," "cave," "spill," "handle," or "hold up" instead of clinical, passive jargon.
*   **Structure (Burstiness):** Mix long, descriptive sentences—using dashes or commas for natural flow—with short, blunt ones. Do not use a perfectly linear or "orderly" sequence.
*   **Transitions:** NEVER use AI markers like "The main point is," "Furthermore," or "In conclusion." Instead, use human bridges: "Basically," "The thing is," "It’s essentially just," or "Look, what happened was."
*   **Vocabulary:** Blend technical terms with idiomatic phrasing. Avoid "Mechanical Precision."

**The Strategic Command:**
You must connect "Foundational Skills" (the tools) to "Primary Achievements" (the wins). If the user lists a skill anywhere, you use it. Don't claim they lack it. Invent the plausible "connecting tissue"—the mini-story of how that specific skill was the key to pulling off the big win.

**The Narrative Flow:**
1.  **The Hook:** Start with a human bridge. Set the scene for the Primary Achievement.
2.  **The Action (The "How"):** Describe the specific, plausible steps taken using the foundational skill. Use "Burstiness" here.
3.  **The Result:** What was the impact? Be direct.

**Style Example to Mimic:**
"Basically, we were trying to pull off a massive data migration without the system caving under the load... The thing is, I had to use SQL to optimize the query patterns—it was essentially just a way to see where the database finally broke—and we ended up cutting latency by 40%. It held up perfectly."`;

        const contents = `
            **User's Experience (The Facts):**
            ---
            ${experience}
            ---

            **Interview Question:**
            "${question}"

            **Your Story:**
        `;
        
        const response = await ai.models.generateContentStream({
            model: 'gemini-2.5-flash',
            contents: contents,
            config: {
                systemInstruction: systemInstruction,
            },
        });

        for await (const chunk of response) {
            if (chunk.text) {
                onChunk(chunk.text);
            }
        }

    } catch (error) {
        console.error("Error generating answer with Gemini API:", error);
        if (error instanceof Error && error.message.includes('API key not valid')) {
             throw new Error("The API key is invalid. Please check your configuration.");
        }
        throw new Error("Failed to generate a story. Please try again later.");
    }
};

/**
 * Generates speech from text using the Gemini TTS model.
 * @param text - The text to convert to speech.
 * @returns A base64 encoded audio string.
 */
export const generateSpeech = async (text: string): Promise<string> => {
    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash-preview-tts",
            contents: [{ parts: [{ text: `Say this with a natural, human, and professional conversational tone: ${text}` }] }],
            config: {
                responseModalities: [Modality.AUDIO],
                speechConfig: {
                    voiceConfig: {
                        prebuiltVoiceConfig: { voiceName: 'Kore' },
                    },
                },
            },
        });
        const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
        if (!base64Audio) {
            throw new Error("No audio data received from API.");
        }
        return base64Audio;

    } catch (error) {
        console.error("Error generating speech with Gemini API:", error);
        if (error instanceof Error && error.message.includes('API key not valid')) {
             throw new Error("The API key is invalid. Please check your configuration.");
        }
        throw new Error("Failed to generate audio. Please try again.");
    }
};
