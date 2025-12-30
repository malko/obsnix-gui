import type { FrontEndDeviceWithMediaInfo } from "../../types";

/**
 * this component will display of available video sources from the obsbot sdk library (by ipc calls to scan-obsbot-devices)
 * and display the currently selected camera if any.
 * If no camera is found it will display a message to the user.
 */
export const SourceSelector = ({ devices, selected, onSelect }: { devices: Record<string, FrontEndDeviceWithMediaInfo>; selected: string | null; onSelect: (key: string) => void; }) => {

	return (
		<select id="video-source" value={selected || ''} onChange={(e) => onSelect(e.target.value)}>
			<option value="" disabled>Select a video source</option>
			{Object.values(devices).map((device) => (
				<option key={device.sn} value={device.sn}>
					OBSBOT {device.productTypeName} (SN: {device.sn})
				</option>
			))}
		</select>
	);
}