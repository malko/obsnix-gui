export type FrontEndDevice = {
  productId: number,
  productTypeName: string,
  product: string,
  key: string,
  sn: string,
  capabilities: any,
  videoPath: string,
  uuid: string,
  modelCode: string,
  mediaDeviceLabelMatcher?: RegExp
}


export type FrontEndDeviceWithMediaInfo = FrontEndDevice & { mediaDeviceId: string, mediaDeviceLabel: string };