import type { FrontEndDeviceWithMediaInfo } from "../../types";

/**
 * Displays the available OBSBOT video sources exposed by the SDK and the
 * match status of each one against the system cameras exposed by Electron.
 * Untrusted / unresolved matches are flagged and can be assigned manually.
 */
export const SourceSelector = ({ devices, selected, onSelect, onAssign, onClearManual }: {
  devices: Record<string, FrontEndDeviceWithMediaInfo>;
  selected: string | null;
  onSelect: (key: string) => void;
  onAssign: (key: string) => void;
  onClearManual: (key: string) => void;
}) => {
  const selectedDevice = selected ? devices[selected] : undefined;

  const suffix = (device: FrontEndDeviceWithMediaInfo): string => {
    switch (device.matchSource) {
      case 'label': return ' — matched by name';
      case 'manual': return ' — manually matched';
      case 'ambiguous': return ' — ambiguous';
      case 'none': return ' — no camera found';
      default: return '';
    }
  };

  const describeMatch = (device: FrontEndDeviceWithMediaInfo): { tone: string, message: string } | null => {
    if (device.staleManualMapping) {
      return { tone: 'none', message: 'The saved camera assignment is no longer valid.' };
    }
    switch (device.matchSource) {
      case 'none':
        return { tone: 'none', message: 'No system camera was matched to this device.' };
      case 'ambiguous':
        return { tone: 'ambiguous', message: 'Several system cameras match this device.' };
      case 'label':
        return { tone: 'label', message: 'Matched by name only, it could be the wrong camera.' };
      case 'manual':
        return { tone: 'manual', message: `Manually matched to “${device.mediaDeviceLabel || 'unknown camera'}”.` };
      default:
        return null;
    }
  };

  const status = selectedDevice ? describeMatch(selectedDevice) : null;
  const canReset = selectedDevice?.matchSource === 'manual' || selectedDevice?.staleManualMapping;

  return (
    <div className="source-selector">
      <select id="video-source" value={selected || ''} onChange={(e) => onSelect(e.target.value)}>
        <option value="" disabled>Select a video source</option>
        {Object.values(devices).map((device) => (
          <option key={device.key} value={device.key}>
            {`OBSBOT ${device.productTypeName} (SN: ${device.sn})${suffix(device)}`}
          </option>
        ))}
      </select>
      {status && selectedDevice && (
        <div className={`match-warning match-${status.tone}`}>
          <span>{status.message}</span>
          <button onClick={() => onAssign(selectedDevice.key)}>Assign…</button>
          {canReset && (
            <button onClick={() => onClearManual(selectedDevice.key)}>Reset</button>
          )}
        </div>
      )}
    </div>
  );
}
