
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { generateAnswerStream, generateSpeech } from './services/geminiService';
import { MicrophoneIcon, SparklesIcon, ExclamationTriangleIcon, StopCircleIcon, SpeakerIcon } from './components/Icons';

// Helper to check for SpeechRecognition API
const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
const isSpeechRecognitionSupported = !!SpeechRecognition;

// Helper to copy text to clipboard
const copyToClipboard =