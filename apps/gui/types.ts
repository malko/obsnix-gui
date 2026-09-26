export type MediaMatchSource = 'exact' | 'label' | 'ambiguous' | 'manual' | 'none';

export type DeviceStatus = Record<string, unknown>;

export type MediaDeviceCandidate = {
  deviceId: string,
  label: string,
}

export type FrontEndDevice = {
  productId: number,
  productTypeName: string,
  product: string,
  key: string,
  sn: string,
  family: string,
  capabilities: unknown,
  videoPath: string,
  videoPaths?: string[],
  uuid: string,
  modelCode: string,
}

export type FrontEndDeviceWithMediaInfo = FrontEndDevice & {
  mediaDeviceId: string,
  mediaDeviceLabel: string,
  matchSource: MediaMatchSource,
  matchCandidates?: MediaDeviceCandidate[],
  staleManualMapping?: boolean,
};
