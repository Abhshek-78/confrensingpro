# Confrencing Pro: Real-Time Voice Translation Implementation Guide

## Overview
This guide provides a step-by-step implementation plan for integrating real-time voice translation into the Confrencing Pro platform. The system will capture user audio, translate speech to text using DeepL API, translate to target language, convert to speech using TTS, and inject the translated audio back into the WebRTC stream for all participants.

---

## Part 1: Backend Architecture

### 1.1 High-Level Backend Flow

**Step 1: Understand the current WebRTC architecture**
- Identify where Socket.IO connections are established (socketManager.js)
- Note that currently, raw video/audio streams are handled via RTCPeerConnection
- Determine if you'll use SFU (Selective Forwarding Unit) or mesh topology
  - For translation: SFU is recommended (single server processes audio for all users)
  - Mesh topology would require each client to do translation (inefficient)

**Step 2: Choose your media server approach**
- Option A: Implement lightweight Node.js audio processor (recommended for MVP)
  - Use ffmpeg bindings or WebRTC libraries for audio manipulation
  - Pros: Simple deployment, reuses existing Node.js stack
  - Cons: Scales poorly with many participants
- Option B: Use managed SFU service (e.g., LiveKit Cloud)
  - Pros: Built for scaling, handles complex media operations
  - Cons: Additional costs, external dependency
- Option C: Self-hosted SFU (Janus, Pion, mediasoup)
  - Pros: Full control, scalable
  - Cons: Complex deployment, requires Go/JavaScript knowledge

**For this guide, we'll use Option A (Node.js audio processor) for MVP + migration path to Option B**

### 1.2 New Backend Directory Structure

```
backend/
├── src/
│   ├── app.js                           (main server, add translation routes)
│   ├── config/
│   │   ├── deepl.config.js              (DeepL API credentials and settings)
│   │   ├── tts.config.js                (TTS service credentials)
│   │   └── audio.config.js              (audio format specs: sample rate, codec)
│   ├── controller/
│   │   ├── socketManager.js             (existing - modify to handle audio streams)
│   │   ├── userController.js            (existing - add language preference endpoints)
│   │   └── translationController.js     (new - orchestrate translation pipeline)
│   ├── services/
│   │   ├── deeplVoiceService.js         (new - DeepL API wrapper)
│   │   ├── ttsService.js                (new - TTS API wrapper)
│   │   ├── audioProcessor.js            (new - audio encoding/decoding, mixing)
│   │   ├── translationPipeline.js       (new - coordinates STT → Translate → TTS)
│   │   └── userLanguageStore.js         (new - manage user language preferences in memory/DB)
│   ├── models/
│   │   ├── userSchema.js                (existing - add language preference fields)
│   │   └── translationSession.js        (new - track active translation sessions)
│   ├── route/
│   │   ├── userRoute.js                 (existing - add language update endpoint)
│   │   └── translationRoute.js          (new - audio stream endpoints)
│   ├── middleware/
│   │   └── audioAuth.js                 (new - validate audio stream requests)
│   └── utils/
│       ├── audioBuffer.js               (new - manage circular buffers for streaming)
│       └── errorHandler.js              (new or extend - translation-specific errors)
```

### 1.3 User Language Preferences - Database Schema

**Modify userSchema to include:**
- languageISpeak: String (ISO 639-1 code, e.g., "en", "es", "de")
- languageOthersHearMeIn: String (ISO 639-1 code, default = languageISpeak)
- translationEnabled: Boolean (default = true)
- createdAt, updatedAt: Timestamp

**Create translationSession schema:**
- sessionId: String (unique ID per meeting)
- userId: ObjectId (reference to user)
- roomId: String (meeting room identifier)
- activeTranslationPipeline: Boolean
- audioStreamStatus: String (enum: "inactive", "connecting", "active", "paused")
- deeplConnectionId: String (for multi-turn API tracking)
- startTime: Timestamp
- endTime: Timestamp (when session ends)

---

## Part 2: Audio Stream Handling via Socket.IO

### 2.1 Real-Time Audio Capture Protocol

**Socket.IO Event Flow (Frontend → Backend):**

**Event: "audio-chunk"**
- Payload structure:
  - userId: string (socket ID)
  - sessionId: string (meeting room ID)
  - audioBuffer: ArrayBuffer (raw PCM audio, typically 20ms chunks at 16kHz)
  - timestamp: number (milliseconds since start of stream)
  - sequenceNumber: number (for ordering and loss detection)

**Backend handler responsibilities:**
- Validate socket is in active meeting
- Verify user language preferences exist
- Queue audio chunk to user's translation pipeline
- Track audio loss if sequenceNumber gaps detected

### 2.2 Audio Format Specifications

**Standard format for this implementation:**
- Sample rate: 16 kHz (mono or stereo)
- Bit depth: 16-bit PCM
- Chunk duration: 20ms (320 samples at 16kHz)
- Codec: Raw PCM (can compress to Opus later if needed)
- Container: ArrayBuffer (raw bytes)

**Define audio.config.js constants:**
- Sample rate constant: 16000 Hz
- Channels: 1 (mono)
- Bits per sample: 16
- Chunk size in samples: 320 (20ms)
- Buffer size: 64 KB (holds ~10 seconds at 16kHz)

