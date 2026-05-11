#Requires AutoHotkey v2.0
SetTitleMatchMode 2
CoordMode "Mouse", "Screen"
if WinExist("PC0") {
  WinActivate "PC0"
  Sleep 300
  WinGetPos &x, &y, &w, &h, "PC0"
  Click x + Round(w * 0.22), y + Round(h * 0.07)
}
