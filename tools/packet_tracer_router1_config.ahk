#Requires AutoHotkey v2.0
#SingleInstance Force

; Focus the right place in Packet Tracer, then use these hotkeys:
; F8  -> type Router1 config in the CLI
; F9  -> run router verification commands in the CLI
; F10 -> fill PC0 IP settings (click IPv4 Address field first)
; F11 -> fill PC1 IP settings (click IPv4 Address field first)
; F12 -> fill PC2 IP settings (click IPv4 Address field first)
; F5  -> best-effort open PC0 command prompt and run the 2 ping tests
; F6  -> run ping tests from a left-side PC command prompt
; F7  -> run ping tests from the right-side PC command prompt
; Esc -> exit the script

SetTitleMatchMode 2

packetTracerTitle := "Cisco Packet Tracer"

routerConfig := [
    "enable",
    "configure terminal",
    "hostname R1",
    "ipv6 unicast-routing",
    "interface g0/0/0",
    "no shutdown",
    "ip address 192.168.1.1 255.255.255.0",
    "ipv6 address 2001::1/64",
    "exit",
    "interface g0/0/1",
    "no shutdown",
    "ip address 10.0.0.1 255.0.0.0",
    "ipv6 address 2002::1/64",
    "end",
    "write memory"
]

verifyCommands := [
    "show ip interface brief",
    "show ipv6 interface brief"
]

pc0Config := [
    "192.168.1.2",
    "255.255.255.0",
    "192.168.1.1",
    "2001::2",
    "64",
    "2001::1"
]

pc1Config := [
    "192.168.1.3",
    "255.255.255.0",
    "192.168.1.1",
    "2001::3",
    "64",
    "2001::1"
]

pc2Config := [
    "10.0.0.4",
    "255.0.0.0",
    "10.0.0.1",
    "2002::4",
    "64",
    "2002::1"
]

leftPcPingCommands := [
    "ping 10.0.0.4",
    "ping 2002::4"
]

rightPcPingCommands := [
    "ping 192.168.1.2",
    "ping 2001::2"
]

F5::RunPc0PingDemo(packetTracerTitle, leftPcPingCommands)
F8::SendCommandList(packetTracerTitle, routerConfig)
F9::SendCommandList(packetTracerTitle, verifyCommands)
F10::FillPcIpConfig(packetTracerTitle, "PC0", pc0Config)
F11::FillPcIpConfig(packetTracerTitle, "PC1", pc1Config)
F12::FillPcIpConfig(packetTracerTitle, "PC2", pc2Config)
F6::SendCommandList(packetTracerTitle, leftPcPingCommands, "Dat con tro vao Command Prompt cua PC ben trai, sau do bam OK.")
F7::SendCommandList(packetTracerTitle, rightPcPingCommands, "Dat con tro vao Command Prompt cua PC2, sau do bam OK.")
Esc::ExitApp()

SendCommandList(windowTitle, commands, promptText := "") {
    if !WinExist(windowTitle) {
        MsgBox "Khong tim thay cua so Cisco Packet Tracer.", "Packet Tracer"
        return
    }

    WinActivate windowTitle
    WinWaitActive windowTitle, , 2

    if (promptText = "") {
        promptText := "Dat con tro vao o CLI cua router trong Packet Tracer, sau do bam OK. Script se gui " commands.Length " dong lenh."
    }

    result := MsgBox(
        promptText,
        "Packet Tracer",
        "OKCancel Iconi"
    )

    if (result != "OK") {
        return
    }

    Sleep 300

    for command in commands {
        SendText command
        Send "{Enter}"
        Sleep 180
    }
}

FillPcIpConfig(windowTitle, pcName, fields) {
    if !WinExist(windowTitle) {
        MsgBox "Khong tim thay cua so Cisco Packet Tracer.", "Packet Tracer"
        return
    }

    WinActivate windowTitle
    WinWaitActive windowTitle, , 2

    result := MsgBox(
        "Mo " pcName " > Desktop > IP Configuration, chon Static neu can, click vao o IPv4 Address, roi bam OK.",
        "Packet Tracer",
        "OKCancel Iconi"
    )

    if (result != "OK") {
        return
    }

    Sleep 300

    for index, field in fields {
        SendText field
        if (index < fields.Length) {
            Send "{Tab}"
            Sleep 150
        }
    }
}

RunPc0PingDemo(windowTitle, commands) {
    if !WinExist(windowTitle) {
        MsgBox "Khong tim thay cua so Cisco Packet Tracer.", "Packet Tracer"
        return
    }

    WinActivate windowTitle
    WinWaitActive windowTitle, , 2
    WinGetPos &x, &y, &w, &h, windowTitle

    ; These ratios match the current Packet Tracer layout the user shared.
    pc0X := x + Round(w * 0.30)
    pc0Y := y + Round(h * 0.42)

    MouseMove pc0X, pc0Y, 0
    Click 2
    Sleep 900

    if !WinExist("PC0") {
        MsgBox "Khong mo duoc cua so PC0. Hay mo PC0 bang tay mot lan roi chay lai.", "Packet Tracer"
        return
    }

    WinActivate "PC0"
    WinWaitActive "PC0", , 2
    WinGetPos &px, &py, &pw, &ph, "PC0"

    ; Open Desktop tab.
    MouseMove px + Round(pw * 0.24), py + Round(ph * 0.07), 0
    Click
    Sleep 250

    ; Open Command Prompt.
    MouseMove px + Round(pw * 0.11), py + Round(ph * 0.20), 0
    Click
    Sleep 600

    for command in commands {
        SendText command
        Send "{Enter}"
        Sleep 6000
    }
}
