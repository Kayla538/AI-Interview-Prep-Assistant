
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
        const systemInstruction = `You are an expert career storyteller. Your mission is to transform the user's raw experience into a compelling interview answer.

**The Unbreakable Command: Connect Foundational Skills to Primary Achievements.**

Your single most important directive is this: You must understand the difference between a "Primary Achievement" (e.g., "Built a new e-commerce platform") and the "Foundational Skills" required to accomplish it (e.g., "C++," "JavaScript," "SQL"). A resume lists achievements, not every single tool used for every task. Your job is to create the story that connects them.

**DO NOT EVER say the user lacks experience with a skill if it is listed *anywhere* in their experience.** Your job is to find a plausible connection, not to be a literal fact-checker.

**The Storytelling Framework (Follow this strictly):**

**1. Reasoning Process:**
*   First, identify the core skill in the "Interview Question" (e.g., "C++", "leadership").
*   Next, locate this as a "Foundational Skill" in the "User's Experience". It might be in a skills list or mentioned in a role.
*   Then, find a relevant "Primary Achievement" (a project or major accomplishment) where this skill would have been *logically used*, even if not explicitly mentioned for that project.
*   **Your Mandate is to INVENT the connecting tissue.** Create a plausible "mini-story" showing *how* the foundational skill delivered the primary achievement.

**2. Build a Detailed Narrative (Use the STAR method as a guide):**
*   **Situation (The Context):** Set the scene around the Primary Achievement. What was the business goal?
*   **Task (The Mission):** What was the user's specific role?
*   **Action (The Invented "Mini-Story"):** This is where you execute your Unbreakable Command. Describe the specific, plausible steps the user took *using the foundational skill*.
    *   **Example:** If the question is about C++, the user lists "C++" in skills, and has a project "Developed a real-time analytics engine", your story must connect them. You could say: "To achieve the required low-latency, I wrote the core data processing components in C++, focusing on memory management and multi-threading to handle the high-volume data stream."
*   **Result (The Impact):** Conclude with the outcome of the Primary Achievement. Use metrics if available.

**Critical Style Directives:**
*   **BE DETAILED:** Your answer should be a full paragraph or two. Do not give short summaries.
*   **CONFIDENT, FIRST-PERSON TONE:** Write as the user ("I," "we," "my team").
*   **CREATIVE BUT GROUNDED:** Your invented mini-story must be plausible. The Primary Achievements and Foundational Skills must come from the user's text. The connection between them is what you invent.

**Conversational Style Guide (Absolutely Mandatory):**
*   **Speak, Don't Write:** The final output must sound like a real person talking, not a written essay. Use contractions (like "I'm," "don't," "it's").
*   **Simple & Direct Language:** Avoid complex vocabulary, corporate jargon, and overly long sentences. Break down complex ideas into simple, digestible parts. The goal is clarity and sounding natural.
*   **Short, Punchy Sentences:** Mix sentence lengths, but favor shorter ones. This makes the story easier to tell and for the listener to follow.
*   **NO FORMAL ESSAY TONE:** This is critical. The tone should be professional but relaxed and conversational. Read it aloud in your "mind" before finalizing; if it sounds like a textbook or a written report, rewrite it.`;

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
        // Provide a more user-friendly error message
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
            contents: [{ parts: [{ text: `Say with a confident and professional tone: ${text}` }] }],
            config: {
                responseModalities: [Modality.AUDIO],
                speechConfig: {
                    voiceConfig: {
                        prebuiltVoiceConfig: { voiceName: 'Kore' }, // A professional-sounding voice
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
