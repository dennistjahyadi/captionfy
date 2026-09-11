import { NativeModule, requireNativeModule } from 'expo';

export type DeviceProfile = {
  /** Short one-line device description used as the `device` column in the CSV. */
  label: string;
  model: string;
  soc: string;
  osVersion: string;
  abi: string;
  cpuCores: number;
  totalRamMb: number;
};

export type SourceInfo = {
  /** The provider's display name, for example `accent-03.wav`. Empty when unknown. */
  name: string;
  sizeBytes: number;
  /** False when the URI can no longer be opened: file deleted, or access revoked. */
  readable: boolean;
};

declare class SpikeMetricsModule extends NativeModule {
  getDeviceProfile(): DeviceProfile;
  getPeakRssBytes(): number;
  getCurrentRssBytes(): number;
  /** True when the kernel reset the watermark, so the next peak covers one run only. */
  resetPeakRss(): boolean;
  /**
   * Resolves a picked `content://` or `file://` URI to a real filename and size.
   * A document URI's last path segment is a provider id, not a name.
   */
  describeSource(uri: string): Promise<SourceInfo>;
  /** Writes to the native `Caption` log tag, which survives a release build. */
  log(message: string): void;
}

export default requireNativeModule<SpikeMetricsModule>('SpikeMetrics');
