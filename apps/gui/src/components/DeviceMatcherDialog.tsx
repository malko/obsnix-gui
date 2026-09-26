import { useEffect, useRef, useState } from 'react';
import type { FrontEndDeviceWithMediaInfo, MediaDeviceCandidate } from '../../types';
import type { EnumeratedMediaDevice } from '../utils/mediaDeviceMatching';

type Props = {
  device: FrontEndDeviceWithMediaInfo;
  candidates: EnumeratedMediaDevice[];
  onAssign: (candidate: MediaDeviceCandidate) => void;
  onClear: () => void;
  onClose: () => void;
};

/**
 * Lets the user manually map an OBSBOT device to a system camera. The
 * "Identify" action asks the SDK to physically move (gimbal/zoom) the OBSBOT
 * device so the user can tell which preview corresponds to it.
 */
export const DeviceMatcherDialog = ({ device, candidates, onAssign, onClear, onClose }: Props) => {
  const [previewDeviceId, setPreviewDeviceId] = useState<string | null>(null);
  const [identifying, setIdentifying] = useState(false);
  const [identifyResult, setIdentifyResult] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const videoElement = videoRef.current;
    let stream: MediaStream | null = null;
    let cancelled = false;

    const startPreview = async () => {
      if (!previewDeviceId || !videoElement) return;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { deviceId: { exact: previewDeviceId } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        videoElement.srcObject = stream;
      } catch (error) {
        console.error('Could not start camera preview:', error);
      }
    };

    startPreview();
    return () => {
      cancelled = true;
      stream?.getTracks().forEach((track) => track.stop());
      if (videoElement) videoElement.srcObject = null;
    };
  }, [previewDeviceId]);

  const identify = async () => {
    setIdentifying(true);
    setIdentifyResult(null);
    try {
      const result = await window.ipcRenderer.identifyDevice(device.sn);
      setIdentifyResult(result?.success ? 'The OBSBOT device should have moved.' : 'Could not move this device.');
    } catch (error) {
      console.error('Identify failed:', error);
      setIdentifyResult('Could not move this device.');
    } finally {
      setIdentifying(false);
    }
  };

  return (
    <div className="dialog-backdrop" onClick={onClose}>
      <div className="dialog" onClick={(event) => event.stopPropagation()}>
        <h3>Assign a system camera</h3>
        <p>
          Choose which system camera corresponds to OBSBOT {device.productTypeName} (SN: {device.sn}).
        </p>

        <div className="dialog-identify">
          <button onClick={identify} disabled={identifying}>
            {identifying ? 'Moving camera…' : 'Identify (move this camera)'}
          </button>
          {identifyResult && <span>{identifyResult}</span>}
        </div>

        <video ref={videoRef} autoPlay muted playsInline className="dialog-preview" />

        <ul className="candidate-list">
          {candidates.length === 0 && <li>No system camera available.</li>}
          {candidates.map((candidate) => (
            <li key={candidate.deviceId} className={previewDeviceId === candidate.deviceId ? 'active' : ''}>
              <button className="candidate-preview" onClick={() => setPreviewDeviceId(candidate.deviceId)}>
                {candidate.label || 'Unknown camera'}
              </button>
              <button className="candidate-assign" onClick={() => onAssign({ deviceId: candidate.deviceId, label: candidate.label })}>
                Assign
              </button>
            </li>
          ))}
        </ul>

        <div className="dialog-actions">
          {device.matchSource === 'manual' && <button onClick={onClear}>Remove manual mapping</button>}
          <button onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
};
