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

declare class SpikeMetricsModule extends NativeModule {
  getDeviceProfile(): DeviceProfile;
  getPeakRssBytes(): number;
  getCurrentRssBytes(): number;
  /** True when the kernel reset the watermark, so the next peak covers one run only. */
  resetPeakRss(): boolean;
  /** Writes to the native `Caption` log tag, which survives a release build. */
  log(message: string): void;
}

export default requireNativeModule<SpikeMetricsModule>('SpikeMetrics');
