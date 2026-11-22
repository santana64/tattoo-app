# INKR G1 — verify encrypted recovery archives at any local path.
# Does not decrypt, contact Supabase, or prove remote cloud sync.
param([string]$Root = (Join-Path $env:USERPROFILE 'OneDrive\Documents\INKR-Recovery\20261121'))
$ErrorActionPreference = 'Stop'
if (!(Test-Path -LiteralPath $Root -PathType Container)) { throw 'Encrypted backup directory missing' }
$expect = @(
  @{Name='inkr-sql-20261117.inkrbak';Bytes=566207;Sha256='C38D6E3106B8FACEE6585B516C9D906924ABD67DA849CECDC545C42A47AD1889'},
  @{Name='inkr-storage-20261117.inkrbak';Bytes=380608;Sha256='356B2872D1E5A66E93D23BAE1394817A621B0EF36A99BBB35B8AC3AA364A9E14'}
)
foreach($item in $expect) {
  $file=Join-Path $Root $item.Name
  if (!(Test-Path -LiteralPath $file -PathType Leaf)) { throw ('Missing encrypted archive: '+$item.Name) }
  $bytes=(Get-Item -LiteralPath $file).Length
  $sha=(Get-FileHash -LiteralPath $file -Algorithm SHA256).Hash
  if($bytes -ne $item.Bytes -or $sha -ne $item.Sha256) { throw ('Encrypted archive corrupted: '+$item.Name) }
  Write-Output ('INKR_ENCRYPTED_ARCHIVE_INTEGRITY=PASS '+$item.Name+' bytes='+$bytes)
}
Write-Output 'INKR_TWO_ENCRYPTED_RECOVERY_ARCHIVES_SHA256=PASS (local read; cloud readback unverified)'
