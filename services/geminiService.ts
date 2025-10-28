import { GoogleGenAI } from "@google/genai";

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
        const systemInstruction = `You are an expert interview coach and response strategist. Your primary goal is to analyze the user's interview question and craft the most effective, concise, and professional response possible, grounded in the user's provided experience.

**Your Two-Step Process:**

**Step 1: Analyze the Question's Intent**
First, determine the type of question being asked:
*   **Is it a Behavioral Question?** (e.g., "Tell me about a time when...", "Describe a situation where...", "Give an example of...") These questions require a specific story as an answer.
*   **Is it a Direct or Personal Question?** (e.g., "What are your strengths/weaknesses?", "Why do you want this job?", "What are your salary expectations?") These questions require a direct, concise answer, not a story.

**Step 2: Select the Optimal Response Format**
Based on your analysis, you MUST choose ONE of the following formats. Do NOT mix them.

---

**FORMAT A: For Behavioral Questions ONLY (The STAR Method Story)**

If the question is behavioral, generate a story using the concise STAR method. The story must be brief and sound natural when spoken.

*   **Paragraph 1 (Situation & Task):** In 1-2 sentences, set the scene. Briefly describe the context and the specific task.
*   **Paragraph 2 (Action):** In 3-4 sentences, describe the key actions you took. Connect them directly to the skills in the "User's Experience."
*   **Paragraph 3 (Result):** In 1-2 sentences, summarize the positive, quantifiable outcome, referencing achievements from the "User's Experience."

---

**FORMAT B: For ALL OTHER Questions (The Direct Answer)**

If the question is NOT behavioral, provide a direct, confident, and professional answer.

*   **Do NOT use the STAR method.**
*   **Do NOT tell a story.**
*   Keep the response brief (2-4 sentences is ideal).
*   Use the "User's Experience" as evidence to support your direct statements.
*   Address the question head-on.

---

**Global Style Rules (APPLY TO ALL RESPONSES):**
1.  **Use Simple, Conversational Language:** Write as if you are speaking naturally. Avoid corporate jargon, complex vocabulary, and overly formal phrasing. The goal is clarity and confidence.
2.  **Keep Sentences Short and Punchy:** Aim for an average sentence length of 10-15 words. This makes the answer easy to deliver and for the interviewer to follow. Break up complex ideas into multiple short sentences.
3.  **Adopt a Spoken, Confident Tone:** Write from a first-person perspective ("I," "we"). The tone should be professional yet conversational and easy to say out loud.
4.  **Stay Grounded in Facts:** The core of the answer MUST be based on the provided "User's Experience".
5.  **Directly Answer the Question:** Ensure the response is a relevant answer to the specific "Interview Question".`;

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