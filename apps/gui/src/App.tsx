import { useEffect, useState, useRef, useCallback } from 'react'
import './App.css'
import { SourceSelector } from './components/SourceSelector'
import { DeviceMatcherDialog } from './components/DeviceMatcherDialog'
import { FrontEndDevice, type FrontEndDeviceWithMediaInfo, type MediaDeviceCandidate, type DeviceStatus } from '../types';
import { AiSubModeHumans, AiWorkModes } from 'obsbot-sdk/lib/tiny_device';
import { ToggleButton } from './components/ToggleButton';
import { GimbalControl } from './components/GimbalControl';
import { CollapsibleSection } from './components/CollapsibleSection';
import { ZoomControl } from './components/ZoomControl';
import { RefreshIcon } from './components/icons';
import { formatAngle, type GimbalAttitude } from './utils/gimbal';
import { deviceRangeToUiRange, formatZoomFactor, isValidZoomRange, normalizeZoomRange, type ZoomRange } from './utils/zoom';
import { enumerateVideoInputs, linkMediaDevicesToRealDevices, type EnumeratedMediaDevice } from './utils/mediaDeviceMatching';
import { loadManualMapping, setManualMappingEntry, removeManualMappingEntry, type ManualMapping } from './utils/manualMapping';
import { usePersistentState } from './hooks/usePersistentState';


