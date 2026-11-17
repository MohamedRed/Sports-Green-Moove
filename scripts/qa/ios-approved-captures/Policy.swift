import Foundation
import CoreGraphics
import ImageIO
import CryptoKit

let approvedCaptureNames = ["home.png", "profile.png", "rating-sent.png"]
let approvedImageBudget = 1_900_000

struct ApprovedImage: Codable, Equatable {
    let file: String
    let bytes: Int
    let width: Int
    let height: Int
    let sha256: String
}

enum ApprovedCaptureFailure: Error { case invalidDirectory, invalidFiles, overBudget, invalidImage, blankImage, mixedDimensions, invalidRun }

func captureHash(_ data: Data) -> String { SHA256.hash(data: data).map { String(format: "%02x", $0) }.joined() }

func validateApprovedImages(_ folder: URL) throws -> [ApprovedImage] {
    let directory = try folder.resourceValues(forKeys: [.isDirectoryKey, .isSymbolicLinkKey])
    guard directory.isDirectory == true, directory.isSymbolicLink != true else { throw ApprovedCaptureFailure.invalidDirectory }
    let files = try FileManager.default.contentsOfDirectory(at: folder,
        includingPropertiesForKeys: [.isRegularFileKey, .isSymbolicLinkKey, .fileSizeKey])
    guard files.map(\.lastPathComponent).sorted() == approvedCaptureNames else { throw ApprovedCaptureFailure.invalidFiles }
    var records: [ApprovedImage] = []
    var total = 0
    for name in approvedCaptureNames {
        let url = folder.appendingPathComponent(name)
        let info = try url.resourceValues(forKeys: [.isRegularFileKey, .isSymbolicLinkKey, .fileSizeKey])
        guard info.isRegularFile == true, info.isSymbolicLink != true, let size = info.fileSize, size > 0 else {
            throw ApprovedCaptureFailure.invalidFiles
        }
        total += size
        guard total <= approvedImageBudget else { throw ApprovedCaptureFailure.overBudget }
        let data = try Data(contentsOf: url)
        guard data.count == size, let source = CGImageSourceCreateWithData(data as CFData, nil),
              CGImageSourceGetType(source) as String? == "public.png", CGImageSourceGetCount(source) == 1,
              let image = CGImageSourceCreateImageAtIndex(source, 0, nil),
              image.width >= 320, image.height >= 480, image.width <= 4096, image.height <= 4096 else {
            throw ApprovedCaptureFailure.invalidImage
        }
        guard imageHasContent(image) else { throw ApprovedCaptureFailure.blankImage }
        if let first = records.first, (first.width != image.width || first.height != image.height) {
            throw ApprovedCaptureFailure.mixedDimensions
        }
        records.append(ApprovedImage(file: name, bytes: size, width: image.width, height: image.height, sha256: captureHash(data)))
    }
    return records
}

private func imageHasContent(_ image: CGImage) -> Bool {
    var pixels = [UInt8](repeating: 0, count: image.width * image.height * 4)
    return pixels.withUnsafeMutableBytes { buffer in
        guard let context = CGContext(data: buffer.baseAddress, width: image.width, height: image.height,
            bitsPerComponent: 8, bytesPerRow: image.width * 4, space: CGColorSpaceCreateDeviceRGB(),
            bitmapInfo: CGBitmapInfo.byteOrder32Big.rawValue | CGImageAlphaInfo.premultipliedLast.rawValue) else { return false }
        context.draw(image, in: CGRect(x: 0, y: 0, width: image.width, height: image.height))
        let data = buffer.bindMemory(to: UInt8.self)
        var colors = Set<UInt16>()
        var low = 255; var high = 0
        for index in stride(from: 0, to: data.count, by: 4 * max(1, image.width * image.height / 20_000)) {
            let r = Int(data[index]); let g = Int(data[index + 1]); let b = Int(data[index + 2])
            colors.insert(UInt16((r >> 4) << 8 | (g >> 4) << 4 | b >> 4))
            low = min(low, r, g, b); high = max(high, r, g, b)
        }
        return colors.count >= 8 && high - low >= 32
    }
}
