import Foundation
import AVFoundation
import AppKit

struct Scene: Decodable { let audio: String; let start: Double; let audioDuration: Double }
struct Timeline: Decodable { let duration: Double; let scenes: [Scene]; let proofStart: Double?; let proofDuration: Double? }

@main struct AssembleDemo {
  static func main() async throws {
    let args = CommandLine.arguments
    guard args.count == 5 else { fatalError("Usage: assemble-demo FRAMES TIMELINE SILENT_MP4 FINAL_MP4") }
    let timeline = try JSONDecoder().decode(Timeline.self, from: Data(contentsOf: URL(fileURLWithPath: args[2])))
    let silent = URL(fileURLWithPath: args[3]), output = URL(fileURLWithPath: args[4])
    let width = 1440, height = 810, fps: Int32 = 25
    let count = Int(ceil(timeline.duration * Double(fps)))
    let writer = try AVAssetWriter(outputURL: silent, fileType: .mp4)
    let input = AVAssetWriterInput(mediaType: .video, outputSettings: [
      AVVideoCodecKey: AVVideoCodecType.h264, AVVideoWidthKey: width, AVVideoHeightKey: height,
      AVVideoCompressionPropertiesKey: [AVVideoAverageBitRateKey: 5_000_000, AVVideoProfileLevelKey: AVVideoProfileLevelH264HighAutoLevel]
    ])
    input.expectsMediaDataInRealTime = false
    let adapter = AVAssetWriterInputPixelBufferAdaptor(assetWriterInput: input, sourcePixelBufferAttributes: [
      kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32ARGB,
      kCVPixelBufferWidthKey as String: width, kCVPixelBufferHeightKey as String: height,
      kCVPixelBufferCGImageCompatibilityKey as String: true, kCVPixelBufferCGBitmapContextCompatibilityKey as String: true
    ])
    writer.add(input)
    guard writer.startWriting() else { throw writer.error! }
    writer.startSession(atSourceTime: .zero)
    for index in 0..<count {
      while !input.isReadyForMoreMediaData {
        if writer.status == .failed { throw writer.error! }
        try await Task.sleep(nanoseconds: 1_000_000)
      }
      try autoreleasepool {
        // The browser's first screencast frames had a viewport-resize artifact.
        // Use a clean capture of the same title and caption for the intro only.
        let proofStart = Int((timeline.proofStart ?? -100) * Double(fps))
        let proofFrames = Int((timeline.proofDuration ?? 0) * Double(fps))
        let inProof = index >= proofStart && index < proofStart + proofFrames
        let sourceIndex = index >= proofStart + proofFrames ? index - proofFrames : index
        let name = inProof ? (index - proofStart < proofFrames / 2 ? "proof-1.png" : "proof-2.png") :
          sourceIndex < 263 ? "intro.png" : String(format: "frame-%05d.png", sourceIndex + 1)
        let url = URL(fileURLWithPath: args[1]).appendingPathComponent(name)
        guard let image = NSImage(contentsOf: url)?.cgImage(forProposedRect: nil, context: nil, hints: nil) else { fatalError("Missing frame \(name)") }
        var pixel: CVPixelBuffer?
        guard CVPixelBufferPoolCreatePixelBuffer(nil, adapter.pixelBufferPool!, &pixel) == kCVReturnSuccess, let pixel else { fatalError("Pixel allocation failed") }
        CVPixelBufferLockBaseAddress(pixel, [])
        let context = CGContext(data: CVPixelBufferGetBaseAddress(pixel), width: width, height: height, bitsPerComponent: 8,
          bytesPerRow: CVPixelBufferGetBytesPerRow(pixel), space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGImageAlphaInfo.noneSkipFirst.rawValue)!
        context.draw(image, in: CGRect(x: 0, y: 0, width: width, height: height))
        CVPixelBufferUnlockBaseAddress(pixel, [])
        guard adapter.append(pixel, withPresentationTime: CMTime(value: Int64(index), timescale: fps)) else { throw writer.error! }
      }
      if index % 500 == 0 { print("Encoded \(index)/\(count)") }
    }
    input.markAsFinished()
    await writer.finishWriting()
    if writer.status != .completed { throw writer.error! }

    let composition = AVMutableComposition(), video = AVURLAsset(url: silent)
    let source = try await video.loadTracks(withMediaType: .video).first!
    let duration = try await video.load(.duration)
    let videoTrack = composition.addMutableTrack(withMediaType: .video, preferredTrackID: kCMPersistentTrackID_Invalid)!
    try videoTrack.insertTimeRange(CMTimeRange(start: .zero, duration: duration), of: source, at: .zero)
    let audioTrack = composition.addMutableTrack(withMediaType: .audio, preferredTrackID: kCMPersistentTrackID_Invalid)!
    for scene in timeline.scenes {
      let audio = AVURLAsset(url: URL(fileURLWithPath: scene.audio))
      let track = try await audio.loadTracks(withMediaType: .audio).first!
      let length = try await audio.load(.duration)
      try audioTrack.insertTimeRange(CMTimeRange(start: .zero, duration: length), of: track,
        at: CMTime(seconds: scene.start, preferredTimescale: 60000))
    }
    let exporter = AVAssetExportSession(asset: composition, presetName: AVAssetExportPresetHighestQuality)!
    exporter.shouldOptimizeForNetworkUse = true
    try await exporter.export(to: output, as: .mp4)
    print("Saved \(output.path), \(duration.seconds) seconds, H.264 video plus narration")
  }
}
