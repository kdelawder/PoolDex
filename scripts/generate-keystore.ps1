# Generates the PoolDose release keystore.
# keytool will prompt for passwords. Type them directly into this terminal.
# Do not paste passwords into the Claude Code chat.
# Save the password to your password manager immediately after.

$keytool  = "C:\Program Files\Android\Android Studio\jbr\bin\keytool.exe"
$keystore = "C:\Users\Kevin\Projects\HydroLab\android\app\hydrolab-release.keystore"

if (Test-Path $keystore) {
  Write-Host "Keystore already exists at $keystore - refusing to overwrite." -ForegroundColor Red
  exit 1
}

& $keytool -genkeypair -v `
  -keystore $keystore `
  -alias hydrolab -keyalg RSA -keysize 2048 -validity 10000 `
  -dname "CN=Kevin Delawder, O=PoolDose, L=Unknown, ST=Unknown, C=US"

if (Test-Path $keystore) {
  Write-Host ""
  Write-Host "Keystore created: $keystore" -ForegroundColor Green
  Write-Host "Next: create android/keystore.properties (see chat)." -ForegroundColor Green
}
