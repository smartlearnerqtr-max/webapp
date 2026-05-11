#Requires AutoHotkey v2.0
SetTitleMatchMode 2
CoordMode "Mouse", "Screen"
if WinExist("Cisco Packet Tracer") {
  WinActivate "Cisco Packet Tracer"
  Sleep 400
  WinGetPos &x, &y, &w, &h, "Cisco Packet Tracer"
  MouseMove x + Round(w * 0.29), y + Round(h * 0.36), 0
  Click 2
  Sleep 1200
}
