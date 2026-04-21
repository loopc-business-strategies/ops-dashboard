$encoding = [System.Text.UTF8Encoding]($false)
$files = @(
  'frontend/src/components/tabs/HRTab.jsx',
  'frontend/src/components/tabs/OverviewTab.jsx',
  'frontend/src/components/tabs/PlaceholderTab.jsx',
  'frontend/src/components/tabs/ProductionTab.jsx'
)

$replacements = @{
  'text-gray-400' = 'text-gray-300'
  'text-gray-500' = 'text-gray-300'
  'text-gray-600' = 'text-gray-300'
  '#9ca3af'       = '#d1d5db'
  '#6b7280'       = '#4b5563'
  '#8b8fa8'       = '#6b7280'
  '#13AA52'       = '#00684A'
  '#ff7043'       = '#9a3412'
  '#00c896'       = '#065f46'
}

"Starting replacements..."
foreach ($file in $files) {
  if (Test-Path $file) {
    "Processing $file..."
    $content = [System.IO.File]::ReadAllText($file, $encoding)
    $modified = $false
    
    foreach ($old in $replacements.Keys) {
      $new = $replacements[$old]
      $regex = [regex]::Escape($old)
      $matches = [regex]::Matches($content, $regex)
      $oldCount = $matches.Count
      if ($oldCount -gt 0) {
        $content = $content -replace $regex, $new
        $modified = $true
        "Repl: $old -> $new ($oldCount)"
      }
    }
    
    if ($modified) {
      [System.IO.File]::WriteAllText($file, $content, $encoding)
      "Written $file"
    } else {
      "No changes for $file"
    }
  } else {
    "Not found: $file"
  }
}
"Done."
