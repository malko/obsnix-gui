import { describe, expect, it } from 'vitest';
import type { FrontEndDevice } from '../../types';
import {
  computeDeviceIdCandidates,
  hmacHex,
  labelMatchScore,
  linkMediaDevicesToRealDevices,
  normalizeLabel,
} from './mediaDeviceMatching';

const makeDevice = (overrides: Partial<FrontEndDevice> = {}): FrontEndDevice => ({
  productId: 12,
  productTypeName: 'Tiny SE',
  product: 'OBSBOT Tiny SE',
  key: 'SN1',
  sn: 'SN1',
  family: 'Tiny',
  capabilities: {},
  videoPath: '/dev/video0',
  videoPaths: ['/dev/video0'],
  uuid: 'uuid-1',
  modelCode: 'MC',
  ...overrides,
});

describe('mediaDeviceMatching', () => {
  describe('hmacHex', () => {
    it('reproduces the Chromium HMAC-SHA256 device id derivation', async () => {
      // Reference value computed with node:crypto independently of the implementation.
      const digest = await hmacHex('http://localhost:5173', '/dev/video0TESTSALT');
      expect(digest).toBe('5314fcfc5d5552b3403ffea1c2460f84d9b889eebf6973e4f2a2d8cda8b15f72');
    });

    it('handles a file:// origin', async () => {
      const digest = await hmacHex('file://', '/dev/video1SALT2');
      expect(digest).toBe('5b4cf7f9e93a0f033b8ca4bd5eded5a3c271a4a4242d588173c369225cf07eae');
    });
  });

  describe('computeDeviceIdCandidates', () => {
    it('returns a candidate per raw id and salt combination', async () => {
      const candidates = await computeDeviceIdCandidates(
        ['/dev/video0', '/dev/video1'],
        ['SALT_A', 'SALT_B'],
        'http://localhost:5173',
      );
      expect(candidates.size).toBe(4);
      expect(candidates.has(await hmacHex('http://localhost:5173', '/dev/video0SALT_A'))).toBe(true);
      expect(candidates.has(await hmacHex('http://localhost:5173', '/dev/video1SALT_B'))).toBe(true);
    });

    it('ignores empty raw ids', async () => {
      const candidates = await computeDeviceIdCandidates([''], ['SALT_A'], 'file://');
      expect(candidates.size).toBe(0);
    });
  });

  describe('normalizeLabel', () => {
    it('strips the USB vid:pid suffix and normalizes separators', () => {
      expect(normalizeLabel('OBSBOT Tiny SE (1234:5678)')).toBe('obsbot tiny se');
      expect(normalizeLabel('  OBSBOT   Tiny SE  ')).toBe('obsbot tiny se');
    });
  });

  describe('labelMatchScore', () => {
    it('prefers the most specific model name', () => {
      const tiny = makeDevice({ productTypeName: 'Tiny', product: 'OBSBOT Tiny' });
      const tiny4k = makeDevice({ productTypeName: 'Tiny 4k', product: 'OBSBOT Tiny 4k' });
      const label = 'OBSBOT Tiny 4k: OBSBOT Tiny 4k (1111:2222)';
      expect(labelMatchScore(label, tiny4k)).toBeGreaterThan(labelMatchScore(label, tiny));
    });

    it('returns 0 for unrelated labels', () => {
      const device = makeDevice();
      expect(labelMatchScore('Logitech BRIO (046d:085e)', device)).toBe(0);
    });
  });

  describe('linkMediaDevicesToRealDevices', () => {
    it('matches exactly through the HMAC device id even if the label is unrelated', async () => {
      const deviceId = await hmacHex('http://localhost:5173', '/dev/video0TESTSALT');
      const linked = await linkMediaDevicesToRealDevices(
        { SN1: makeDevice() },
        [{ deviceId, label: 'Some Camera' }],
        { salts: ['TESTSALT'], origin: 'http://localhost:5173' },
      );

      expect(linked.SN1.matchSource).toBe('exact');
      expect(linked.SN1.mediaDeviceId).toBe(deviceId);
      expect(linked.SN1.mediaDeviceLabel).toBe('Some Camera');
    });

    it('tries every video path candidate of the same device', async () => {
      const deviceId = await hmacHex('http://localhost:5173', '/dev/video2TESTSALT');
      const device = makeDevice({ videoPath: '/dev/video0', videoPaths: ['/dev/video0', '/dev/video2'] });
      const linked = await linkMediaDevicesToRealDevices(
        { SN1: device },
        [{ deviceId, label: '' }],
        { salts: ['TESTSALT'], origin: 'http://localhost:5173' },
      );

      expect(linked.SN1.matchSource).toBe('exact');
      expect(linked.SN1.mediaDeviceId).toBe(deviceId);
    });

    it('falls back to label matching and respects model specificity', async () => {
      const tiny = makeDevice({ sn: 'TINY', key: 'TINY', productTypeName: 'Tiny SE', product: 'OBSBOT Tiny SE' });
      const meet = makeDevice({
        sn: 'MEET', key: 'MEET', productTypeName: 'Meet 4k', product: 'OBSBOT Meet 4k',
        family: 'Obsbot Meet', videoPath: '/dev/video1', videoPaths: ['/dev/video1'],
      });

      const linked = await linkMediaDevicesToRealDevices(
        { TINY: tiny, MEET: meet },
        [
          { deviceId: 'd-meet', label: 'OBSBOT Meet 4k: OBSBOT Meet 4k (1234:5678)' },
          { deviceId: 'd-tiny', label: 'OBSBOT Tiny SE: OBSBOT Tiny SE (9999:0000)' },
        ],
        {},
      );

      expect(linked.TINY.matchSource).toBe('label');
      expect(linked.TINY.mediaDeviceId).toBe('d-tiny');
      expect(linked.MEET.matchSource).toBe('label');
      expect(linked.MEET.mediaDeviceId).toBe('d-meet');
    });

    it('never maps two anonymous identical cameras to the same device', async () => {
      const a = makeDevice({ sn: 'A', key: 'A' });
      const b = makeDevice({ sn: 'B', key: 'B' });
      const linked = await linkMediaDevicesToRealDevices(
        { A: a, B: b },
        [
          { deviceId: 'c1', label: 'OBSBOT Tiny SE (1111:2222)' },
          { deviceId: 'c2', label: 'OBSBOT Tiny SE (1111:2222)' },
        ],
        {},
      );

      expect(linked.A.matchSource).toBe('ambiguous');
      expect(linked.B.matchSource).toBe('ambiguous');
      expect(linked.A.mediaDeviceId).toBe('');
      expect(linked.A.matchCandidates).toHaveLength(2);
    });

    it('returns none when nothing matches', async () => {
      const linked = await linkMediaDevicesToRealDevices(
        { SN1: makeDevice() },
        [{ deviceId: 'other', label: 'Logitech BRIO (046d:085e)' }],
        {},
      );

      expect(linked.SN1.matchSource).toBe('none');
      expect(linked.SN1.mediaDeviceId).toBe('');
    });

    it('honours a manual mapping even when the label would not match', async () => {
      const linked = await linkMediaDevicesToRealDevices(
        { SN1: makeDevice() },
        [{ deviceId: 'manual-cam', label: 'Whatever Camera' }],
        { manualMapping: { SN1: { deviceId: 'manual-cam', label: 'Whatever Camera' } } },
      );

      expect(linked.SN1.matchSource).toBe('manual');
      expect(linked.SN1.mediaDeviceId).toBe('manual-cam');
    });

    it('ignores a stale manual mapping whose device is gone', async () => {
      const deviceId = await hmacHex('http://localhost:5173', '/dev/video0TESTSALT');
      const linked = await linkMediaDevicesToRealDevices(
        { SN1: makeDevice() },
        [{ deviceId, label: '' }],
        {
          salts: ['TESTSALT'],
          origin: 'http://localhost:5173',
          manualMapping: { SN1: { deviceId: 'stale', label: 'Gone' } },
        },
      );

      expect(linked.SN1.matchSource).toBe('exact');
      expect(linked.SN1.mediaDeviceId).toBe(deviceId);
      expect(linked.SN1.staleManualMapping).toBe(true);
    });

    it('does not let a stale manual mapping steal another device\'s exact camera', async () => {
      const origin = 'http://localhost:5173';
      const deviceIdA = await hmacHex(origin, '/dev/video0TESTSALT');
      const a = makeDevice({ sn: 'A', key: 'A', videoPath: '/dev/video0', videoPaths: ['/dev/video0'] });
      const b = makeDevice({
        sn: 'B', key: 'B', videoPath: '/dev/video1', videoPaths: ['/dev/video1'],
        productTypeName: 'Meet 4k', product: 'OBSBOT Meet 4k', family: 'Obsbot Meet',
      });

      const linked = await linkMediaDevicesToRealDevices(
        { A: a, B: b },
        [{ deviceId: deviceIdA, label: '' }],
        {
          salts: ['TESTSALT'],
          origin,
          manualMapping: { B: { deviceId: deviceIdA, label: '' } },
        },
      );

      expect(linked.A.matchSource).toBe('exact');
      expect(linked.A.mediaDeviceId).toBe(deviceIdA);
      expect(linked.B.mediaDeviceId).toBe('');
      expect(linked.B.staleManualMapping).toBe(true);
    });
  });
});
