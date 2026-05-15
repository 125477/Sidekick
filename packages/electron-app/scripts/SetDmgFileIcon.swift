import AppKit

guard CommandLine.arguments.count >= 3 else {
  fputs("usage: SetDmgFileIcon.swift <icon.png|icns> <file.dmg>\n", stderr)
  exit(1)
}

let iconPath = CommandLine.arguments[1]
let dmgPath = CommandLine.arguments[2]

guard let img = NSImage(contentsOfFile: iconPath) else {
  fputs("failed to load icon: \(iconPath)\n", stderr)
  exit(2)
}

let ok = NSWorkspace.shared.setIcon(img, forFile: dmgPath, options: [])
if !ok {
  fputs("NSWorkspace.setIcon returned false for \(dmgPath)\n", stderr)
  exit(3)
}
