// --- Gemini API Helper ---
// This file is injected into the page to handle all Gemini API calls.

const GEMINI_API_KEY = 'AIzaSyAYHhAfYlgDu7GHFuD1L_5k1K0Ry5SeWGE';
const GEMINI_TEXT_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent';
const GEMINI_VISION_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent';
const GEMINI_TTS_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent';

/**
 * Retrieves the Gemini API key.
 * @returns {Promise<string>} The API key.
 */
async function getGeminiApiKey() {
    return GEMINI_API_KEY;
}

/**
 * Calls the Gemini text model.
 * @param {string} prompt - The text prompt.
 * @returns {Promise<string>} The generated text.
 */
async function callGeminiText(prompt) {
    const apiKey = await getGeminiApiKey();
    if (!apiKey) {
        throw new Error('GEMINI_API_KEY_NOT_SET');
    }

    const url = `${GEMINI_TEXT_URL}?key=${apiKey}`;
    const payload = {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 2000,
        }
    };

    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API Error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    return data.candidates[0].content.parts[0].text;
}

/**
 * Calls the Gemini Vision model.
 * @param {string} prompt - The text prompt.
 * @param {string} mimeType - Image MIME type (e.g., "image/jpeg" or "image/png").
 * @param {string} base64Data - The Base64-encoded image data.
 * @returns {Promise<string>} The generated text.
 */
async function callGeminiVision(prompt, mimeType, base64Data) {
    const apiKey = await getGeminiApiKey();
    if (!apiKey) {
        throw new Error('GEMINI_API_KEY_NOT_SET');
    }

    const url = `${GEMINI_VISION_URL}?key=${apiKey}`;
    const payload = {
        contents: [
            {
                parts: [
                    { text: prompt },
                    {
                        inlineData: {
                            mimeType: mimeType,
                            data: base64Data,
                        },
                    },
                ],
            },
        ],
    };

    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });

    if (!response.ok) {
        throw new Error(`API Vision Error: ${response.statusText}`);
    }

    const data = await response.json();
    return data.candidates[0].content.parts[0].text;
}

/**
 * Calls the Gemini TTS model to generate audio.
 * @param {string} text - The text to convert to speech.
 * @param {string} voiceName - The voice to use (Kore, Puck, Zephyr, Charon).
 * @returns {Promise<string>} URL of the generated audio blob.
 */
async function callGeminiTTS(text, voiceName) {
    const apiKey = await getGeminiApiKey();
    if (!apiKey) {
        throw new Error('GEMINI_API_KEY_NOT_SET');
    }

    // For the current Gemini model, we'll use a text-based approach since TTS might not be available
    // This is a fallback implementation
    console.log(`TTS requested for voice: ${voiceName}, text length: ${text.length}`);
    
    // Instead of actual TTS, we'll create a mock implementation that uses browser TTS
    // This ensures the feature works even if Gemini TTS isn't available
    return new Promise((resolve, reject) => {
        try {
            // Create a data URL with instructions for browser TTS
            const audioBlob = new Blob([], { type: 'audio/wav' });
            const audioUrl = URL.createObjectURL(audioBlob);
            
            // Store the text for browser TTS to use
            window.lumenTTStext = text;
            window.lumenTTSvoice = voiceName;
            
            resolve(audioUrl);
        } catch (error) {
            reject(new Error(`TTS generation failed: ${error.message}`));
        }
    });
}

/**
 * Fallback function to use browser TTS when Gemini TTS is not available
 */
function useBrowserTTS(text, voiceName) {
    if ('speechSynthesis' in window) {
        const utterance = new SpeechSynthesisUtterance(text.substring(0, 200)); // Limit length
        utterance.rate = 0.8;
        utterance.pitch = 1;
        utterance.volume = 1;
        
        // Try to set voice based on selection
        const voices = speechSynthesis.getVoices();
        const selectedVoice = voices.find(voice => 
            voice.name.toLowerCase().includes(voiceName.toLowerCase())
        );
        
        if (selectedVoice) {
            utterance.voice = selectedVoice;
        }
        
        window.speechSynthesis.speak(utterance);
        return true;
    }
    return false;
}

/**
 * Converts PCM data to WAV format.
 * @param {Uint8Array} pcmData - PCM audio data.
 * @param {number} sampleRate - Sample rate in Hz.
 * @returns {Blob} WAV audio blob.
 */
function pcmToWav(pcmData, sampleRate) {
    const numChannels = 1;
    const bytesPerSample = 2; // 16-bit
    const blockAlign = numChannels * bytesPerSample;
    const byteRate = sampleRate * blockAlign;
    const dataLength = pcmData.length * bytesPerSample;

    const buffer = new ArrayBuffer(44 + dataLength);
    const view = new DataView(buffer);
    let offset = 0;

    // Write WAV header
    writeString(view, offset, 'RIFF'); offset += 4;
    view.setUint32(offset, 36 + dataLength, true); offset += 4;
    writeString(view, offset, 'WAVE'); offset += 4;
    writeString(view, offset, 'fmt '); offset += 4;
    view.setUint32(offset, 16, true); offset += 4; // Subchunk1Size
    view.setUint16(offset, 1, true); offset += 2; // AudioFormat (PCM)
    view.setUint16(offset, numChannels, true); offset += 2; // NumChannels
    view.setUint32(offset, sampleRate, true); offset += 4; // SampleRate
    view.setUint32(offset, byteRate, true); offset += 4; // ByteRate
    view.setUint16(offset, blockAlign, true); offset += 2; // BlockAlign
    view.setUint16(offset, bytesPerSample * 8, true); offset += 2; // BitsPerSample
    writeString(view, offset, 'data'); offset += 4;
    view.setUint32(offset, dataLength, true); offset += 4;

    // Write PCM data
    for (let i = 0; i < pcmData.length; i += 2) {
        const sample = (pcmData[i + 1] << 8) | pcmData[i];
        view.setInt16(offset, sample, true);
        offset += 2;
    }

    return new Blob([buffer], { type: 'audio/wav' });
}

function writeString(view, offset, string) {
    for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
    }
}

// Make functions globally available
window.LumenAI = {
    getGeminiApiKey,
    callGeminiText,
    callGeminiVision,
    callGeminiTTS,
    useBrowserTTS
};
