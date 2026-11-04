import Foundation
import CoreGraphics
import ImageIO

func checkApprovedImagePolicy() throws {
    let files = FileManager.default
    let root = files.temporaryDirectory.appendingPathComponent("sgm-approved-capture-check-" + UUID().uuidString, isDirectory: true)
    try files.createDirectory(at: root, withIntermediateDirectories: false)
    defer { try? files.removeItem(at: root) }
    func fill(solid: Bool = false, width: Int = 320) throws {
        for name in approvedCaptureNames {
            let context = CGContext(data: nil, width: width, height: 600, bitsPerComponent: 8, bytesPerRow: width * 4,
                space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)!
            context.setFillColor(CGColor(gray: 1, alpha: 1)); context.fill(CGRect(x: 0, y: 0, width: width, height: 600))
            if !solid {
                for color in 0..<16 {
                    context.setFillColor(CGColor(red: CGFloat(color) / 16, green: CGFloat(15 - color) / 16, blue: 0.4, alpha: 1))
                    context.fill(CGRect(x: color * 20, y: 0, width: 20, height: 600))
                }
            }
            let destination = CGImageDestinationCreateWithURL(root.appendingPathComponent(name) as CFURL, "public.png" as CFString, 1, nil)!
            CGImageDestinationAddImage(destination, context.makeImage()!, nil)
            precondition(CGImageDestinationFinalize(destination))
        }
    }
    func reject(_ label: String) {
        do { _ = try validateApprovedImages(root); preconditionFailure("Accepted invalid image policy: " + label) }
        catch { }
    }
    try fill()
    let accepted = try validateApprovedImages(root)
    precondition(accepted.count == 3)
    let first = root.appendingPathComponent(approvedCaptureNames[0])
    try files.removeItem(at: first); reject("missing")
    try fill()
    let extra = root.appendingPathComponent("unexpected.png"); try Data([0]).write(to: extra); reject("extra")
    try files.removeItem(at: extra)
    try Data([0, 1, 2]).write(to: first); reject("corrupt")
    try fill(solid: true); reject("blank")
    try fill(width: 100); reject("small")
    try fill(); try files.removeItem(at: first)
    try files.createSymbolicLink(at: first, withDestinationURL: root.appendingPathComponent(approvedCaptureNames[1])); reject("symlink")
    try files.removeItem(at: first); try fill()
    try Data(repeating: 0, count: 2_000_001).write(to: first); reject("budget")
    print("Approved capture policy passed: exactly three PNGs, nonblank pixels, dimensions, missing/extra/corrupt/symlink rejection and byte budget; generated fixtures only")
}