### 2.3 Streaming Connection Management

**In socketManager.js, add new Socket.IO namespace: "/audio"**
- Namespace separation keeps audio streams isolated from video events
- Allows independent connection pooling and error handling

**Socket events to emit from backend:**
- "translation-status": Reports current status (connecting, active, translated-ready)
- "translated-audio-ready": Signals that translated audio is available
- "stream-error": Notifies client of processing errors
- "language-updated": Confirms language preference change

---

## Part 3: DeepL Voice API Integration

### 3.1 DeepL Service Architecture

**In deeplVoiceService.js, implement:**

**Function: openRealtimeConnection()**
- Parameters: userId, sourceLanguage, targetLanguage, sessionId
- Logic:
  - Check API key validity from config
  - Establish WebSocket or HTTP streaming connection to DeepL
  - Create unique connection ID for this user
  - Set up error handlers and timeout management (30s inactivity threshold)
  - Return connection object with sessionHandle and metadata
- Store connection ID in userLanguageStore for reference

**Function: streamAudioToDeepL()**
- Parameters: connectionId, audioChunk (PCM buffer)
- Logic:
  - Encode PCM to format DeepL expects (typically WAV or base64)
  - Send to DeepL with stream ID and language pair info
  - Handle API rate limits (buffer if approaching limit)
  - Return immediately with transaction ID
- Should NOT block on response; translation happens asynchronously

**Function: receiveTranslatedText()**
- Parameters: connectionId
- Logic:
  - Listen on DeepL connection for partial and final transcriptions
  - Buffer text until sentence boundary detected
  - Store final translated text in temporary cache (Redis recommended)
  - Emit "translation-complete" event to translationPipeline
- Handle mid-stream interruptions

**Function: closeRealtimeConnection()**
- Parameters: connectionId
- Logic:
  - Send close frame to DeepL API
  - Flush remaining data
  - Clean up resources
  - Remove from active connections map

**Error Handling:**
- Retry logic: Exponential backoff for connection failures (1s, 2s, 4s, 8s max)
- Timeout: Close connection after 30s inactivity
- Rate limit: Queue requests if hitting 100 requests/min limit
- Invalid language pair: Return error code 400 with language list

### 3.2 DeepL Credentials Management

**In config/deepl.config.js:**
- Store DEEPL_API_KEY in environment variable (never in code)
- Store DEEPL_API_ENDPOINT (e.g., "https://api-free.deepl.com/v2" or paid)
- Define DEEPL_TIMEOUT_MS: 30000 (milliseconds)
- Define DEEPL_MAX_RETRIES: 3
- Define DEEPL_SUPPORTED_LANGUAGES: Array of ISO codes

**Load from .env file at server startup**
- Validate key exists before starting server
- Log warning if key is missing (server runs but translation unavailable)
- Implement key rotation without server restart (future enhancement)

---

## Part 4: Text-to-Speech (TTS) Service Integration

### 4.1 TTS Service Architecture

**In ttsService.js, implement:**

**Function: synthesizeSpeech()**
- Parameters: translatedText, targetLanguage, voice (male/female), userId
- Logic:
  - Validate text length (DeepL output typically 50-500 chars per chunk)
  - Call TTS API with language and voice parameters
  - Receive audio stream (Opus or MP3 typically)
  - Decode to PCM at 16kHz mono (standard format)
  - Return PCM buffer and duration
- Handle long text: Split into 500-char chunks, synthesize separately, concatenate

**Function: selectVoice()**
- Parameters: language code, preferredGender (optional)
- Logic:
  - Map language to available voices in TTS service
  - Return voice ID and sample rate info
  - If language not available, fallback to English

**Function: getAvailableLanguagesAndVoices()**
- Logic:
  - Cache list of TTS-supported language + voice combinations
  - Return formatted list for frontend dropdown
  - Update cache hourly

**Error Handling:**
- Text too long: Chunk and parallelize requests
- Language unsupported: Use fallback language
- API quota exceeded: Queue and retry after cooldown
- Decode errors: Log and notify user (play fallback message)

### 4.2 TTS Provider Selection

**Option A: Google Cloud Text-to-Speech**
- Pros: High quality, supports 30+ languages with multiple voices
- Cons: Costs scale with usage
- Latency: 1-3 seconds typical
- Setup: Requires GCP service account JSON

**Option B: Azure Text-to-Speech (Cognitive Services)**
- Pros: High quality, SSML support, neural voices
- Cons: Costs high for realtime
- Latency: 1-2 seconds typical
- Setup: Requires Azure subscription + endpoint

**Option C: ElevenLabs API (Voice.ai alternative)**
- Pros: Very natural voice, streaming support
- Cons: Higher cost per character, limited languages
- Latency: 2-4 seconds typical
- Setup: API key only

**Recommendation for MVP: Google Cloud TTS**
- Best balance of quality, cost, and language support
- Streaming API available for lower latency

