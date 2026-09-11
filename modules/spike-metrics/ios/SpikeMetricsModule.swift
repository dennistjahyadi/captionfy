import ExpoModulesCore
import Foundation
import UIKit

internal struct DeviceProfile: Record {
  @Field var label: String = ""
  @Field var model: String = ""
  @Field var soc: String = ""
  @Field var osVersion: String = ""
  @Field var abi: String = ""
  @Field var cpuCores: Int = 0
  @Field var totalRamMb: Int = 0
}

internal struct SourceInfo: Record {
  @Field var name: String = ""
  @Field var sizeBytes: Double = 0
  @Field var readable: Bool = false
}

/// Throwaway Phase 0 instrumentation. Delete this module together with `spike/`
/// once the Stage 0 accuracy question is answered.
public class SpikeMetricsModule: Module {
  public func definition() -> ModuleDefinition {
    Name("SpikeMetrics")

    Function("getDeviceProfile") { () -> DeviceProfile in
      let identifier = machineIdentifier()
      var profile = DeviceProfile()
      profile.model = identifier
      profile.soc = identifier
      profile.osVersion = "iOS \(UIDevice.current.systemVersion)"
      profile.abi = "arm64"
      profile.cpuCores = ProcessInfo.processInfo.processorCount
      profile.totalRamMb = Int(ProcessInfo.processInfo.physicalMemory / (1024 * 1024))
      profile.label = "\(identifier) / arm64"
      return profile
    }

    /// iOS has no VmHWM equivalent, so this reports the current phys_footprint and
    /// the caller keeps its own running maximum.
    Function("getPeakRssBytes") { () -> Double in
      Double(physFootprintBytes())
    }

    Function("getCurrentRssBytes") { () -> Double in
      Double(physFootprintBytes())
    }

    /// Nothing to reset on iOS. Returning false tells the rig to treat the numbers
    /// as sampled rather than as a kernel-maintained watermark.
    Function("resetPeakRss") { () -> Bool in
      false
    }

    /// Name and size behind a picked URI, plus whether it can still be opened.
    ///
    /// The picker hands back a copy in a temporary directory whose last path
    /// component is already the real filename, so unlike Android there is no
    /// provider to ask. `readable` matters all the same: a remembered clip in a
    /// temporary directory may have been swept away between runs.
    AsyncFunction("describeSource") { (uri: String) -> SourceInfo in
      var info = SourceInfo()
      guard let url = URL(string: uri) else { return info }

      info.name = url.lastPathComponent.removingPercentEncoding ?? url.lastPathComponent
      guard url.isFileURL else { return info }

      let attributes = try? FileManager.default.attributesOfItem(atPath: url.path)
      info.sizeBytes = Double((attributes?[.size] as? NSNumber)?.int64Value ?? 0)
      info.readable = FileManager.default.isReadableFile(atPath: url.path)
      return info
    }

    /// Mirrors the Android `Caption` logcat tag so a release build can be read from
    /// the device console, where JS `console.log` is not dependable.
    Function("log") { (message: String) in
      NSLog("Caption: %@", message)
    }
  }
}

private func machineIdentifier() -> String {
  var systemInfo = utsname()
  uname(&systemInfo)
  let mirror = Mirror(reflecting: systemInfo.machine)
  return mirror.children.reduce(into: "") { identifier, element in
    guard let value = element.value as? Int8, value != 0 else { return }
    identifier += String(UnicodeScalar(UInt8(value)))
  }
}

private func physFootprintBytes() -> UInt64 {
  var info = task_vm_info_data_t()
  var count = mach_msg_type_number_t(MemoryLayout<task_vm_info_data_t>.size / MemoryLayout<natural_t>.size)
  let result = withUnsafeMutablePointer(to: &info) {
    $0.withMemoryRebound(to: integer_t.self, capacity: Int(count)) {
      task_info(mach_task_self_, task_flavor_t(TASK_VM_INFO), $0, &count)
    }
  }
  return result == KERN_SUCCESS ? info.phys_footprint : 0
}