function App() {
  // Load device list and manage state here
  const [rawDevices, setRawDevices] = useState<Record<string, FrontEndDevice>>({});
  const [devices, setDevices] = useState<Record<string, FrontEndDeviceWithMediaInfo>>({});
  const [enumeratedDevices, setEnumeratedDevices] = useState<EnumeratedMediaDevice[]>([]);
  // The raw device list the current enumeration was made for. Used to avoid
  // linking once with stale enumeration and once again right after a refresh.
  const [enumeratedFor, setEnumeratedFor] = useState<Record<string, FrontEndDevice> | null>(null);
  const [mediaDeviceSalts, setMediaDeviceSalts] = useState<string[]>([]);
  const [manualMapping, setManualMapping] = useState<ManualMapping>(() => loadManualMapping());
  const [linkTick, setLinkTick] = useState(0);
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const [assigningDevice, setAssigningDevice] = useState<string | null>(null);
  const [selectedDevice, setSelectedDevice] = useState<string | null>(null);
  const [status, setStatus] = useState<DeviceStatus | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [mirrorVideo, setMirrorVideo] = usePersistentState<boolean>('obsnix:video-mirror', false);
  const [zoomRange, setZoomRange] = useState<ZoomRange | null>(null);
  const [zoomValue, setZoomValue] = useState<number | undefined>(undefined);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Keep the latest values available to the (stable) player callbacks without
  // recreating them on every render, so the video is not restarted needlessly.
  const devicesRef = useRef(devices);
  const selectedDeviceRef = useRef(selectedDevice);
  devicesRef.current = devices;
  selectedDeviceRef.current = selectedDevice;

  const selectedFamily = selectedDevice ? devices[selectedDevice]?.family : undefined;
  const zoomSendRef = useRef<{ last: number | null; timer: ReturnType<typeof setTimeout> | null; pending: number | null }>({
    last: null,
    timer: null,
    pending: null,
  });

  const playerPlay = useCallback(async (interactive = false) => {
    const selected = selectedDeviceRef.current;
    const video = videoRef.current;
    if (!selected || !video) return;
    const device = devicesRef.current[selected];
    if (!device) {
      console.error("Selected device not found");
      if (interactive) alert("Selected device not found");
      return;
    }
    if (!device.mediaDeviceId) {
      // Matching may still be in progress. This is expected on startup before
      // the enumeration finishes, so stay silent unless the user asked for it.
      console.warn(`No system camera matched yet for ${device.productTypeName} (SN: ${device.sn})`);
      if (interactive) {
        alert(device.matchSource === 'none'
          ? "No system camera is associated with this device. Use “Assign…” to pick the right camera."
          : "Camera matching is not ready yet, please try again in a moment.");
      }
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { deviceId: { exact: device.mediaDeviceId } }
      });
      video.srcObject = stream;
      setIsPlaying(true);
      console.log("Video stream started successfully");
    } catch (err) {
      console.error("Error accessing camera:", err);
      if (interactive) {
        alert(`Error accessing camera: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }, []);

  const playerStop = useCallback(() => {
    const video = videoRef.current;
    if (video && video.srcObject) {
      const stream = video.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      video.srcObject = null;
    }
    setIsPlaying(false);
  }, []);
  const setAiMode = useCallback((mode: number, subMode?: number) => {
    if (selectedDevice) {
      window.ipcRenderer.setAiMode(selectedDevice, mode, subMode);
      window.ipcRenderer.getDeviceStatus(selectedDevice).then(status => {
        console.log("status", status);
        setStatus(status);
      });
    }
  }, [selectedDevice]);

  // listen for device list updates
  useEffect(() => {
    const removeOnDeviceStatusListener = window.ipcRenderer.onDeviceStatus(({ deviceId, status }) => {
      console.log("Received device status update:", deviceId, status);
      setStatus(status as DeviceStatus);
    });
    const removeOnDeviceListListener = window.ipcRenderer.onDeviceList((deviceList: Record<string, FrontEndDevice>) => {
      console.log("Received device list:", deviceList);
      setRawDevices(deviceList);
      const keys = Object.keys(deviceList);
      if (keys.length === 1) {
        console.log("Auto-selecting the only available device:", keys[0], deviceList[keys[0]]);
        setSelectedDevice(keys[0]);
        window.ipcRenderer.getDeviceStatus(keys[0]);
      } else if (selectedDevice && !deviceList[selectedDevice]) {
        console.log("Previously selected device is no longer available. Deselecting.");
        setSelectedDevice(null);
        setStatus(null);
      }
    });
    return () => {
      removeOnDeviceListListener();
      removeOnDeviceStatusListener();
    }
  }, [selectedDevice]);

  useEffect(() => {
    window.ipcRenderer.listDevices();
    window.ipcRenderer.getMediaDeviceSalts()
      .then((salts) => setMediaDeviceSalts(Array.isArray(salts) ? salts : []))
      .catch((error) => console.warn("Could not load media device salts:", error));

    const handleDeviceChange = () => setLinkTick((tick) => tick + 1);
    navigator.mediaDevices?.addEventListener?.('devicechange', handleDeviceChange);
    return () => {
      navigator.mediaDevices?.removeEventListener?.('devicechange', handleDeviceChange);
    };
  }, []);

  // Enumerate system cameras (after priming permission so labels/IDs are populated).
  useEffect(() => {
    if (Object.keys(rawDevices).length === 0) {
      setEnumeratedDevices([]);
      setEnumeratedFor(null);
      return;
    }
    let cancelled = false;
    enumerateVideoInputs()
      .then((videos) => {
        if (cancelled) return;
        console.log("Available video devices:", videos);
        setEnumeratedDevices(videos);
        setEnumeratedFor(rawDevices);
        setPermissionError(null);
      })
      .catch((error) => {
        if (cancelled) return;
        console.error("Error accessing camera permission:", error);
        setPermissionError(error?.message || String(error));
        setEnumeratedDevices([]);
        setEnumeratedFor(rawDevices);
      });
    return () => { cancelled = true; };
  }, [rawDevices, linkTick]);

  // Link SDK devices to Electron media devices (exact HMAC, then heuristic/manual).
  // Waiting for the enumeration of the current device list keeps this to a
  // single pass per refresh instead of one stale + one fresh run.
  useEffect(() => {
    if (Object.keys(rawDevices).length === 0) {
      setDevices({});
      return;
    }
    if (enumeratedFor !== rawDevices) return;
    let cancelled = false;
    linkMediaDevicesToRealDevices(rawDevices, enumeratedDevices, {
      salts: mediaDeviceSalts,
      origin: window.location.origin,
      manualMapping,
    }).then((linked) => {
      if (cancelled) return;
      const summary = Object.values(linked).map((device) => ({
        sn: device.sn,
        product: device.productTypeName,
        matchSource: device.matchSource,
        mediaDeviceId: device.mediaDeviceId,
        mediaDeviceLabel: device.mediaDeviceLabel,
        videoPaths: device.videoPaths,
      }));
      console.log("Device match summary:", summary);
      console.table?.(summary);
      if (mediaDeviceSalts.length === 0) {
        console.warn("No media device salt found, exact matching is disabled (using labels/manual mapping).");
      }
      setDevices(linked);
    }).catch((error) => {
      console.error("Error linking OBSBOT devices to system cameras:", error);
    });
    return () => { cancelled = true; };
  }, [rawDevices, enumeratedDevices, enumeratedFor, mediaDeviceSalts, manualMapping]);

  const handleManualAssign = useCallback((device: FrontEndDeviceWithMediaInfo, candidate: MediaDeviceCandidate) => {
    setManualMapping(setManualMappingEntry(device.sn, candidate));
    setAssigningDevice(null);
  }, []);

  const handleManualClear = useCallback((device: FrontEndDeviceWithMediaInfo) => {
    setManualMapping(removeManualMappingEntry(device.sn));
  }, []);

  const handleZoomChange = useCallback((next: number) => {
    setZoomValue(next);
    const state = zoomSendRef.current;
    state.pending = next;
    if (state.timer) return;
    state.timer = setTimeout(() => {
      state.timer = null;
      const target = state.pending;
      const sn = selectedDeviceRef.current;
      if (target == null || !sn || state.last === target) return;
      state.last = target;
      window.ipcRenderer.setZoom(sn, target);
      window.ipcRenderer.getDeviceStatus(sn).then(setStatus);
    }, 80);
  }, []);

  useEffect(() => () => {
    if (zoomSendRef.current.timer) clearTimeout(zoomSendRef.current.timer);
  }, []);

  // Read the device range and convert it to the settable zoom domain
  // (e.g. raw 0..12 -> 1.00..1.12), keeping the slider/values in SDK units.
  useEffect(() => {
    if (!selectedDevice || selectedFamily !== 'Tiny') {
      setZoomRange(null);
      return;
    }
    let cancelled = false;
    window.ipcRenderer.getZoomRange(selectedDevice)
      .then((result) => {
        if (cancelled) return;
        if (!isValidZoomRange(result)) {
          setZoomRange(null);
          return;
        }
        const uiRange = deviceRangeToUiRange(normalizeZoomRange(result));
        setZoomRange(uiRange);
        setZoomValue(uiRange.default ?? uiRange.min);
      })
      .catch((error) => {
        if (cancelled) return;
        console.warn('Could not read zoom range:', error);
        setZoomRange(null);
      });
    return () => { cancelled = true; };
  }, [selectedDevice, selectedFamily]);

  // Only react to the selected camera actually changing, not to every device
  // list refresh (which would needlessly stop and restart the video stream).
  const selectedMediaDeviceId = selectedDevice ? devices[selectedDevice]?.mediaDeviceId ?? '' : '';

  // bind video play/stop to the selected device / matched camera on change
  useEffect(() => {
    console.log("Video effect triggered - selectedDevice:", selectedDevice, "mediaDeviceId:", selectedMediaDeviceId);
    if (selectedDevice && selectedMediaDeviceId) {
      playerPlay();
      window.ipcRenderer.getDeviceStatus(selectedDevice).then(status => {
        console.log("status", status);
        setStatus(status);
      });
    } else {
      playerStop();
    }
    // Cleanup function to stop video when component unmounts or device changes
    return () => {
      playerStop();
    };
  }, [selectedDevice, selectedMediaDeviceId, playerPlay, playerStop]);

  if (!devices || Object.keys(devices).length === 0) {
    return (
      <>
        <h1>Looking for devices</h1>
        <p>Please wait while we detecting devices...</p>
        <div className="spinner"></div>
        <p>If no devices is found after 5 seconds, please check the connection and try again by clicking the refresh button.</p>
        <button id="refresh-cameras" onClick={() => window.ipcRenderer.listDevices()} title="Refresh camera list" aria-label="Refresh camera list">
          <RefreshIcon size={20} />
        </button>
      </>
    );
  }
  const assigning = assigningDevice ? devices[assigningDevice] : undefined;
  const usedMediaDeviceIds = new Set(
    Object.values(devices)
      .filter((device) => device.sn !== assigning?.sn)
      .map((device) => device.mediaDeviceId)
      .filter(Boolean),
  );

  const aiSubModeLabels: Record<number, string> = {
    [AiSubModeHumans.Normal]: 'Normal',
    [AiSubModeHumans.UpperBody]: 'Upper Body',
    [AiSubModeHumans.CloseUp]: 'Close Up',
    [AiSubModeHumans.Headless]: 'Headless',
    [AiSubModeHumans.LowerBody]: 'Lower Body',
    [AiSubModeHumans.Butt]: 'Butt',
  };
  const aiModeLabels: Record<number, string> = {
    [AiWorkModes.None]: 'Off',
    [AiWorkModes.Group]: 'Group',
    [AiWorkModes.Hand]: 'Hand',
    [AiWorkModes.WhiteBoard]: 'Whiteboard',
    [AiWorkModes.Desk]: 'Desk',
    [AiWorkModes.Butt]: 'Butt',
  };
  const activeAiMode = (() => {
    const mode = status?.ai_mode;
    if (typeof mode !== 'number') return undefined;
    if (mode === AiWorkModes.Human) {
      const sub = status?.ai_sub_mode;
      return typeof sub === 'number' ? (aiSubModeLabels[sub] ?? 'Human') : 'Human';
    }
    return aiModeLabels[mode];
  })();

  const gimbalAttitude = status?.gimbal as GimbalAttitude | undefined;
  const gimbalAngles = `Pitch ${formatAngle(gimbalAttitude?.pitch)} · Pan ${formatAngle(gimbalAttitude?.pan)} · Roll ${formatAngle(gimbalAttitude?.roll)}`;
  const effectiveZoomValue = zoomValue ?? (zoomRange ? (zoomRange.default ?? zoomRange.min) : undefined);

  return (
    <>
    <h1>OBSNIX: Obsbot control center</h1>

    <div className="main-container">
        <div id="video-container">
            <video id="video" className={mirrorVideo ? 'mirrored' : ''} autoPlay={true} ref={videoRef}></video>
            <canvas id="last-frame-canvas" className="last-frame-canvas hidden"></canvas>
            <div id="video-overlay" className="video-overlay hidden">
                <div className="overlay-content">
                    <div className="spinner"></div>
                    <p>Applying settings...</p>
                </div>
            </div>
        </div>

        <div className="controls-container">
            <CollapsibleSection id="video" title="Video">
                <div id="video-controls">
                    <SourceSelector
                      devices={devices}
                      selected={selectedDevice}
                      onSelect={setSelectedDevice}
                      onAssign={setAssigningDevice}
                      onClearManual={(key) => handleManualClear(devices[key])}
                    />
                    <div className="video-actions">
                      <ToggleButton
                        label="Mirror image"
                        isActive={mirrorVideo}
                        className="flex-grow"
                        tooltip={`${mirrorVideo ? 'Disable' : 'Enable'} horizontal mirroring of the preview.`}
                        onToggle={() => setMirrorVideo(!mirrorVideo)}
                      />
                      <button
                        id="refresh-cameras"
                        onClick={() => window.ipcRenderer.listDevices()}
                        title="Refresh camera list"
                        aria-label="Refresh camera list"
                      ><RefreshIcon size={18} /></button>
                      <button
                        id="toggle-video"
                        className={isPlaying ? 'is-playing' : ''}
                        onClick={() => (isPlaying ? playerStop() : playerPlay(true))}
                      >{isPlaying ? 'Stop Video' : 'Display Video'}</button>
                    </div>
                </div>
                {permissionError && (
                  <p className="permission-error">
                    Camera access was refused or unavailable, so cameras cannot be matched automatically: {permissionError}
                  </p>
                )}
            </CollapsibleSection>
            {selectedDevice && devices[selectedDevice]?.family === 'Tiny' && (
              <CollapsibleSection
                id="gimbal"
                title={<>Gimbal &amp; Zoom <span className="section-status">{gimbalAngles} · Zoom {formatZoomFactor(effectiveZoomValue, zoomRange ?? undefined)}</span></>}
                defaultOpen={false}
              >
                  <GimbalControl
                    deviceSn={selectedDevice}
                    onRefreshStatus={() => {
                      window.ipcRenderer.getDeviceStatus(selectedDevice).then(setStatus);
                    }}
                  />
                  {zoomRange && (
                    <ZoomControl
                      range={zoomRange}
                      value={effectiveZoomValue ?? zoomRange.min}
                      onChange={handleZoomChange}
                    />
                  )}
                  <p className="gimbal-hint">Manual control turns off AI tracking.</p>
              </CollapsibleSection>
            )}
            <CollapsibleSection
              id="ai-control"
              title={<>AI Control Target Tracking{activeAiMode ? <span className="section-status">{activeAiMode}</span> : null}</>}
              defaultOpen={false}
            >
                <div id="controls">
                    <button
                      className={status?.ai_mode === AiWorkModes.None ? 'active' : ''}
                      id="stop"
                      onClick={() => setAiMode(AiWorkModes.None)}
                    >Stop AI</button>
                    <button
                      className={status?.ai_mode === AiWorkModes.Human && status?.ai_sub_mode === AiSubModeHumans.Normal ? 'active' : ''}
                      id="normal"
                      onClick={() => setAiMode(AiWorkModes.Human, AiSubModeHumans.Normal)}
                    >Normal</button>
                    <button
                      className={status?.ai_mode === AiWorkModes.Human && status?.ai_sub_mode === AiSubModeHumans.UpperBody ? 'active' : ''}
                      id="upperbody"
                      onClick={() => setAiMode(AiWorkModes.Human, AiSubModeHumans.UpperBody)}
                    >Upper Body</button>
                    <button
                      className={status?.ai_mode === AiWorkModes.Human && status?.ai_sub_mode === AiSubModeHumans.CloseUp ? 'active' : ''}
                      id="closeup"
                      onClick={() => setAiMode(AiWorkModes.Human, AiSubModeHumans.CloseUp)}
                    >Close Up</button>
                    <button
                      className={status?.ai_mode === AiWorkModes.Human && status?.ai_sub_mode === AiSubModeHumans.Headless ? 'active' : ''}
                      id="headless"
                      onClick={() => setAiMode(AiWorkModes.Human, AiSubModeHumans.Headless)}
                    >Headless</button>
                    <button
                      className={status?.ai_mode === AiWorkModes.Human && status?.ai_sub_mode === AiSubModeHumans.LowerBody ? 'active' : ''}
                      id="lowerbody"
                      onClick={() => setAiMode(AiWorkModes.Human, AiSubModeHumans.LowerBody)}
                    >Lower Body</button>
                    <button
                      className={status?.ai_mode === AiWorkModes.Human && status?.ai_sub_mode === AiSubModeHumans.Butt ? 'active' : ''}
                      id="butt"
                      onClick={() => setAiMode(AiWorkModes.Human, AiSubModeHumans.Butt)}
                    >Butt</button>
                    <button
                      className={status?.ai_mode === AiWorkModes.Desk ? 'active' : ''}
                      id="desk"
                      onClick={() => setAiMode(AiWorkModes.Desk)}
                    >Desk</button>
                    <button
                      className={status?.ai_mode === AiWorkModes.WhiteBoard ? 'active' : ''}
                      id="whiteboard"
                      onClick={() => setAiMode(AiWorkModes.WhiteBoard)}
                    >Whiteboard</button>
                    <button
                      className={status?.ai_mode === AiWorkModes.Hand ? 'active' : ''}
                      id="hand"
                      onClick={() => setAiMode(AiWorkModes.Hand)}
                    >Hand</button>
                    <button
                      className={status?.ai_mode === AiWorkModes.Group ? 'active' : ''}
                      id="group"
                      onClick={() => setAiMode(AiWorkModes.Group)}
                    >Group</button>
                </div>
            </CollapsibleSection>

            {(devices[selectedDevice || '']?.family === 'Tiny') && (
              <CollapsibleSection id="gestures" title="AI Gestures" className="ai-gestures-group" defaultOpen={false}>
                  <div id="toggle-controls">
                    <ToggleButton
                      label="Gesture Target"
                      isActive={Boolean(status?.gesture_target)}
                      tooltip={`${status?.gesture_target ? 'Disable' : 'Enable'} target gesture control.`}
                      onToggle={() => {
                        if (selectedDevice) {
                          const enable = !status?.gesture_target;
                          window.ipcRenderer.toggleGestureTarget(selectedDevice, enable);
                          window.ipcRenderer.getDeviceStatus(selectedDevice).then(status => {
                            console.log("status", status);
                            setStatus(status);
                          });
                        }
                      }}
                    />
                    <ToggleButton
                      label="Gesture Zoom"
                      isActive={Boolean(status?.gesture_zoom)}
                      tooltip={`${status?.gesture_zoom ? 'Enable' : 'Disable'} zooming in and out with single hand gestures.`}
                      onToggle={() => {
                        if (selectedDevice) {
                          const enable = !status?.gesture_zoom;
                          window.ipcRenderer.toggleGestureZoom(selectedDevice, enable);
                          window.ipcRenderer.getDeviceStatus(selectedDevice).then(status => {
                            console.log("status", status);
                            setStatus(status);
                          });
                        }
                      }}
                    />
                    <ToggleButton label="Gesture Dynamic Zoom"
                      isActive={Boolean(status?.gesture_dynamic_zoom)}
                      tooltip={`${status?.gesture_dynamic_zoom ? 'Disable' : 'Enable'} dynamic zooming based on two hand gestures.`}
                      onToggle={() => {
                        if (selectedDevice) {
                          const enable = !status?.gesture_dynamic_zoom;
                          window.ipcRenderer.toggleGestureDynamicZoom(selectedDevice, enable);
                          window.ipcRenderer.getDeviceStatus(selectedDevice).then(status => {
                            console.log("status", status);
                            setStatus(status);
                          });
                        }
                      }}
                    />
                    <ToggleButton
                      label="Gesture Mirror"
                      isActive={Boolean(status?.gesture_mirror)}
                      tooltip={`${status?.gesture_mirror ? 'Disable' : 'Enable'} reversing the camera movement direction for Dynamic Zoom.`}
                      onToggle={() => {
                        if (selectedDevice) {
                          const enable = !status?.gesture_mirror;
                          window.ipcRenderer.toggleGestureMirror(selectedDevice, enable);
                          window.ipcRenderer.getDeviceStatus(selectedDevice).then(status => {
                            console.log("status", status);
                            setStatus(status);
                          });
                        }
                      }}
                    />
                  </div>
              </CollapsibleSection>
            )}

            {/* <div className="control-group diagnostic-group">
                <details>
                    <summary>Device Diagnostics</summary>
                    <div id="diagnostic-controls">
                        <button id="scan-devices">Scan OBSBOT Devices</button>
                    </div>
                    <div id="scan-results" className="scan-results"></div>
                </details>
            </div> */}
        </div>
    </div>

    {assigning && (
      <DeviceMatcherDialog
        device={assigning}
        candidates={enumeratedDevices.filter((candidate) => !usedMediaDeviceIds.has(candidate.deviceId))}
        onAssign={(candidate) => handleManualAssign(assigning, candidate)}
        onClear={() => handleManualClear(assigning)}
        onClose={() => setAssigningDevice(null)}
      />
    )}
    </>
  )
}

export default App