**In tts.config.js:**
- TTS_PROVIDER: "google" or "azure" or "elevenlabs"
- TTS_API_KEY / SERVICE_ACCOUNT_JSON: Load from environment
- TTS_ENDPOINT: Service-specific endpoint
- TTS_VOICE_PREFERENCES: Default voice mapping per language

---

## Part 5: Translation Pipeline Orchestration

### 5.1 Complete Audio-to-Audio Translation Flow

**In translationPipeline.js, implement:**

**Core Pipeline: captureAudio() → detectSpeech() → transcribe() → translate() → synthesize() → mixAudio()**

**Step 1: Capture Audio**
- Receive audio-chunk events from user
- Buffer 20ms chunks into 500ms windows (25 chunks)
- Detect silence (if all PCM values < threshold, skip translation)

**Step 2: Detect Speech**
- Analyze PCM amplitude
- If RMS (root mean square) energy > -30dB, mark as speech
- Skip silent segments to reduce API calls

**Step 3: Transcribe (via DeepL)** 
- Send 500ms audio window to DeepL speech-to-text
- Receive text (e.g., "I like pizza")
- Continue buffering next window while awaiting response

**Step 4: Translate (via DeepL)** 
- Take transcribed text
- Call DeepL text translation API (more reliable than voice translation)
- Receive translated text (e.g., "Me gusta la pizza" in Spanish)
- Handle edge cases: Empty text, very short text (<3 chars), special characters

**Step 5: Synthesize Speech (via TTS)**
- Send translated text to TTS service
- Receive audio stream (MP3 or Opus)
- Decode to PCM at 16kHz
- Store in audioBuffer

**Step 6: Mix Audio**
- Original audio still plays for the speaker
- Translated audio plays for other participants
- Use audio mixing logic (see Section 5.2)

### 5.2 Audio Mixing and Per-User Audio Delivery

**Concept: Each participant receives customized audio mix**

**Example:**
- User A speaks English, wants to hear Spanish
- User B speaks Spanish, wants to hear English
- User C speaks French, wants to hear English

**When User A speaks:**
- User A hears own voice (original English)
- User B receives: A's audio translated to Spanish
- User C receives: A's audio translated to English

**Implementation approach:**

**Central audio mixer:**
- Receive original audio from each user
- For each user in room, generate translation to their target language
- Broadcast user-specific translated audio

**In socketManager.js or new audioMixer.js:**

**Function: mixAudioForUser()**
- Parameters: userId (recipient), roomId, speakerUserId, audioChunk (original)
- Logic:
  - Check recipient's target language preference
  - If target language == speaker's language: Send original audio (no translation cost)
  - If target language != speaker's language: Route through translationPipeline
  - Emit "audio-chunk-for-user" event with translated audio
  - Use audio-time-synchronization (speaker time + latency offset)

**Broadcast optimization:**
- Cache translation for 10 seconds: If same speaker sends similar audio, reuse translation
- Only retranslate if speaker changes language preference or 10s elapsed

**Example pseudocode logic:**
```
FOR EACH user in meeting room:
  IF user NOT speaker AND translation enabled:
    targetLang = user.languageOthersHearMeIn
    IF cache has [speakerId][targetLang][timestamp < 10s]:
      use cached translation
    ELSE:
      generate translation via pipeline
      cache result
    EMIT via Socket.IO to user: translated audio chunk
  ELSE:
    EMIT original audio chunk to user
```

### 5.3 Session Management

**In userLanguageStore.js, maintain:**

**Active translation sessions map:**
```
{
  [userId]: {
    sessionId: "room-123",
    languageISpeak: "en",
    languageOthersHearMeIn: "es",
    deeplConnectionId: "conn-xyz",
    ttsVoice: "google-es-es-neural-1-female",
    audioBuffer: CircularBuffer(size=64KB),
    translationCache: Map{},
    pipelineStatus: "active|paused|error",
    lastAudioChunkTime: timestamp,
    cumulativeAudioSize: bytes (for quota tracking)
  }
}
```

**Session lifecycle:**

- **Create**: When user joins meeting, call initializeTranslationSession()
  - Store language preferences
  - Open DeepL connection
  - Allocate audio buffer
  - Set status = "active"

- **Update**: When user changes language dropdown
  - Update languageISpeak or languageOthersHearMeIn
  - Close old DeepL connection
  - Open new DeepL connection with new language pair
  - Notify all other users of change (no immediate effect on their output, cached translations remain valid)

- **Pause**: When user mutes microphone
  - Stop sending audio chunks
  - Keep connection alive (30s timeout)
  - Set status = "paused"

- **Resume**: When user unmutes
  - Resume audio chunk delivery
  - Set status = "active"

- **Close**: When user leaves meeting
  - Close DeepL connection
  - Close TTS session
  - Clear audio buffer
  - Remove from sessions map
  - Log session duration and total audio processed

---

## Part 6: WebSocket / HTTP API Endpoints

### 6.1 RESTful API Endpoints (HTTP)

**Base URL: http://localhost:8000/api/v1/translation**

**1. Update User Language Preferences**
- Method: PUT
- Endpoint: /users/:userId/language-preferences
- Request body:
  - languageISpeak: ISO 639-1 code (e.g., "en", "es", "fr")
  - languageOthersHearMeIn: ISO 639-1 code
  - ttsVoiceGender: "male" or "female" (optional, default "female")
