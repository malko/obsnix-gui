import { useEffect, useState, useRef, useCallback } from 'react'
import './App.css'
import { SourceSelector } from './components/SourceSelector'
import { FrontEndDevice, type FrontEndDeviceWithMediaInfo } from '../types';
import { AiSubModeHumans, AiWorkModes, TinyDevice } from 'obsbot-sdk/lib/tiny_device';
import { ToggleButton } from './components/ToggleButton';

const linkMediaDeviceToRealDevice = async (devices: Record<string, FrontEndDevice>): Promise<Record<string, FrontEndDeviceWithMediaInfo>> => {
  const mediaDevices = await navigator.mediaDevices.enumerateDevices();
  const videoDevices = mediaDevices.filter(d => d.kind === 'videoinput');
  console.log("Available video devices:", videoDevices);

  const linkedDevices: Record<string, FrontEndDeviceWithMediaInfo> = {};
  for (const [deviceId, device] of Object.entries(devices)) {
    const matchingMediaDevice = videoDevices.find(md => {
      const matcher = device.mediaDeviceLabelMatcher ? new RegExp(device.mediaDeviceLabelMatcher, 'i') : null;
      if (matcher) {
        return matcher.test(md.label);
      }
    });
    if (matchingMediaDevice) {
      linkedDevices[deviceId] = {
        ...device,
        mediaDeviceId: matchingMediaDevice.deviceId,
        mediaDeviceLabel: matchingMediaDevice.label
      };
    } else {
      linkedDevices[deviceId] = {
        ...device,
        mediaDeviceId: mediaDevices[0]?.deviceId || '',
        mediaDeviceLabel: mediaDevices[0]?.label || 'Unknown Device'
      };
    }
  }
  return linkedDevices;
};


function App() {
  // Load device list and manage state here
  const [devices, setDevices] = useState<Record<string, FrontEndDevice & { mediaDeviceId: string, mediaDeviceLabel: string }>>({});
  const [selectedDevice, setSelectedDevice] = useState<string | null>(null);
  const [status, setStatus] = useState<any>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const playerPlay = useCallback(async () => {
    if (selectedDevice && videoRef.current) {
      try {
        const device = devices[selectedDevice];
        if (!device) {
          console.error("Selected device not found");
          alert("Selected device not found");
          return;
        }
        if (!device.mediaDeviceId) {
          console.error("No media device ID associated with selected device");
          alert("No media device ID associated with selected device");
          return;
        }
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { deviceId: { exact: device.mediaDeviceId } }
        });
        videoRef.current.srcObject = stream;
        console.log("Video stream started successfully");
      } catch (err: any) {
        console.error("Error accessing camera:", err);
        alert(`Error accessing camera: ${err?.message || err}`);
      }
    }
  }, [selectedDevice, devices]);

  const playerStop = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
  }
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
      setStatus(status);
    });
    const removeOnDeviceListListener = window.ipcRenderer.onDeviceList(async (deviceList: Record<string, FrontEndDevice>) => {
      console.log("Received device list:", deviceList);
      setDevices(await linkMediaDeviceToRealDevice(deviceList));
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
      // clearTimeout(timer);
      removeOnDeviceListListener();
      removeOnDeviceStatusListener();
    }
  }, [setStatus, selectedDevice, setSelectedDevice]);

  useEffect(() => {
    window.ipcRenderer.listDevices();
  }, []);

  // bind video play/stop to selected device on device change
  useEffect(() => {
    console.log("Video effect triggered - selectedDevice:", selectedDevice);
    if (selectedDevice) {
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
  }, [selectedDevice, playerPlay]);

  if (!devices || Object.keys(devices).length === 0) {
    return (
      <>
        <h1>Looking for devices</h1>
        <p>Please wait while we detecting devices...</p>
        <div className="spinner"></div>
        <p>If no devices is found after 5 seconds, please check the connection and try again by clicking the refresh button.</p>
        <button id="refresh-cameras" onClick={() => window.ipcRenderer.listDevices()}>🔄</button>
      </>
    );
  }
  return (
    <>
    <h1>OBSNIX: Obsbot control center</h1>

    <div className="main-container">
        <div id="video-container">
            <video id="video" autoPlay={true} ref={videoRef}></video>
            <canvas id="last-frame-canvas" className="last-frame-canvas hidden"></canvas>
            <div id="video-overlay" className="video-overlay hidden">
                <div className="overlay-content">
                    <div className="spinner"></div>
                    <p>Applying settings...</p>
                </div>
            </div>
        </div>

        <div className="controls-container">
            <div className="control-group">
                <h2>Video</h2>
                <div id="video-controls">
                    <SourceSelector devices={devices} selected={selectedDevice} onSelect={setSelectedDevice} />
                    <button id="refresh-cameras" onClick={() => window.ipcRenderer.listDevices()}>🔄</button>
                    <button id="start-video" onClick={() => playerPlay()}>Display Video</button>
                    <button id="stop-video" onClick={() => playerStop()}>Stop Video</button>
                </div>
            </div>

            <div className="control-group">
                <h2>AI Control Target Tracking</h2>
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
            </div>
            {(devices[selectedDevice || ''] instanceof TinyDevice) ? '': <>
              <div className="control-group ai-gestures-group">
                  <h2>Ai gestures</h2>
                  <div id="toggle-controls">
                    <ToggleButton
                      label="Gesture Target"
                      isActive={status?.gesture_target}
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
                      isActive={status?.gesture_zoom}
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
                      isActive={status?.gesture_dynamic_zoom}
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
                      isActive={status?.gesture_mirror}
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
              </div></>
            }

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
    </>
  )
}

export default App
