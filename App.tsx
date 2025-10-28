import React, { useState, useEffect, useRef, useCallback } from 'react';
import { generateAnswerStream } from './services/geminiService';
import { MicrophoneIcon, SparklesIcon, ExclamationTriangleIcon } from './components/Icons';

// Helper to check for SpeechRecognition API
// Fix: Cast window to `any` to access non-standard browser APIs without TypeScript errors.
const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
const isSpeechRecognitionSupported = !!SpeechRecognition;

const App: React.FC = () => {
    const [currentScreen, setCurrentScreen] = useState<'experience' | 'interview'>('experience');
    const [userExperience, setUserExperience] = useState<string>('');
    const [transcribedQuestion, setTranscribedQuestion] = useState<string>('');
    const [generatedAnswer, setGeneratedAnswer] = useState<string>('');
    const [isListening, setIsListening] = useState<boolean>(false);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);

    // Fix: Use `any` for the ref type to avoid a conflict between the `SpeechRecognition` constant and the `SpeechRecognition` interface type.
    const recognitionRef = useRef<any | null>(null);

    // Refs to hold the latest state and callback to avoid stale closures in event handlers
    const transcribedQuestionRef = useRef(transcribedQuestion);
    useEffect(() => {
        transcribedQuestionRef.current = transcribedQuestion;
    }, [transcribedQuestion]);

    const handleGenerateAnswer = useCallback(async (question: string) => {
        if (!question.trim()) {
            setIsLoading(false);
            return;
        }
        if (!userExperience.trim()) {
            setError('User experience is missing. Please restart and provide your experience.');
            setIsLoading(false);
            return;
        }
        setError(null);
        setIsLoading(true);
        setGeneratedAnswer('');

        try {
            await generateAnswerStream(
                userExperience,
                question,
                (chunk: string) => {
                    setGeneratedAnswer(prev => prev + chunk);
                }
            );
        } catch (err) {
            setError(err instanceof Error ? err.message : 'An unknown error occurred.');
        } finally {
            setIsLoading(false);
        }
    }, [userExperience]);

    const handleGenerateAnswerRef = useRef(handleGenerateAnswer);
    useEffect(() => {
        handleGenerateAnswerRef.current = handleGenerateAnswer;
    }, [handleGenerateAnswer]);


    useEffect(() => {
        if (currentScreen === 'interview' && isSpeechRecognitionSupported) {
            const recognition = new SpeechRecognition();
            recognition.continuous = true;
            recognition.interimResults = true;
            recognition.lang = 'en-US';

            recognition.onstart = () => {
                setIsListening(true);
                setError(null);
                setTranscribedQuestion('');
                setGeneratedAnswer('');
            };

            recognition.onend = () => {
                setIsListening(false);
                handleGenerateAnswerRef.current(transcribedQuestionRef.current);
            };

            recognition.onerror = (event: any) => {
                setError(`Speech recognition error: ${event.error}`);
                setIsListening(false);
            };

            recognition.onresult = (event: any) => {
                let fullTranscript = '';
                for (let i = 0; i < event.results.length; i++) {
                    fullTranscript += event.results[i][0].transcript;
                }
                setTranscribedQuestion(fullTranscript);
            };

            recognitionRef.current = recognition;
        } else if (currentScreen === 'interview' && !isSpeechRecognitionSupported) {
             setError("Speech recognition is not supported in this browser. Please use Chrome or another supported browser.");
        }

        // Cleanup function to stop recognition if component unmounts
        return () => {
            recognitionRef.current?.stop();
        };
    }, [currentScreen]);

    const toggleListening = () => {
        if (!isSpeechRecognitionSupported || isLoading) return;

        if (isListening) {
            recognitionRef.current?.stop();
        } else {
            recognitionRef.current?.start();
        }
    };
    
    const handleStartInterview = () => {
        if (!userExperience.trim()) {
            setError('Please paste your experience before starting the interview.');
            return;
        }
        setError(null); // Clear any errors before switching screens
        setCurrentScreen('interview');
    };

    return (
        <div className="min-h-screen bg-slate-900 text-slate-100 font-sans p-4 sm:p-6 md:p-8">
            <div className="max-w-4xl mx-auto">
                <header className="text-center mb-8">
                    <h1 className="text-4xl sm:text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-cyan-400">
                        AI Story Co-Pilot
                    </h1>
                    <p className="text-slate-400 mt-2">
                        {currentScreen === 'experience' 
                            ? 'Turn your experience into compelling interview stories.'
                            : 'Listening for a question to build your story around.'}
                    </p>
                </header>

                <main>
                    {currentScreen === 'experience' ? (
                        <div className="space-y-8">
                            <div className="bg-slate-800 rounded-lg p-6 shadow-lg border border-slate-700">
                                <label htmlFor="experience" className="block text-xl font-semibold mb-3 text-cyan-300">
                                    Paste your experience here
                                </label>
                                <textarea
                                    id="experience"
                                    value={userExperience}
                                    onChange={(e) => setUserExperience(e.target.value)}
                                    placeholder="Paste your resume, job descriptions, or key skills here... These are the facts for your story."
                                    className="w-full h-72 p-4 bg-slate-900 border border-slate-600 rounded-md focus:ring-2 focus:ring-cyan-500 focus:outline-none transition-shadow resize-y"
                                    aria-label="Paste your experience here"
                                />
                            </div>
                            
                            {error && (
                                <div className="bg-red-900/50 border border-red-700 text-red-300 p-4 rounded-lg flex items-center gap-3">
                                    <ExclamationTriangleIcon />
                                    <p>{error}</p>
                                </div>
                            )}

                            <div className="text-center mt-6">
                                <button
                                    onClick={handleStartInterview}
                                    className="px-10 py-4 rounded-full text-xl font-bold transition-all duration-300 ease-in-out flex items-center justify-center gap-3 mx-auto shadow-lg bg-gradient-to-r from-purple-500 to-cyan-500 hover:scale-105"
                                >
                                    Start Interview
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {/* Control Panel */}
                            <div className="flex-shrink-0">
                                <button
                                    onClick={toggleListening}
                                    disabled={isLoading}
                                    aria-label={isListening ? 'Stop listening' : 'Start listening'}
                                    className={`w-full max-w-sm mx-auto px-6 py-4 rounded-lg text-lg font-bold transition-all duration-300 ease-in-out flex items-center justify-center gap-3 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed ${
                                        isListening
                                            ? 'bg-red-600 hover:bg-red-700 text-white'
                                            : 'bg-gradient-to-r from-purple-500 to-cyan-500 hover:scale-105'
                                    }`}
                                >
                                    {isListening ? (
                                        <>
                                            <span className="relative flex h-3 w-3">
                                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                                                <span className="relative inline-flex rounded-full h-3 w-3 bg-white"></span>
                                            </span>
                                            Listening...
                                        </>
                                    ) : (
                                        <>
                                            <MicrophoneIcon />
                                            Start Listening
                                        </>
                                    )}
                                </button>
                            </div>
                            
                            {error && (
                                <div className="bg-red-900/50 border border-red-700 text-red-300 p-3 rounded-lg flex items-center gap-3 text-sm" role="alert">
                                    <ExclamationTriangleIcon className="w-5 h-5"/>
                                    <p>{error}</p>
                                </div>
                            )}

                             {/* Suggested Answer Box */}
                            <div className={`min-h-[20rem] flex flex-col bg-slate-800 rounded-lg p-4 border shadow-lg transition-all duration-500 ${!isLoading && generatedAnswer ? 'border-purple-500/70 shadow-purple-500/30' : 'border-slate-700'}`}>
                                <label className="block text-sm font-semibold text-slate-400 mb-2 flex items-center gap-2 flex-shrink-0">
                                    <SparklesIcon className="text-purple-400"/>
                                    Suggested Story:
                                </label>
                                <div className="flex-grow w-full text-slate-300 overflow-y-auto p-2 whitespace-pre-wrap">
                                    {isLoading && !generatedAnswer && (
                                        <div className="flex items-center gap-3 text-cyan-300">
                                            <SparklesIcon className="animate-spin w-5 h-5" />
                                            <p>Crafting your story...</p>
                                        </div>
                                    )}
                                    {generatedAnswer}
                                    {!isLoading && !generatedAnswer && <span className="text-slate-500">Your suggested story will appear here...</span>}
                                </div>
                            </div>

                            {/* Interviewer Said Box */}
                            <div className="min-h-[8rem] flex flex-col bg-slate-800/50 rounded-lg p-4 border border-slate-700 shadow-inner">
                                <label className="block text-sm font-semibold text-slate-400 mb-2 flex-shrink-0">
                                    Interviewer Said:
                                </label>
                                <div className="flex-grow w-full text-slate-300 overflow-y-auto p-2">
                                    {transcribedQuestion || <span className="text-slate-500">Waiting for question...</span>}
                                </div>
                            </div>
                        </div>
                    )}
                </main>

                <footer className="text-center mt-12 text-slate-500 text-sm">
                    <p>Powered by Gemini</p>
                </footer>
            </div>
        </div>
    );
};

export default App;