' Script for Win32_PhysicalMemory WMI Class
' From http://www.activexperts.com/activmonitor/windowsmanagement/scripts/hardware/memory/

On Error Resume Next

strComputer = "."
Set objWMIService = GetObject("winmgmts:" & "{impersonationLevel=impersonate}!\\" & strComputer & "\root\cimv2")

Set colItems = objWMIService.ExecQuery("Select * from Win32_PhysicalMemory")

For Each objItem in colItems
    Wscript.Echo "---"
    Wscript.Echo "Bank Label: " & objItem.BankLabel
    Wscript.Echo "Capacity: " & objItem.Capacity
    Wscript.Echo "Data Width: " & objItem.DataWidth
    Wscript.Echo "Description: " & objItem.Description
    Wscript.Echo "Device Locator: " & objItem.DeviceLocator
    Wscript.Echo "Form Factor: " & objItem.FormFactor
    Wscript.Echo "Hot Swappable: " & objItem.HotSwappable
    Wscript.Echo "Install Date: " & objItem.InstallDate
    Wscript.Echo "Manufacturer: " & objItem.Manufacturer
    Wscript.Echo "Memory Type: " & objItem.MemoryType
    Wscript.Echo "Name: " & objItem.Name
    Wscript.Echo "Part Number: " & objItem.PartNumber
    Wscript.Echo "Position In Row: " & objItem.PositionInRow
    Wscript.Echo "Serial Number: " & objItem.SerialNumber
    Wscript.Echo "Speed: " & objItem.Speed
    Wscript.Echo "Status: " & objItem.Status
    Wscript.Echo "Tag: " & objItem.Tag
    Wscript.Echo "Type Detail: " & objItem.TypeDetail
    Wscript.Echo "Version: " & objItem.Version
Next