- Response:
  - Success: 200 with updated user object
  - Validation error: 400 with error message
  - Not found: 404

**2. Fetch Available Languages**
- Method: GET
- Endpoint: /languages/available
- Query params: (none)
- Response:
  - Success: 200 with array of language objects:
    - code: "en"
    - name: "English"
    - supportedByDeepL: boolean
    - supportedByTTS: boolean
    - availableVoices: ["google-en-us-neural-1-male", ...]

**3. Fetch Available TTS Voices for Language**
- Method: GET
- Endpoint: /languages/:languageCode/voices
- Response:
  - Success: 200 with array of voice objects:
    - voiceId: "google-en-us-neural-1-male"
    - name: "en-US-Neural2-A"
    - gender: "male"
    - sample: URL to audio sample

**4. Fetch User's Current Translation Settings**
- Method: GET
- Endpoint: /users/:userId/translation-settings
- Response:
  - Success: 200 with settings object
  - Not found: 404

**5. Test TTS with Sample Text**
- Method: POST
- Endpoint: /test/synthesize
- Request body:
  - text: "Hello, this is a test"
  - languageCode: "en"
  - voiceId: "google-en-us-neural-1-female"
- Response:
  - Success: 200 with audioBuffer (base64 encoded)
  - Error: 400 or 503 (quota exceeded)

### 6.2 Socket.IO Events (Real-Time)

**Namespace: /audio**

**Client → Server Events:**

**1. "join-translation-stream"**
- Payload:
  - userId: string
  - sessionId: string (meeting room)
  - languageISpeak: string
  - languageOthersHearMeIn: string
- Server behavior:
  - Initialize translation session for user
  - Open DeepL connection
  - Start listening for audio-chunk events
  - Emit "stream-ready" back to client

**2. "audio-chunk"**
- Payload:
  - audioData: Uint8Array (raw PCM)
  - timestamp: number
  - sequenceNumber: number
  - duration: number (ms)
