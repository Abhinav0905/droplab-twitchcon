import Foundation
import AVFoundation
import AppKit

let args = CommandLine.arguments
guard args.count >= 4 else { fatalError("Usage: review_video.swift INPUT OUTPUT_DIR INTERVAL [START] [END]") }
let input = URL(fileURLWithPath: args[1])
let output = URL(fileURLWithPath: args[2], isDirectory: true)
let interval = Double(args[3])!
try FileManager.default.createDirectory(at: output, withIntermediateDirectories: true)
let asset = AVURLAsset(url: input)
let duration = CMTimeGetSeconds(asset.duration)
let track = asset.tracks(withMediaType: .video).first!
let transformed = track.naturalSize.applying(track.preferredTransform)
let generator = AVAssetImageGenerator(asset: asset)
generator.appliesPreferredTrackTransform = true
generator.maximumSize = CGSize(width: 1080, height: 1920)
generator.requestedTimeToleranceBefore = .zero
generator.requestedTimeToleranceAfter = .zero
let start = args.count > 4 ? Double(args[4])! : 0
let end = args.count > 5 ? min(Double(args[5])!, duration) : duration
var frames: [[String: Any]] = []
var index = 0
for seconds in stride(from: start, to: end, by: interval) {
    var actual = CMTime.zero
    do {
        let cgImage = try generator.copyCGImage(at: CMTime(seconds: seconds, preferredTimescale: 60000), actualTime: &actual)
        let bitmap = NSBitmapImageRep(cgImage: cgImage)
        let data = bitmap.representation(using: .jpeg, properties: [.compressionFactor: 0.92])!
        let filename = String(format: "frame-%04d.jpg", index)
        try data.write(to: output.appendingPathComponent(filename))
        frames.append(["file": filename, "requested": seconds, "actual": CMTimeGetSeconds(actual)])
    } catch {
        frames.append(["requested": seconds, "error": error.localizedDescription])
    }
    index += 1
}
let metadata: [String: Any] = ["input": input.path, "duration": duration, "fps": track.nominalFrameRate,
    "width": abs(transformed.width), "height": abs(transformed.height), "frames": frames]
let json = try JSONSerialization.data(withJSONObject: metadata, options: [.prettyPrinted, .sortedKeys])
try json.write(to: output.appendingPathComponent("metadata.json"))
print(String(data: json, encoding: .utf8)!)
