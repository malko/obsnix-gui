import React from 'react';

export const ToggleButton: React.FC<{
	label: string;
	isActive: boolean;
	tooltip?: string;
	onToggle: () => void;
}> = ({ label, isActive, tooltip, onToggle }) => {
	const trackStyle: React.CSSProperties = {
		width: '40px',
		height: '20px',
		borderRadius: '10px',
		backgroundColor: isActive ? '#4ade80' : '#d1d5db',
		opacity: isActive ? 1 : 0.4,
		border: 'none',
		cursor: 'pointer',
		position: 'relative',
		transition: 'background-color 0.2s ease-in-out, opacity 0.2s ease-in-out',
		padding: 0,
		display: 'flex',
		alignItems: 'center',
	};

	const thumbStyle: React.CSSProperties = {
		width: '16px',
		height: '16px',
		borderRadius: '50%',
		backgroundColor: 'white',
		position: 'absolute',
		left: isActive ? '22px' : '2px',
		transition: 'left 0.2s ease-in-out',
		boxShadow: '0 1px 3px rgba(255, 255, 255, 0.2)',
	};

	const containerStyle: React.CSSProperties = {
		display: 'flex',
		alignItems: 'center',
		gap: '8px',
	};

	return (
		<div style={containerStyle} title={tooltip}>
			<label>{label}</label>
			<button style={trackStyle} onClick={onToggle} aria-pressed={isActive}>
				<span style={thumbStyle} />
			</button>
		</div>
	);
};