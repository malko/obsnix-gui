import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { GimbalControl } from './GimbalControl';

describe('GimbalControl', () => {
  it('renders the joystick, center, speed and invert controls', () => {
    const html = renderToStaticMarkup(<GimbalControl deviceSn="SN1" />);

    expect(html).toContain('aria-label="Gimbal joystick');
    expect(html).toContain('Center');
    expect(html).toContain('value="normal" selected');
    expect(html).toContain('Invert tilt (up/down)');
    expect(html).toContain('Invert pan (left/right)');
  });

  it('does not render the angle readout (it lives in the section title)', () => {
    const html = renderToStaticMarkup(<GimbalControl deviceSn="SN1" />);
    expect(html).not.toContain('gimbal-angles');
  });
});
