import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { CollapsibleSection } from './CollapsibleSection';

describe('CollapsibleSection', () => {
  it('renders its content and expanded state when open', () => {
    const html = renderToStaticMarkup(
      <CollapsibleSection id="test-open" title="My Section" defaultOpen>
        <span>inner content</span>
      </CollapsibleSection>,
    );

    expect(html).toContain('My Section');
    expect(html).toContain('inner content');
    expect(html).toContain('aria-expanded="true"');
    expect(html).toContain('is-open');
  });

  it('hides the content when collapsed by default', () => {
    const html = renderToStaticMarkup(
      <CollapsibleSection id="test-closed" title="Closed Section" defaultOpen={false}>
        <span>hidden content</span>
      </CollapsibleSection>,
    );

    expect(html).toContain('Closed Section');
    expect(html).not.toContain('hidden content');
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain('is-collapsed');
  });

  it('appends an extra class name', () => {
    const html = renderToStaticMarkup(
      <CollapsibleSection id="test-extra" title="Extra" className="ai-gestures-group">
        <span>x</span>
      </CollapsibleSection>,
    );

    expect(html).toContain('ai-gestures-group');
  });

  it('supports a rich title with an inline status', () => {
    const html = renderToStaticMarkup(
      <CollapsibleSection
        id="test-status"
        title={<>Gimbal <span className="section-status">Pitch 0° · Pan 0° · Roll 0°</span></>}
        defaultOpen={false}
      >
        <span>x</span>
      </CollapsibleSection>,
    );

    expect(html).toContain('section-status');
    expect(html).toContain('Pitch 0° · Pan 0° · Roll 0°');
  });
});