- Server behavior:
  - Queue audio for speech detection
  - Begin translation pipeline (async, don't wait)
  - Return immediately with { status: "queued", chunksProcessing: number }

**3. "change-language"**
- Payload:
  - languageISpeak: string
  - languageOthersHearMeIn: string
  - voiceGender: string (optional)
- Server behavior:
  - Update userLanguageStore
  - Close old DeepL connection
  - Open new DeepL connection
  - Emit "language-changed" confirmation
  - Broadcast "user-translation-settings-updated" to all other users (info only)

**4. "pause-translation"**
- Payload: (none)
- Server behavior:
  - Set pipeline status to paused
  - Stop processing audio chunks
  - Emit "translation-paused"

**5. "resume-translation"**
- Payload: (none)
- Server behavior:
  - Set pipeline status to active
  - Resume processing audio chunks
  - Emit "translation-resumed"

**6. "leave-translation-stream"**
- Payload:
  - sessionId: string
- Server behavior:
  - Close all connections for user
  - Clear session data
  - Emit "stream-closed"

**Server → Client Events:**

**1. "translation-status"**
- Payload:
  - status: "connecting" | "active" | "paused" | "error"
  - message: string
  - retrying: boolean
- Triggered: On pipeline status change

**2. "translated-audio-chunk"**
- Payload:
  - audioData: Uint8Array (PCM, 16kHz mono)
  - speakerId: string
  - timestamp: number
  - duration: number (ms)
  - sourceLang: string (what they spoke)
  - targetLang: string (what you hear)
- Triggered: When translated audio is ready (typically 500ms delay from original)

**3. "stream-error"**
- Payload:
  - code: string (enum: "DEEPL_ERROR", "TTS_ERROR", "QUOTA_EXCEEDED", "NETWORK_ERROR")
  - message: string
  - recoverable: boolean
  - retryAfter: number (seconds)
- Triggered: On error

**4. "translation-metrics"**
- Payload:
  - userId: string
  - avgLatency: number (ms from audio chunk to translated chunk)
  - chunksProcessed: number
  - translationCacheHitRate: number (0-100%)
  - uptime: number (seconds)
- Triggered: Every 30 seconds

---

## Part 7: Frontend Implementation

### 7.1 Frontend Directory Structure

```
frontend/
└── confrencingpros/
    └── src/
        ├── App.jsx                      (existing, add translation context)
        ├── contexts/
        │   ├── Authcontex.jsx           (existing)
        │   └── TranslationContext.jsx    (new - global translation state)
        ├── hooks/
        │   ├── useAudioCapture.js        (new - capture microphone)
        │   ├── useTranslation.js         (new - coordinate translation)
        │   └── useLanguagePreferences.js (new - get/update settings)
        ├── pages/
        │   ├── VideoMeet.jsx             (existing, add translation UI)
        │   └── LanguageSettings.jsx      (new - settings page for language selection)
        ├── components/
        │   ├── LanguageSelector.jsx      (new - dropdown for language selection)
        │   ├── TranslationStatus.jsx     (new - status indicator)
        │   ├── AudioLevelIndicator.jsx   (new - visual feedback)
        │   └── VoiceSelector.jsx         (new - select male/female voice)
        ├── services/
        │   ├── translationService.js     (new - API calls)
        │   └── audioService.js           (new - audio recording + encoding)
        └── utils/
            ├── audioBuffer.js            (new - buffer management)
            └── pcmEncoder.js             (new - convert audio to PCM)
```

### 7.2 Audio Capture from Frontend

**In hooks/useAudioCapture.js, implement:**

**Function: useAudioCapture()**
- Initialize microphone access on component mount
- Request permissions: navigator.mediaDevices.getUserMedia({ audio: true })
- Create AudioContext with sample rate 16kHz
- Create ScriptProcessorNode or AudioWorklet (modern approach) to capture PCM

**Audio processing pipeline:**
- Input: Microphone stream (44.1kHz or 48kHz native)
- Resample to 16kHz using AudioContext API
- Convert to PCM 16-bit
- Collect into 20ms chunks (320 samples)
- Emit "audio-chunk" event with Uint8Array buffer

**Parameters from user:**
- enabled: boolean (start/stop recording)
- targetLanguage: string (what I speak)
- onAudioChunk: callback (receives { audioData, timestamp, sequenceNumber })

**Error handling:**
- Permission denied: Display error, no fallback
- Device disconnect: Stop recording, emit error event
- Insufficient buffer: Skip chunks instead of concatenating (prefer low latency)

**Return object:**
```
{
  isRecording: boolean,
  isSupported: boolean,
  currentLevel: number (0-100, audio amplitude),
  error: string | null,
  startRecording: () => void,
  stopRecording: () => void,
  getStats: () => { samplesProcessed, chunksGenerated, droppedChunks }
}
```

### 7.3 Language Selector UI Component

**In components/LanguageSelector.jsx, implement:**

**Two-dropdown layout (side by side):**

**Left dropdown: "I speak"**
- Label: "I speak"
- Options: All languages from API
- Default: User's browser language or "English"
- On change: Call updateLanguagePreference(languageISpeak)
- Icon: Microphone (to indicate input)

**Right dropdown: "Others hear me in"**
- Label: "Others hear me in"
- Options: All languages from API
- Default: Same as "I speak"
- On change: Call updateLanguagePreference(languageOthersHearMeIn)
- Icon: Speaker (to indicate output)

**Optional sub-components:**
- **Voice selector (hidden by default)**: If user clicks "Options" button, show:
  - Male / Female radio buttons
  - Voice sample playback buttons
  - Save button

**State management (via TranslationContext):**
- languageISpeak: string
- languageOthersHearMeIn: string
- voiceGender: "male" | "female"
- availableLanguages: Array
- isLoading: boolean
- isSaving: boolean

### 7.4 Real-Time Audio Playback

**In pages/VideoMeet.jsx, modify existing video rendering:**

**Add audio playback logic:**

**For each remote participant:**
- Create separate AudioContext
- Create audio buffer to hold translated audio chunks
- Connect to audio output
- As "translated-audio-chunk" events arrive, append to buffer
- Play buffer continuously (maintain 500ms lead to prevent underrun)

**Pseudocode for audio playback:**
```
WHEN translated-audio-chunk arrives from speakerId:
  IF audioContextFor(speakerId) not exist:
    CREATE new AudioContext for speakerId
    CREATE audio buffer with 500ms pre-buffer
    CONNECT to speaker output
  APPEND audio chunk to buffer
  IF buffer ready for playback AND playback stopped:
    START playback
  IF buffer level drops below 250ms:
    Log warning (audio underrun risk)
```

**Handling audio sync:**
- Each translated chunk includes timestamp
- Calculate playback start time: recordedTime + translationLatency + networkLatency
- Use Web Audio API timing for precise playback

### 7.5 Translation Status UI

**In components/TranslationStatus.jsx:**

**Visual indicators:**
- Status dot (connected/connecting/error/paused):
  - Green: Active and translating
  - Yellow: Connecting to DeepL
  - Red: Error (show error message on hover)
  - Gray: Paused
- Latency display: Shows avg latency in ms (target < 1000ms)
- Cache hit rate: Shows % of translations reused from cache
- Metrics update every 30 seconds

**Tooltip on hover:**
```
Translation Pipeline Status
Status: Active
Avg Latency: 450ms
Cache Hit Rate: 62%
Chunks Processed: 1,247
Uptime: 5m 23s
```

### 7.6 Translation Settings Page (Optional)

**In pages/LanguageSettings.jsx (or dialog modal):**

**Form fields:**
- Language selector (as above)
- Voice selector (male/female)
- TTS voice sample playback
- Translation enable/disable toggle
- Test button (speak, hear back translated)

**Actions:**
- Save button: POST to /api/v1/translation/users/:userId/language-preferences
- Cancel button: Discard changes
- Reset button: Reset to default (user's native language)

---

## Part 8: Integration with Existing WebRTC Flow

### 8.1 Modify Socket.IO Handler (socketManager.js)

**Current flow:** Raw audio/video via RTCPeerConnection

**New flow:**
1. User joins meeting → Socket.IO "join call" event
2. User accepts permissions → Call useAudioCapture hook
3. Start recording microphone → useAudioCapture generates audio chunks
4. Emit "audio-chunk" events to backend on /audio namespace
5. Backend processes via translation pipeline
6. Backend emits "translated-audio-chunk" back to user
7. User plays translated chunks via AudioContext

**In socketManager.js:**

**Add new namespace:**
```
Create separate io.of('/audio') namespace
Reuse existing Socket.IO server instance
```

**On "join call" event:**
- Check if user enabled translation
- If yes: Initialize translationSession in backend
- Emit "translation-enabled" event back to client

**On "user left" event:**
- Close that user's translation session
- Stop serving translated audio for that user

### 8.2 Audio vs Video Stream Separation

**Keep existing RTCPeerConnection for video:**
- Video continues as-is (no changes)
- No impact on video quality or latency

**Add separate audio path:**
- Microphone audio captured → PCM chunks → WebSocket/Socket.IO
- Translated audio received ← WebSocket/Socket.IO ← Backend
- Backend processes → AudioContext playback

**Why separation?**
- Easier to debug (audio and video independent)
- Scales differently (audio typically < 100 Kbps, video > 1 Mbps)
- Can disable translation without affecting video

---

## Part 9: Configuration and Credentials Management

### 9.1 Environment Variables (.env file)

**Backend .env:**
```
# DeepL
DEEPL_API_KEY=your-deepl-api-key
DEEPL_API_URL=https://api-free.deepl.com/v2

# TTS Service (choose one)
TTS_PROVIDER=google
GOOGLE_TTS_API_KEY=your-google-cloud-api-key
GOOGLE_TTS_PROJECT_ID=your-project-id

# OR
TTS_PROVIDER=azure
AZURE_TTS_KEY=your-azure-key
AZURE_TTS_REGION=eastus
AZURE_TTS_ENDPOINT=https://eastus.tts.speech.microsoft.com

# OR
TTS_PROVIDER=elevenlabs
ELEVENLABS_API_KEY=your-elevenlabs-key

# Audio Settings
AUDIO_SAMPLE_RATE=16000
AUDIO_CHUNK_DURATION_MS=20

# Server
PORT=8000
MONGODB_URI=your-mongo-uri

# Session Timeouts
DEEPL_CONNECTION_TIMEOUT_MS=30000
TTS_RESPONSE_TIMEOUT_MS=5000
```

**Frontend .env:**
```
VITE_API_BASE_URL=http://localhost:8000/api/v1
VITE_SOCKET_URL=http://localhost:8000
```

### 9.2 Secure Credential Loading

**In backend/src/config/index.js:**

**On server startup, validate all required env vars:**
- Check DEEPL_API_KEY exists
- Check TTS credentials exist (at least one provider)
- Log warning if any are missing
- Server still starts but translation features disabled

**Never log or expose credentials:**
- Log only first 4 chars of API keys
- Never return credentials to frontend
- Use environment variables exclusively

### 9.3 API Key Rotation Strategy

**For future implementation:**
- Store multiple API keys for same service
- Rotate on scheduled basis (monthly)
- Update without server restart
- Implement key versioning

---

## Part 10: Error Handling and Edge Cases

### 10.1 Network Failures

**Scenario: WebSocket connection drops during audio stream**

**Handling:**
- Detect disconnect in Socket.IO client
- Stop sending audio chunks
- Display error: "Connection lost, retrying..."
- Attempt reconnection with exponential backoff (1s, 2s, 4s, 8s)
- After 5 retries, show "Translation unavailable" message
- User can manually reconnect

**In useTranslation hook:**
```
- Monitor Socket.IO "disconnect" event
- Set status to "error"
- Queue audio locally (up to 10 seconds)
- On reconnect ("connect" event):
  - Resume streaming
  - Flush queued audio
  - Reset status to "active"
```

### 10.2 DeepL API Errors

**Scenario 1: Quota exceeded (429 Too Many Requests)**
- DeepL returns 429 error
- Backend logic:
  - Stop processing new audio chunks
  - Queue chunks locally
  - Retry after 60 seconds
  - Notify user: "Translation service temporarily unavailable, retrying..."
  - Resume after cooldown

**Scenario 2: Invalid language pair (400 Bad Request)**
- User selects unsupported language combination
- Frontend:
  - Validate language pair before sending
  - Show error: "Translation not available for this pair"
  - Fallback to English
- Backend:
  - Also validate
  - Log error for debugging

**Scenario 3: DeepL service down (500 Internal Server Error)**
- Backend receives 500 from DeepL
- Logic:
  - Set pipeline status to "error"
  - Stop translation attempts
  - Emit "stream-error" to client
  - Attempt recovery every 30 seconds
  - After 5 failed attempts, disable translation for session
  - User must refresh or re-join

### 10.3 TTS Service Errors

**Scenario 1: Synthesize fails (no voice for language)**
- TTS API returns error: "Language not supported"
- Backend:
  - Fallback to English voice
  - Continue translation (skip TTS, play text on client?)
  - Log error for monitoring

**Scenario 2: Audio decode fails**
- TTS returns audio in unexpected format
- Backend:
  - Validate audio format
  - Attempt automatic decode
  - If fails: Log error, skip this chunk, process next
  - No disruption to user experience

### 10.4 Audio Stream Interruptions

**Scenario: User changes language mid-meeting**
- User clicks language dropdown, selects new target language
- Frontend:
  - Send "change-language" event
  - Do NOT stop audio stream
  - Display "Updating translation settings..."
- Backend:
  - Update userLanguageStore
  - Close old DeepL connection
  - Open new DeepL connection with new language
  - Resume processing new audio chunks
  - Already-received audio still plays normally
  - After 2-3 seconds, translated audio reflects new language

**Scenario: User mutes microphone**
- User clicks mute button in meeting
- Frontend:
  - Stop capturing audio chunks
  - Send "pause-translation" event
  - AudioContext continues playing received translated audio
- Backend:
  - Stop processing audio for this user
  - Keep DeepL connection alive
- User unmutes:
  - Resume audio capture
  - Send "resume-translation"
  - Backend resumes processing

### 10.5 Resource Cleanup on Meeting Exit

**When user leaves meeting:**
1. Frontend:
   - Stop audio capture (stopRecording())
   - Close all AudioContexts
   - Send "leave-translation-stream" event
   - Clear TranslationContext

2. Backend:
   - Close DeepL connection
   - Close TTS session
   - Clear audio buffer
   - Remove from active sessions
   - Cleanup timers and event listeners
   - Log session summary (duration, audio processed, errors)

**If browser crashes / tab closes:**
- Backend timeout (30s inactivity)
- Auto-cleanup after timeout
- Notify other users: "[User] has left the meeting"

---

## Part 11: Monitoring and Metrics

### 11.1 Key Metrics to Track

**Performance metrics:**
- End-to-end latency (audio chunk received → translated chunk emitted)
  - Target: < 1000ms
  - Alert if > 2000ms
- Translation cache hit rate (%)
  - Target: > 50%
- API response times:
  - DeepL STT: < 500ms
  - Text translation: < 200ms
  - TTS: < 800ms

**Availability metrics:**
- Translation service uptime (%)
- API quota usage (% of daily limit)
- Error rate (% of requests failed)

**Usage metrics:**
- Active translation sessions per hour
- Total audio processed (GB/day)
- Languages used (top 10)

### 11.2 Logging Strategy

**Log levels:**
- ERROR: API failures, disconnections, crashes
- WARN: Quota warnings, fallback actions, timeouts
- INFO: User joins/leaves, language changes
- DEBUG: Audio chunk details (development only)

**Log destinations:**
- Development: Console
- Production: Cloud logging service (e.g., DataDog, Splunk)

### 11.3 Alerts

**Alert if:**
- DeepL error rate > 5%
- TTS error rate > 5%
- Average latency > 2000ms
- API quota > 80%
- WebSocket disconnections > 10/min

---

## Part 12: Implementation Roadmap

### Phase 1: MVP (Weeks 1-3)
**Goal: Basic translation for one language pair (English ↔ Spanish)**

1. Week 1:
   - Setup DeepL API integration (deeplVoiceService.js)
   - Setup TTS integration (Google Cloud)
   - Create configuration files
   - Implement audio capture hook (useAudioCapture)

2. Week 2:
   - Implement translation pipeline (translationPipeline.js)
   - Add Socket.IO audio namespace
   - Integrate with existing meeting room
   - Add language selector component

3. Week 3:
   - Frontend audio playback
   - Error handling for main failure scenarios
   - Testing and bug fixes

### Phase 2: Scale (Weeks 4-6)
**Goal: Support all DeepL languages, improve latency**

1. Week 4:
   - Add dynamic language list fetching
   - Implement audio caching and optimization
   - Improve TTS voice selection

2. Week 5:
   - Performance optimization (reduce latency)
   - Scale to support 10+ concurrent sessions
   - Load testing

3. Week 6:
   - Edge case handling
   - User feedback integration
   - Deploy to staging environment

### Phase 3: Production (Weeks 7-8)
**Goal: Harden for production, monitor, document**

1. Week 7:
   - Security audit
   - API rate limiting
   - Comprehensive monitoring setup

2. Week 8:
   - Documentation (API, deployment, troubleshooting)
   - Staff training
   - Go-live preparation

---

## Part 13: Testing Strategy

### 13.1 Unit Tests

**Test deeplVoiceService:**
- openRealtimeConnection succeeds with valid key
- openRealtimeConnection fails with invalid key
- streamAudioToDeepL handles rate limiting
- receiveTranslatedText returns correct language

**Test ttsService:**
- synthesizeSpeech returns valid PCM buffer
- Supports all configured languages
- Handles text > 500 chars (chunking)

**Test translationPipeline:**
- Audio → Text pipeline works end-to-end
- Caching works (same audio → cached result)
- Silence detection skips processing

### 13.2 Integration Tests

**Test Socket.IO flow:**
- Client sends audio-chunk
- Server processes and returns translated chunk
- Latency < 1000ms

**Test language change:**
- User changes language
- Subsequent translated audio reflects new language

**Test session lifecycle:**
- Create session on join
- Update on language change
- Cleanup on leave

### 13.3 Load Testing

**Simulate:**
- 10 concurrent users in meeting
- Each sending audio every 500ms
- Measure:
  - Server CPU usage
  - Memory consumption
  - API quota usage
  - Latency distribution

**Tools:** Apache JMeter or Artillery

### 13.4 Manual Testing Checklist

- [ ] Translation works for all language pairs
- [ ] Latency < 1000ms in normal conditions
- [ ] Audio quality acceptable (no artifacts)
- [ ] Cache hit rate > 50%
- [ ] Error handling graceful (no crashes)
- [ ] Language change smooth (no audio drops)
- [ ] Audio sync maintained (lip-sync acceptable)
- [ ] Battery drain acceptable (< 10% additional on mobile)

---

## Part 14: Security Considerations

### 14.1 API Key Protection

**Never commit keys to repository:**
- Use .env files
- Add .env to .gitignore
- Use environment variables in production

**Rotate keys regularly:**
- Every 30 days (automated if possible)
- On team member departure
- If key suspected compromised

### 14.2 Audio Data Privacy

**Audio is sensitive PII:**
- Encrypt in transit (HTTPS + WSS)
- Do NOT log raw audio
- Do NOT store raw audio long-term
- Delete audio after 24 hours
- Comply with GDPR, CCPA if applicable

### 14.3 Session Validation

**Validate all audio requests:**
- Verify user in active meeting
- Verify meeting roomId valid
- Verify session not expired (disconnect after 30s inactivity)

**Prevent abuse:**
- Rate limit per-user: 100 audio chunks/min
- Rate limit per-meeting: 500 chunks/min
- Quota limit: 10 GB audio/month/user

---

## Part 15: Documentation Requirements

### 15.1 Architecture Documentation
- System design diagrams (ASCII or Mermaid)
- Audio flow diagrams
- API sequence diagrams

### 15.2 API Documentation
- OpenAPI/Swagger spec for REST endpoints
- Socket.IO event documentation
- Error codes and handling

### 15.3 Deployment Guide
- Environment setup
- Configuration
- Scaling considerations
- Troubleshooting guide

### 15.4 Developer Guide
- How to add new language support
- How to switch TTS providers
- How to optimize latency
- Contributing guidelines

---

## Summary of Files to Create

### Backend Files
1. `src/config/deepl.config.js` - DeepL credentials and settings
2. `src/config/tts.config.js` - TTS provider credentials
3. `src/config/audio.config.js` - Audio format specifications
4. `src/services/deeplVoiceService.js` - DeepL API wrapper
5. `src/services/ttsService.js` - TTS API wrapper
6. `src/services/audioProcessor.js` - Audio encoding/decoding
7. `src/services/translationPipeline.js` - Orchestrate pipeline
8. `src/services/userLanguageStore.js` - Session management
9. `src/controller/translationController.js` - HTTP request handling
10. `src/route/translationRoute.js` - Translation endpoints
11. `src/models/translationSession.js` - Session schema
12. `src/middleware/audioAuth.js` - Validate audio requests
13. `src/utils/audioBuffer.js` - Circular buffer for streaming
14. `src/utils/errorHandler.js` - Translation-specific errors
15. Modify: `src/controller/socketManager.js` - Add /audio namespace
16. Modify: `src/models/userSchema.js` - Add language preference fields
17. Modify: `src/app.js` - Add translation routes

### Frontend Files
1. `src/hooks/useAudioCapture.js` - Microphone capture
2. `src/hooks/useTranslation.js` - Coordinate translation
3. `src/hooks/useLanguagePreferences.js` - Language settings
4. `src/contexts/TranslationContext.jsx` - Global translation state
5. `src/components/LanguageSelector.jsx` - Language dropdown UI
6. `src/components/TranslationStatus.jsx` - Status indicator
7. `src/components/AudioLevelIndicator.jsx` - Audio level visualization
8. `src/components/VoiceSelector.jsx` - Voice selection UI
9. `src/pages/LanguageSettings.jsx` - Settings page
10. `src/services/translationService.js` - API calls
11. `src/services/audioService.js` - Audio recording + encoding
12. `src/utils/audioBuffer.js` - Buffer management
13. `src/utils/pcmEncoder.js` - Convert to PCM format
14. Modify: `src/pages/VideoMeet.jsx` - Add translation UI and audio playback

### Configuration Files
1. `.env.example` - Environment variables template
2. `.env` - Local development (not committed)
3. `docker-compose.yml` (optional) - For containerized deployment

---

## Next Steps

1. **Review this guide** with your team to validate approach
2. **Obtain API credentials**:
   - DeepL API key (https://www.deepl.com/pro-api)
   - Google Cloud TTS OR Azure TTS credentials
3. **Start Phase 1 implementation** beginning with configuration files
4. **Test each service independently** before integration
5. **Plan database migrations** for user language preference fields
6. **Setup monitoring** from the beginning (don't add later)

---

**End of Implementation Guide**

This guide provides a comprehensive roadmap without exposing specific code implementations. Your team can now build the feature systematically, phase by phase, with clear milestones and testing checkpoints.
