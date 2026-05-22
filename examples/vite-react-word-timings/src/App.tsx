import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ALL_VOICE_IDS,
  KittenTTS,
  KittenTTSResult,
  createBrowserAudioPlayer,
  voiceDisplayName,
  type DownloadProgressInfo,
  type KittenTTSVoiceId,
} from '@kittentts/web';

const defaultText =
  'Word timings let a reader interface highlight the word that is currently being spoken. Generate the audio first, then play it with the timing overlay.';

export default function App() {
  const player = useMemo(() => createBrowserAudioPlayer(), []);
  const ttsRef = useRef<KittenTTS | null>(null);
  const timerRef = useRef<number | null>(null);

  const [text, setText] = useState(defaultText);
  const [status, setStatus] = useState('Idle');
  const [busyLabel, setBusyLabel] = useState('');
  const [cacheStatus, setCacheStatus] = useState('Checking cache');
  const [progress, setProgress] = useState(0);
  const [progressInfo, setProgressInfo] = useState<DownloadProgressInfo | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [result, setResult] = useState<KittenTTSResult | null>(null);
  const [voice, setVoice] = useState<KittenTTSVoiceId>('bella');
  const [speed, setSpeed] = useState(1);
  const [activeWordIndex, setActiveWordIndex] = useState<number | null>(null);
  const [playheadSeconds, setPlayheadSeconds] = useState(0);

  useEffect(() => {
    let cancelled = false;
    KittenTTS.cacheInfo({ model: 'nano-int8' })
      .then((info) => {
        if (!cancelled) setCacheStatus(info.isCached ? 'Cached' : 'Not cached');
      })
      .catch((error) => {
        if (!cancelled) setCacheStatus(error instanceof Error ? error.message : String(error));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    return () => {
      stopTimer();
      ttsRef.current?.dispose();
    };
  }, []);

  async function initialize() {
    setIsBusy(true);
    setBusyLabel('Preparing model and phonemizer');
    setStatus('Initializing');
    setProgress(0);
    setProgressInfo(null);
    await waitForPaint();

    try {
      await ttsRef.current?.dispose();
      ttsRef.current = await KittenTTS.create(
        {
          model: 'nano-int8',
          defaultVoice: voice,
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
      setStatus(error instanceof Error ? error.message : String(error));
    } finally {
      setIsBusy(false);
      setBusyLabel('');
    }
  }

  async function generate() {
    const tts = ttsRef.current;
    if (!tts) return;

    stopTimer();
    setActiveWordIndex(null);
    setPlayheadSeconds(0);
    setIsBusy(true);
    setBusyLabel('Generating word timings');
    setStatus('Generating');
    await waitForPaint();

    try {
      const nextResult = await tts.generate(text, { voice, speed });
      setResult(nextResult);
      setStatus(`Generated ${nextResult.wordTimings.length} word timings`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error));
    } finally {
      setIsBusy(false);
      setBusyLabel('');
    }
  }

  async function play() {
    const tts = ttsRef.current;
    if (!tts || !result) return;

    stopTimer();
    setIsBusy(true);
    setBusyLabel('Playing with highlight');
    setStatus('Playing');
    await waitForPaint();

    try {
      await tts.play(result, {
        onPlaybackStart: () => startTimer(result),
      });
      setStatus('Done');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error));
    } finally {
      stopTimer();
      setIsBusy(false);
      setBusyLabel('');
    }
  }

  async function stop() {
    stopTimer();
    await ttsRef.current?.stopSpeaking();
    setStatus(isReady ? 'Ready' : 'Idle');
  }

  function startTimer(timingResult: KittenTTSResult) {
    const startedAt = performance.now();
    timerRef.current = window.setInterval(() => {
      const seconds = (performance.now() - startedAt) / 1000;
      setPlayheadSeconds(seconds);
      const active = timingResult.wordTimings.find(
        (word) => seconds >= word.startTime && seconds < word.endTime,
      );
      setActiveWordIndex(active?.wordIndex ?? null);
    }, 40);
  }

  function stopTimer() {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setActiveWordIndex(null);
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

  return (
    <main className="page">
      <section className="voice-demo">
        <header className="hero">
          <img className="brand-logo" src="/kittenml_logo.svg" alt="KittenML" />
          <div>
            <h1>KittenTTS Example</h1>
            <p>Word timings example of the Web SDK for KittenTTS</p>
          </div>
        </header>

        <section className="demo-panel" aria-label="Word timing controls">
          <div className="select-grid">
            <label>
              <span className="label-heading">
                Model
                <span className="cache-pill">{cacheStatus}</span>
              </span>
              <select value="nano-int8" disabled>
                <option value="nano-int8">Nano (int8)</option>
              </select>
            </label>
            <label>
              Voice
              <select
                value={voice}
                onChange={(event) => {
                  setVoice(event.target.value as KittenTTSVoiceId);
                  setResult(null);
                }}
                disabled={isBusy}
              >
                {ALL_VOICE_IDS.map((option) => (
                  <option key={option} value={option}>
                    {voiceDisplayName(option)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Timing
              <select value="word-timings" disabled>
                <option value="word-timings">Word timings</option>
              </select>
            </label>
          </div>

          <label className="editor-label">
            Use the sample text or enter your own text in English
            <textarea value={text} onChange={(event) => setText(event.target.value)} />
          </label>

          <div className="playback-row">
            <section className="speed-control">
              <span>Adjust speed</span>
              <div className="slider-line">
                <strong>0.5x</strong>
                <input
                  aria-label="Speed"
                  type="range"
                  min="0.5"
                  max="2"
                  step="0.05"
                  value={speed}
                  onChange={(event) => {
                    setSpeed(Number(event.target.value));
                    setResult(null);
                  }}
                  disabled={isBusy}
                />
                <strong>2.0x</strong>
              </div>
              <output>{speed.toFixed(2)}x</output>
            </section>

            <section className="action-control">
              <div className="action-buttons">
                <div className="play-box">
                  <span>Generate</span>
                  <button onClick={isReady ? generate : initialize} disabled={isBusy} type="button">
                    {busyLabel === 'Preparing model and phonemizer'
                      ? 'Loading...'
                      : busyLabel === 'Generating word timings'
                        ? 'Generating...'
                        : isReady
                          ? 'Generate'
                          : 'Load'}
                  </button>
                </div>
                <div className="timing-control">
                  <span>Playback</span>
                  <button onClick={play} disabled={!isReady || !result || isBusy} type="button">
                    {busyLabel === 'Playing with highlight' ? 'Playing...' : 'Play highlight'}
                  </button>
                  <button className="secondary-button" onClick={stop} disabled={!isReady} type="button">
                    Stop
                  </button>
                </div>
              </div>
            </section>
          </div>

          <section className="status-strip" aria-live="polite">
            <span>{status}</span>
            <span>
              {Math.round(progress * 100)}%
              {progressInfo?.asset ? ` ${progressInfo.asset}` : ''}
              {progressInfo?.stage ? ` ${progressInfo.stage}` : ''}
            </span>
            <span className="progress-meter" aria-hidden="true">
              <span style={{ width: `${Math.round(progress * 100)}%` }} />
            </span>
          </section>

          {isBusy && (
            <section className="busy-panel" role="status" aria-live="polite">
              <span className="spinner" aria-hidden="true" />
              <span>{busyLabel || status}</span>
            </section>
          )}

          <section className="reader">
            {result?.wordTimings.length ? (
              result.wordTimings.map((word) => (
                <span
                  key={`${word.wordIndex}-${word.startTime}`}
                  className={word.wordIndex === activeWordIndex ? 'active' : ''}
                  title={`${word.startTime.toFixed(2)}s - ${word.endTime.toFixed(2)}s`}
                >
                  {word.word}
                </span>
              ))
            ) : (
              <p>Generate audio to see word-level timing spans.</p>
            )}
          </section>

          <p className="demo-disclaimer">
            This system is for demonstration purposes only and is not intended to process sensitive or personal data.
            No text is sent to a TTS service after local model assets are available.
          </p>

          {result && (
            <section className="timing-grid">
              <div>
                <strong>{playheadSeconds.toFixed(2)}s</strong>
                <span>Playhead</span>
              </div>
              <div>
                <strong>{result.duration.toFixed(2)}s</strong>
                <span>Duration</span>
              </div>
              <div>
                <strong>{result.wordTimings.length}</strong>
                <span>Words</span>
              </div>
            </section>
          )}
        </section>
      </section>
    </main>
  );
}

function waitForPaint(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      setTimeout(resolve, 0);
    });
  });
}
