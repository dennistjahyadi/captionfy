import AVFoundation
import ExpoModulesCore

private let targetSampleRate = 16_000

internal struct ExtractedAudio: Record {
  @Field var path: String = ""
  @Field var sampleRate: Int = 0
  @Field var channelCount: Int = 0
  @Field var sampleCount: Int = 0
  @Field var durationMs: Double = 0
  @Field var sourceSampleRate: Int = 0
  @Field var sourceChannelCount: Int = 0
  @Field var byteLength: Double = 0
}

internal final class NoAudioTrackException: Exception {
  override var reason: String { "The selected file has no audio track" }
}

internal final class DecodeFailedException: GenericException<String> {
  override var reason: String { "Failed to decode the audio track: \(param)" }
}

public class AudioExtractModule: Module {
  public func definition() -> ModuleDefinition {
    Name("AudioExtract")

    // AsyncFunction runs off the JS thread, so a 60 second clip never stalls the UI.
    AsyncFunction("extractPcm16") { (sourceUri: String, destinationPath: String) -> ExtractedAudio in
      try extractPcm16(sourceUri: sourceUri, destinationPath: destinationPath)
    }
  }
}

/// Decodes the first audio track of a media file to 16 kHz mono signed 16-bit PCM.
///
/// `AVAssetReaderTrackOutput` is asked for the target format directly, so the
/// downmix and the sample rate conversion both happen inside Core Audio's
/// converter rather than in hand-written DSP. Android reaches the same 16 kHz mono
/// s16le bytes by a different route, which keeps one audio path for every engine.
private func extractPcm16(sourceUri: String, destinationPath: String) throws -> ExtractedAudio {
  guard let url = URL(string: sourceUri) else {
    throw DecodeFailedException("not a valid URL: \(sourceUri)")
  }

  let asset = AVURLAsset(url: url)
  guard let track = asset.tracks(withMediaType: .audio).first else {
    throw NoAudioTrackException()
  }

  var sourceSampleRate = 0
  var sourceChannelCount = 0
  if let description = track.formatDescriptions.first {
    // swiftlint:disable:next force_cast
    let formatDescription = description as! CMAudioFormatDescription
    if let basic = CMAudioFormatDescriptionGetStreamBasicDescription(formatDescription)?.pointee {
      sourceSampleRate = Int(basic.mSampleRate)
      sourceChannelCount = Int(basic.mChannelsPerFrame)
    }
  }

  var monoLayout = AudioChannelLayout()
  monoLayout.mChannelLayoutTag = kAudioChannelLayoutTag_Mono
  let layoutData = Data(bytes: &monoLayout, count: MemoryLayout<AudioChannelLayout>.size)

  let outputSettings: [String: Any] = [
    AVFormatIDKey: kAudioFormatLinearPCM,
    AVSampleRateKey: targetSampleRate,
    AVNumberOfChannelsKey: 1,
    AVChannelLayoutKey: layoutData,
    AVLinearPCMBitDepthKey: 16,
    AVLinearPCMIsFloatKey: false,
    AVLinearPCMIsBigEndianKey: false,
    AVLinearPCMIsNonInterleaved: false,
  ]

  let reader: AVAssetReader
  do {
    reader = try AVAssetReader(asset: asset)
  } catch {
    throw DecodeFailedException(error.localizedDescription)
  }

  let output = AVAssetReaderTrackOutput(track: track, outputSettings: outputSettings)
  output.alwaysCopiesSampleData = false
  guard reader.canAdd(output) else {
    throw DecodeFailedException("reader rejected a 16 kHz mono PCM output")
  }
  reader.add(output)

  let destinationURL = URL(fileURLWithPath: destinationPath)
  try FileManager.default.createDirectory(
    at: destinationURL.deletingLastPathComponent(),
    withIntermediateDirectories: true
  )
  FileManager.default.createFile(atPath: destinationPath, contents: nil)

  guard let handle = FileHandle(forWritingAtPath: destinationPath) else {
    throw DecodeFailedException("cannot write to \(destinationPath)")
  }
  defer { try? handle.close() }

  guard reader.startReading() else {
    throw DecodeFailedException(reader.error?.localizedDescription ?? "reader refused to start")
  }

  var byteLength = 0
  while let sampleBuffer = output.copyNextSampleBuffer() {
    guard let blockBuffer = CMSampleBufferGetDataBuffer(sampleBuffer) else { continue }
    let length = CMBlockBufferGetDataLength(blockBuffer)
    if length > 0 {
      var bytes = Data(count: length)
      let status = bytes.withUnsafeMutableBytes { pointer -> OSStatus in
        guard let base = pointer.baseAddress else { return kCMBlockBufferBadPointerParameterErr }
        return CMBlockBufferCopyDataBytes(blockBuffer, atOffset: 0, dataLength: length, destination: base)
      }
      if status != kCMBlockBufferNoErr {
        throw DecodeFailedException("CMBlockBufferCopyDataBytes failed with \(status)")
      }
      handle.write(bytes)
      byteLength += length
    }
  }

  if reader.status == .failed {
    throw DecodeFailedException(reader.error?.localizedDescription ?? "unknown reader failure")
  }

  let sampleCount = byteLength / 2
  var result = ExtractedAudio()
  result.path = destinationPath
  result.sampleRate = targetSampleRate
  result.channelCount = 1
  result.sampleCount = sampleCount
  result.durationMs = Double(sampleCount) * 1000.0 / Double(targetSampleRate)
  result.sourceSampleRate = sourceSampleRate
  result.sourceChannelCount = sourceChannelCount
  result.byteLength = Double(byteLength)
  return result
}
