import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { SourceSelector } from './SourceSelector';
import type { FrontEndDeviceWithMediaInfo } from '../../types';

const makeDevice = (overrides: Partial<FrontEndDeviceWithMediaInfo> = {}): FrontEndDeviceWithMediaInfo => ({
  productId: 12,
  productTypeName: 'Tiny SE',
  product: 'OBSBOT Tiny SE',
  key: 'A',
  sn: 'SN-A',
  family: 'Tiny',
  capabilities: {},
  videoPath: '/dev/video0',
  videoPaths: ['/dev/video0'],
  uuid: 'uuid',
  modelCode: 'MC',
  mediaDeviceId: 'dev-a',
  mediaDeviceLabel: 'Camera A',
  matchSource: 'exact',
  ...overrides,
});

const noop = () => {};

describe('SourceSelector', () => {
  it('renders the selected device as the selected option', () => {
    const devices = {
      A: makeDevice({ key: 'A', sn: 'SN-A', productTypeName: 'Tiny SE' }),
      B: makeDevice({ key: 'B', sn: 'SN-B', productTypeName: 'Meet 4k', family: 'Obsbot Meet' }),
    };

    const html = renderToStaticMarkup(
      <SourceSelector devices={devices} selected="B" onSelect={noop} onAssign={noop} onClearManual={noop} />,
    );

    expect(html).toContain('value="B" selected');
    expect(html).toContain('value="A"');
  });

  it('keeps the placeholder when nothing is selected', () => {
    const devices = { A: makeDevice() };
    const html = renderToStaticMarkup(
      <SourceSelector devices={devices} selected={null} onSelect={noop} onAssign={noop} onClearManual={noop} />,
    );

    expect(html).not.toContain('value="A" selected');
  });

  it('flags an unresolved match and offers assignment', () => {
    const devices = { A: makeDevice({ matchSource: 'none', mediaDeviceId: '', mediaDeviceLabel: '' }) };
    const html = renderToStaticMarkup(
      <SourceSelector devices={devices} selected="A" onSelect={noop} onAssign={noop} onClearManual={noop} />,
    );

    expect(html).toContain('match-none');
    expect(html).toContain('No system camera was matched to this device.');
    expect(html).toContain('Assign');
  });

  it('does not flag an exact match', () => {
    const devices = { A: makeDevice({ matchSource: 'exact' }) };
    const html = renderToStaticMarkup(
      <SourceSelector devices={devices} selected="A" onSelect={noop} onAssign={noop} onClearManual={noop} />,
    );

    expect(html).not.toContain('match-warning');
  });

  it('offers a reset action for a manual match', () => {
    const devices = { A: makeDevice({ matchSource: 'manual', mediaDeviceLabel: 'Camera A' }) };
    const html = renderToStaticMarkup(
      <SourceSelector devices={devices} selected="A" onSelect={noop} onAssign={noop} onClearManual={noop} />,
    );

    expect(html).toContain('match-manual');
    expect(html).toContain('Manually matched');
    expect(html).toContain('Reset');
  });

  it('warns when a saved assignment is no longer valid', () => {
    const devices = { A: makeDevice({ matchSource: 'exact', staleManualMapping: true }) };
    const html = renderToStaticMarkup(
      <SourceSelector devices={devices} selected="A" onSelect={noop} onAssign={noop} onClearManual={noop} />,
    );

    expect(html).toContain('The saved camera assignment is no longer valid.');
    expect(html).toContain('Reset');
  });
});
