import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ZoomControl } from './ZoomControl';

const noop = () => {};

// Devices expose raw UVC steps; the real zoom factor goes up to 4x (Tiny SE).
const TINY_RANGE = { min: 1, max: 1.12, step: 0.01, default: 1, factorMax: 4 };

describe('ZoomControl', () => {
  it('renders a slider with single-click preset dots labelled with real factors', () => {
    const html = renderToStaticMarkup(
      <ZoomControl range={TINY_RANGE} value={1} onChange={noop} />,
    );

    expect(html).toContain('role="slider"');
    expect(html).toContain('aria-label="Zoom level"');
    expect(html).toContain('Set zoom to 1×');
    expect(html).toContain('Set zoom to 2×');
    expect(html).toContain('Set zoom to 3×');
    expect(html).toContain('Set zoom to 4×');
  });

  it('shows the real zoom factor for the current value and its thumb position', () => {
    const html = renderToStaticMarkup(
      <ZoomControl range={TINY_RANGE} value={1.06} onChange={noop} />,
    );

    expect(html).toContain('2.5×');
    expect(html).toContain('left:50%');
  });

  it('places the max-factor preset at the end of the track', () => {
    const html = renderToStaticMarkup(
      <ZoomControl range={TINY_RANGE} value={1.12} onChange={noop} />,
    );

    expect(html).toContain('4×');
    expect(html).toContain('left:100%');
  });
});
