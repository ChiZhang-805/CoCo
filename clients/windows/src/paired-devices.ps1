$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [Text.UTF8Encoding]::new($false)
Add-Type -AssemblyName System.Runtime.WindowsRuntime
$deviceInfo = [Windows.Devices.Enumeration.DeviceInformation, Windows.Devices.Enumeration, ContentType=WindowsRuntime]
$collection = [Windows.Devices.Enumeration.DeviceInformationCollection, Windows.Devices.Enumeration, ContentType=WindowsRuntime]
$classic = [Windows.Devices.Bluetooth.BluetoothDevice, Windows.Devices.Bluetooth, ContentType=WindowsRuntime]
$lowEnergy = [Windows.Devices.Bluetooth.BluetoothLEDevice, Windows.Devices.Bluetooth, ContentType=WindowsRuntime]
$asTask = [System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {
    $_.Name -eq 'AsTask' -and $_.IsGenericMethod -and $_.GetGenericArguments().Count -eq 1 -and
    $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1'
} | Select-Object -First 1
$devices = @{}
$properties = [string[]]@('System.Devices.Aep.IsConnected', 'System.Devices.Aep.ContainerId')
foreach ($selector in @($classic::GetDeviceSelectorFromPairingState($true), $lowEnergy::GetDeviceSelectorFromPairingState($true))) {
    $operation = $deviceInfo::FindAllAsync($selector, $properties)
    $task = $asTask.MakeGenericMethod($collection).Invoke($null, @($operation))
    $task.Wait()
    foreach ($device in $task.Result) {
        $id = [string]$device.Properties['System.Devices.Aep.ContainerId']
        if (!$id -or $id -eq [Guid]::Empty.ToString()) { $id = $device.Id }
        $connected = [bool]$device.Properties['System.Devices.Aep.IsConnected']
        $devices[$id] = @{ id = $id; name = $device.Name; connected = $connected -or $devices[$id].connected }
    }
}
ConvertTo-Json -InputObject @($devices.Values) -Compress
