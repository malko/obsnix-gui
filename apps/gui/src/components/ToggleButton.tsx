import React from 'react';
import './ToggleButton.css';

export const ToggleButton: React.FC<{
	label: string;
	isActive: boolean;
	tooltip?: string;
	className?: string;
	onToggle: () => void;
}> = ({ label, isActive, tooltip, className, onToggle }) => {
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

	return (
		<div className={`toggle-button-container ${className ??'' }`} title={tooltip}>
			<label onClick={onToggle} style={{flexGrow:1, textAlign:"left"}}>{label}</label>
			<button style={trackStyle} onClick={onToggle} aria-pressed={isActive}>
				<span style={thumbStyle} />
			</button>
		</div>
	);
};