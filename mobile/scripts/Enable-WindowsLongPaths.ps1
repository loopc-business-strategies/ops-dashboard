#Requires -RunAsAdministrator
<#
.SYNOPSIS
  Enables Win32 long paths (MAX_PATH > 260) so Android release CMake/Ninja builds can succeed in deep repo paths.

.DESCRIPTION
  Sets registry LongPathsEnabled = 1. Reboot Windows after running, then retry:
    npm run mobile:build:android:local:bundle

  Alternative: clone the repo to a short path (e.g. C:\src\ops-dashboard) without changing system policy.
#>
Set-ItemProperty -Path 'HKLM:\SYSTEM\CurrentControlSet\Control\FileSystem' -Name 'LongPathsEnabled' -Value 1 -Type DWord
Write-Host 'LongPathsEnabled set to 1. Reboot Windows, then run your Gradle bundle again.'
