import React, { useState, useEffect, useRef, useCallback } from 'react';
import { generateAnswerStream, generateSpeech } from './services/geminiService';
import { MicrophoneIcon, SparklesIcon, ExclamationTriangleIcon, StopCircleIcon, SpeakerIcon } from './components/Icons';

// Helper to check for SpeechRecognition API
// Fix: Cast window to `any` to access non-standard browser APIs without TypeScript errors.
const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
const isSpeechRecognitionSupported = !!SpeechRecognition;

// From Gemini API documentation for decoding raw PCM audio data.
function decode(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}


const App: React.FC = () => {
    const [currentScreen, setCurrentScreen] = useState<'experience' | 'interview'>('experience');
    const [userExperience, setUserExperience] = useState<string>('');
    const [finalTranscript, setFinalTranscript] = useState<string>('');
    const [interimTranscript, setInterimTranscript] = useState<string>('');
    const [generatedAnswer, setGeneratedAnswer] = useState<string>('');
    const [isListening, setIsListening] = useState<boolean>(false);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);

    const [isGeneratingSpeech, setIsGeneratingSpeech] = useState<boolean>(false);
    const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
    const audioContextRef = useRef<AudioContext | null>(null);
    const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);

    // Fix: Use `any` for the ref type to avoid a conflict between the `SpeechRecognition` constant and the `SpeechRecognition` interface type.
    const recognitionRef = useRef<any | null>(null);

    // Ref to hold the latest full transcript for use in the onend handler, avoiding stale state.
    const fullTranscriptRef = useRef('');

    const handleStopAudio = useCallback(() => {
        if (audioSourceRef.current) {
            audioSourceRef.current.stop();
            // onended will handle the state cleanup
        }
    }, []);


    const handleGenerateAnswer = useCallback(async (question: string) => {
        const trimmedQuestion = question.trim();
        if (!trimmedQuestion) {
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
        handleStopAudio();

        try {
            await generateAnswerStream(
                userExperience,
                trimmedQuestion,
                (chunk: string) => {
                    setGeneratedAnswer(prev => prev + chunk);
                }
            );
        } catch (err) {
            setError(err instanceof Error ? err.message : 'An unknown error occurred.');
        } finally {
            setIsLoading(false);
        }
    }, [userExperience, handleStopAudio]);

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
                setFinalTranscript('');
                setInterimTranscript('');
                fullTranscriptRef.current = '';
                setGeneratedAnswer('');
                handleStopAudio();
            };

            recognition.onend = () => {
                setIsListening(false);
                handleGenerateAnswerRef.current(fullTranscriptRef.current);
            };

            recognition.onerror = (event: any) => {
                setError(`Speech recognition error: ${event.error}`);
                setIsListening(false);
            };

            recognition.onresult = (event: any) => {
                let final_transcript = '';
                let interim_transcript = '';

                for (let i = 0; i < event.results.length; i++) {
                    const transcript = event.results[i][0].transcript;
                    if (event.results[i].isFinal) {
                        final_transcript += transcript;
                    } else {
                        interim_transcript += transcript;
                    }
                }
                
                setFinalTranscript(final_transcript);
                setInterimTranscript(interim_transcript);
                fullTranscriptRef.current = final_transcript + interim_transcript;
            };

            recognitionRef.current = recognition;
        } else if (currentScreen === 'interview' && !isSpeechRecognitionSupported) {
             setError("Speech recognition is not supported in this browser. Please use Chrome or another supported browser.");
        }

        // Cleanup function to stop recognition and audio
        return () => {
            recognitionRef.current?.stop();
            handleStopAudio();
        };
    }, [currentScreen, handleStopAudio]);



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

    const getAudioContext = () => {
        if (!audioContextRef.current) {
            audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
        }
        return audioContextRef.current;
    };

    const handlePlayAudio = async () => {
        if (isSpeaking) {
            handleStopAudio();
            return;
        }

        if (!generatedAnswer) return;

        setIsGeneratingSpeech(true);
        setError(null);

        try {
            const base64Audio = await generateSpeech(generatedAnswer);
            const audioContext = getAudioContext();
            
            const audioBytes = decode(base64Audio);
            const audioBuffer = await decodeAudioData(audioBytes, audioContext, 24000, 1);

            handleStopAudio(); // Stop any previous audio

            const source = audioContext.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(audioContext.destination);
            source.onended = () => {
                setIsSpeaking(false);
                if (audioSourceRef.current === source) {
                    audioSourceRef.current = null;
                }
            };
            source.start();

            audioSourceRef.current = source;
            setIsSpeaking(true);

        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to play audio.');
        } finally {
            setIsGeneratingSpeech(false);
        }
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
                                <div className="flex-shrink-0 flex items-center justify-between mb-2">
                                    <label className="block text-sm font-semibold text-slate-400 flex items-center gap-2">
                                        <SparklesIcon className="text-purple-400"/>
                                        Suggested Story:
                                    </label>
                                    {!isLoading && generatedAnswer && (
                                        <button
                                            onClick={handlePlayAudio}
                                            disabled={isGeneratingSpeech}
                                            className="p-2 rounded-full text-slate-400 hover:bg-slate-700 hover:text-cyan-300 transition-colors disabled:opacity-50 disabled:cursor-wait"
                                            aria-label={isSpeaking ? "Stop audio" : "Play suggested story"}
                                        >
                                            {isGeneratingSpeech ? (
                                                <SparklesIcon className="w-6 h-6 animate-spin text-cyan-400" />
                                            ) : isSpeaking ? (
                                                <StopCircleIcon className="w-6 h-6 text-red-500" />
                                            ) : (
                                                <SpeakerIcon className="w-6 h-6" />
                                            )}
                                        </button>
                                    )}
                                </div>
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
                                <div className="flex-grow w-full overflow-y-auto p-2">
                                    {finalTranscript || interimTranscript ? (
                                        <>
                                            <span className="text-slate-300">{finalTranscript}</span>
                                            <span className="text-slate-500">{interimTranscript}</span>
                                        </>
                                     ) : (
                                        <span className="text-slate-500">Waiting for question...</span>
                                     )}
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