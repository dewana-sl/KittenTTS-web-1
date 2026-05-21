import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ALL_VOICE_IDS,
  KittenTTS,
  KittenTTSResult,
  createBrowserAudioPlayer,
  modelDisplayName,
  voiceDisplayName,
  type DownloadProgressInfo,
  type KittenTTSModelId,
  type KittenTTSVoiceId,
} from '@kittentts/web';

const defaultText =
  'Thank you for trying KittenTTS in this local browser demo. This voice is generated on your device, so your text stays private after the model files are available. You can change the voice, adjust the speed, and play the sample whenever you are ready.';

const modelOptions: KittenTTSModelId[] = ['nano-int8', 'nano', 'micro', 'mini'];
const pitchOptions = [-20, -15, -10, -5, 0, 5, 10, 15, 20];

type DownloadFormat = 'wav' | 'mp3';

export default function App() {
  const player = useMemo(() => createBrowserAudioPlayer(), []);
  const ttsRef = useRef<KittenTTS | null>(null);
  const objectUrlRef = useRef<string | null>(null);

  const [model, setModel] = useState<KittenTTSModelId>('nano-int8');
  const [voice, setVoice] = useState<KittenTTSVoiceId>('bella');
  const [pitch, setPitch] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [text, setText] = useState(defaultText);
  const [progress, setProgress] = useState(0);
  const [progressInfo, setProgressInfo] = useState<DownloadProgressInfo | null>(null);
  const [status, setStatus] = useState('Idle');
  const [busyLabel, setBusyLabel] = useState('');
  const [cacheStatus, setCacheStatus] = useState('Checking');
  const [isReady, setIsReady] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [result, setResult] = useState<KittenTTSResult | null>(null);
  const [downloadFormat, setDownloadFormat] = useState<DownloadFormat>('wav');

  useEffect(() => {
    let cancelled = false;
    setCacheStatus('Checking');
    KittenTTS.cacheInfo({ model })
      .then((info) => {
        if (!cancelled) setCacheStatus(info.isCached ? 'Cached' : 'Not cached');
      })
      .catch((error) => {
        if (!cancelled) setCacheStatus(error instanceof Error ? error.message : String(error));
      });
    return () => {
      cancelled = true;
    };
  }, [model]);

  useEffect(() => {
    return () => {
      ttsRef.current?.dispose();
      revokeObjectUrl(objectUrlRef.current);
    };
  }, []);

  async function initialize() {
    setIsBusy(true);
    setBusyLabel('Preparing model and phonemizer');
    setStatus('Initializing');
    setProgress(0);
    setProgressInfo(null);
    setResult(null);
    await waitForPaint();

    try {
      await ttsRef.current?.dispose();
      ttsRef.current = await KittenTTS.create(
        {
          model,
          defaultVoice: voice,
          speed,
          player,
        },
        (nextProgress, info) => {
          setProgress(nextProgress);
          setProgressInfo(info ?? null);
          updateCacheFromProgress(nextProgress, info);
        },
      );
      setIsReady(true);
      setCacheStatus('Cached');
      setStatus('Ready');
    } catch (error) {
      setIsReady(false);
      setStatus(error instanceof Error ? error.message : String(error));
    } finally {
      setIsBusy(false);
      setBusyLabel('');
    }
  }

  async function ensureGenerated() {
    if (!ttsRef.current) {
      await initialize();
      if (!ttsRef.current) return null;
    }

    if (result) return result;

    setIsBusy(true);
    setBusyLabel('Generating audio');
    setStatus('Generating');
    await waitForPaint();

    try {
      const nextResult = await ttsRef.current.generate(text, { voice, speed });
      setResult(nextResult);
      setStatus('Generated');
      return nextResult;
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error));
      return null;
    } finally {
      setIsBusy(false);
      setBusyLabel('');
    }
  }

  async function speak() {
    const audioResult = await ensureGenerated();
    const tts = ttsRef.current;
    if (!audioResult || !tts) return;

    setIsBusy(true);
    setBusyLabel('Playing audio');
    setStatus('Speaking');
    await waitForPaint();

    try {
      await tts.play(pitchedResult(audioResult, pitch));
      setStatus('Done');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error));
    } finally {
      setIsBusy(false);
      setBusyLabel('');
    }
  }

  async function downloadAudio() {
    const audioResult = await ensureGenerated();
    if (!audioResult) return;

    setIsBusy(true);
    setBusyLabel(`Preparing ${downloadFormat.toUpperCase()} download`);
    setStatus('Preparing download');
    await waitForPaint();

    try {
      revokeObjectUrl(objectUrlRef.current);
      const renderedResult = pitchedResult(audioResult, pitch);
      const isMp3 = downloadFormat === 'mp3';
      const bytes = isMp3 ? await renderedResult.mp3Data({ bitRate: 128 }) : renderedResult.wavData();
      const blob = new Blob([toArrayBuffer(bytes)], { type: isMp3 ? 'audio/mpeg' : 'audio/wav' });
      const url = URL.createObjectURL(blob);
      objectUrlRef.current = url;

      const link = document.createElement('a');
      link.href = url;
      link.download = `kittentts-output.${downloadFormat}`;
      link.click();
      setStatus('Download ready');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error));
    } finally {
      setIsBusy(false);
      setBusyLabel('');
    }
  }

  async function stop() {
    await ttsRef.current?.stopSpeaking();
    setStatus(isReady ? 'Ready' : 'Idle');
  }

  function resetEngine(nextModel: KittenTTSModelId) {
    ttsRef.current?.dispose();
    ttsRef.current = null;
    setModel(nextModel);
    setIsReady(false);
    clearGeneratedResult();
    setStatus('Idle');
  }

  function clearGeneratedResult() {
    setResult(null);
    revokeObjectUrl(objectUrlRef.current);
    objectUrlRef.current = null;
  }

  function updateCacheFromProgress(nextProgress: number, info: DownloadProgressInfo | null | undefined) {
    const percent = Math.round(nextProgress * 100);

    if (info?.stage === 'downloading' || info?.stage === 'retrying') {
      setCacheStatus(`Downloading (${percent}%)`);
    } else if (info?.stage === 'checking-cache') {
      setCacheStatus('Checking');
    } else if (info?.stage === 'complete' || info?.stage === 'cached') {
      setCacheStatus('Cached');
    }
  }

  const displayedResult = result ? pitchedResult(result, pitch) : null;
  const progressPercent = Math.round(progress * 100);

  return (
    <main className="page">
      <section className="voice-demo">
        <header className="hero">
          <img className="brand-logo" src="/kittenml_logo.svg" alt="KittenML" />
          <div>
            <h1>KittenTTS Example</h1>
            <p>React example of the Web SDK for KittenTTS</p>
          </div>
        </header>

        <section className="demo-panel" aria-label="Voice controls">
          <div className="select-grid">
            <label>
              <span className="label-heading">
                Model
                <span className="cache-pill">{cacheStatus}</span>
              </span>
              <select value={model} onChange={(event) => resetEngine(event.target.value as KittenTTSModelId)}>
                {modelOptions.map((option) => (
                  <option key={option} value={option}>
                    {modelDisplayName(option)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Voice
              <select
                value={voice}
                onChange={(event) => {
                  setVoice(event.target.value as KittenTTSVoiceId);
                  clearGeneratedResult();
                }}
              >
                {ALL_VOICE_IDS.map((option) => (
                  <option key={option} value={option}>
                    {voiceDisplayName(option)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Pitch
              <select value={pitch} onChange={(event) => setPitch(Number(event.target.value))}>
                {pitchOptions.map((option) => (
                  <option key={option} value={option}>
                    {option > 0 ? `+${option}%` : `${option}%`}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <section className="status-strip" aria-live="polite">
            <span>{status}</span>
            <span>
              {progressPercent}%
              {progressInfo?.asset ? ` ${progressInfo.asset}` : ''}
              {progressInfo?.stage ? ` ${progressInfo.stage}` : ''}
            </span>
            <span className="progress-meter" aria-hidden="true">
              <span style={{ width: `${progressPercent}%` }} />
            </span>
          </section>

          <label className="editor-label">
            Use the sample text or enter your own text in English
            <textarea
              value={text}
              onChange={(event) => {
                setText(event.target.value);
                clearGeneratedResult();
              }}
            />
          </label>

          <div className="playback-row">
            <section className="speed-control">
              <span>Adjust speed</span>
              <div className="slider-line">
                <strong>0.5x</strong>
                <input
                  type="range"
                  min="0.5"
                  max="2"
                  step="0.05"
                  value={speed}
                  onChange={(event) => {
                    setSpeed(Number(event.target.value));
                    clearGeneratedResult();
                  }}
                />
                <strong>2.0x</strong>
              </div>
              <output>{speed.toFixed(2)}x</output>
            </section>

            <section className="action-control">
              <div className="action-buttons">
                <div className="play-box">
                  <span>Play voice</span>
                  <button onClick={speak} disabled={isBusy} type="button" aria-label="Play voice">
                    <span className="play-icon" aria-hidden="true" />
                  </button>
                </div>
                <div className="download-control" aria-label="Download audio">
                  <span>Download</span>
                  <div className="format-toggle">
                    <label>
                      <input
                        type="radio"
                        name="download-format"
                        value="wav"
                        checked={downloadFormat === 'wav'}
                        disabled={isBusy}
                        onChange={() => setDownloadFormat('wav')}
                      />
                      WAV
                    </label>
                    <label>
                      <input
                        type="radio"
                        name="download-format"
                        value="mp3"
                        checked={downloadFormat === 'mp3'}
                        disabled={isBusy}
                        onChange={() => setDownloadFormat('mp3')}
                      />
                      MP3
                    </label>
                  </div>
                  <button onClick={downloadAudio} disabled={isBusy} type="button">
                    Save
                  </button>
                </div>
              </div>
            </section>
          </div>

          {isBusy && (
            <section className="busy-panel" role="status" aria-live="polite">
              <span className="spinner" aria-hidden="true" />
              <span>{busyLabel || status}</span>
            </section>
          )}

          <p className="demo-disclaimer">
            This system is for demonstration purposes only and is not intended to process sensitive or personal data.
            No text is sent to a TTS service after local model assets are available.
          </p>

          {displayedResult && (
            <section className="result-panel">
              <div>
                <strong>{displayedResult.duration.toFixed(2)}s</strong>
                <span>Duration</span>
              </div>
              <div>
                <strong>{displayedResult.sampleRate.toLocaleString()} Hz</strong>
                <span>Sample rate</span>
              </div>
              <div>
                <strong>{displayedResult.wordTimings.length}</strong>
                <span>Word timings</span>
              </div>
            </section>
          )}

          <div className="utility-actions" hidden>
            <button onClick={initialize} disabled={isBusy} type="button">
              Load model
            </button>
            <button onClick={stop} disabled={!isReady} type="button">
              Stop
            </button>
          </div>
        </section>
      </section>
    </main>
  );
}

function pitchedResult(sourceResult: KittenTTSResult, pitch: number) {
  const ratio = Math.max(0.25, 1 + pitch / 100);
  if (Math.abs(ratio - 1) < 0.001) return sourceResult;

  return new KittenTTSResult(
    resampleForPitch(sourceResult.samples, ratio),
    sourceResult.sampleRate,
    sourceResult.voice,
    sourceResult.effectiveSpeed,
    sourceResult.inputText,
    sourceResult.wordTimings.map((timing) => ({
      ...timing,
      startTime: timing.startTime / ratio,
      endTime: timing.endTime / ratio,
    })),
  );
}

function resampleForPitch(samples: Float32Array, ratio: number) {
  const nextLength = Math.max(1, Math.floor(samples.length / ratio));
  const nextSamples = new Float32Array(nextLength);

  for (let index = 0; index < nextLength; index += 1) {
    const sourceIndex = index * ratio;
    const leftIndex = Math.floor(sourceIndex);
    const rightIndex = Math.min(leftIndex + 1, samples.length - 1);
    const mix = sourceIndex - leftIndex;
    nextSamples[index] = samples[leftIndex] * (1 - mix) + samples[rightIndex] * mix;
  }

  return nextSamples;
}

function revokeObjectUrl(url: string | null) {
  if (url) URL.revokeObjectURL(url);
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer;
}

function waitForPaint(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      setTimeout(resolve, 0);
    });
  });
}
