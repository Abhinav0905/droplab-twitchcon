import Foundation
import AVFoundation
@main struct TrimVideo {
  static func main() async throws {
    let args=CommandLine.arguments
    guard args.count == 5 else {fatalError("Usage: trim-video INPUT OUTPUT START END")}
    let asset=AVURLAsset(url:URL(fileURLWithPath:args[1]))
    let tracks=try await asset.loadTracks(withMediaType:.video)
    guard let track=tracks.first else {fatalError("No video track")}
    let composition=AVMutableComposition()
    let out=composition.addMutableTrack(withMediaType:.video,preferredTrackID:kCMPersistentTrackID_Invalid)!
    let start=Double(args[3])!,end=Double(args[4])!
    let range=CMTimeRange(start:CMTime(seconds:start,preferredTimescale:600),duration:CMTime(seconds:end-start,preferredTimescale:600))
    try out.insertTimeRange(range,of:track,at:.zero)
    out.preferredTransform=try await track.load(.preferredTransform)
    guard let exporter=AVAssetExportSession(asset:composition,presetName:AVAssetExportPresetHighestQuality) else {fatalError("Export unavailable")}
    exporter.shouldOptimizeForNetworkUse=true
    try await exporter.export(to:URL(fileURLWithPath:args[2]),as:.mp4)
    print("Saved video-only replay: \(args[2])")
  }
}
