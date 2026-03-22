# Emergency QR System Integration Test

$base = "http://localhost:3001/api/v1"
$email = "emergtest_$(Get-Random)@test.com"
$pass = "TestPass123!"

Write-Host "`n=== STEP 1: Register patient ==="
$regBody = '{"email":"' + $email + '","password":"' + $pass + '","firstName":"TestEmerg"}'
try {
    $reg = Invoke-RestMethod -Uri "$base/auth/register" -Method POST -Body $regBody -ContentType "application/json"
    Write-Host "OK Registered: $($reg.id)"
} catch {
    Write-Host "FAIL Register failed: $($_.Exception.Message)"
    exit 1
}

Write-Host "`n=== STEP 2: Login ==="
$loginBody = '{"email":"' + $email + '","password":"' + $pass + '"}'
$login = Invoke-RestMethod -Uri "$base/auth/login" -Method POST -Body $loginBody -ContentType "application/json"
$token = $login.accessToken
Write-Host "OK Token received"

Write-Host "`n=== STEP 3: Get patient profile ID ==="
$headers = @{ Authorization = "Bearer $token" }
$meResponse = Invoke-RestMethod -Uri "$base/auth/me" -Method GET -Headers $headers
$meUserId = $meResponse.id
Write-Host "   User ID: $meUserId"

$profileQuery = docker exec medicore-postgres psql -U medicore -d medicore -t -A -c "SELECT id FROM patient_profiles WHERE user_id = '$meUserId'"
$profileId = "$profileQuery".Trim()
Write-Host "   Profile ID: $profileId"

if (-not $profileId -or $profileId -eq "") {
    Write-Host "FAIL No patient profile found"
    exit 1
}

Write-Host "`n=== STEP 4: Add allergy ==="
$allergyBody = '{"allergen":"Penicillin","severity":"severe","reaction_description":"Anaphylaxis"}'
$allergy = Invoke-RestMethod -Uri "$base/patients/$profileId/allergies" -Method POST -Body $allergyBody -ContentType "application/json" -Headers $headers
Write-Host "OK Allergy created: $($allergy.allergen)"

Write-Host "`n=== STEP 5: Add medication ==="
$medBody = '{"drug_name":"Metformin","dosage":"500mg","frequency":"twice daily","is_active":true}'
$med = Invoke-RestMethod -Uri "$base/patients/$profileId/medications" -Method POST -Body $medBody -ContentType "application/json" -Headers $headers
Write-Host "OK Medication created: $($med.drug_name)"

Write-Host "`n=== STEP 6: Refresh emergency snapshot ==="
$refresh = Invoke-RestMethod -Uri "$base/patients/$profileId/emergency/refresh" -Method POST -Headers $headers -ContentType "application/json"
Write-Host "OK Snapshot refreshed"
Write-Host "   Generated at: $($refresh.generatedAt)"
$emergToken = $refresh.token

Write-Host "`n=== STEP 7: Verify snapshot file exists ==="
$snapshotPath = "c:\Users\Priyanshu\OneDrive\Desktop\medicore\apps\frontend\public\emergency\" + $emergToken + ".json"
if (Test-Path $snapshotPath) {
    $snapshot = Get-Content $snapshotPath | ConvertFrom-Json
    Write-Host "OK Snapshot file exists!"
    Write-Host "   Patient name: $($snapshot.patientName)"
    Write-Host "   Blood group: $($snapshot.bloodGroup)"
    Write-Host "   Allergies count: $($snapshot.allergies.Count)"
    Write-Host "   Medications count: $($snapshot.activeMedications.Count)"
    Write-Host "   Warning: $($snapshot.warningMessage)"
    $firstGeneratedAt = $snapshot.generatedAt
} else {
    Write-Host "FAIL Snapshot file NOT found at: $snapshotPath"
    exit 1
}

Write-Host "`n=== STEP 8: Get QR code ==="
try {
    $qrResponse = Invoke-WebRequest -Uri "$base/patients/$profileId/emergency/qr" -Method GET -Headers $headers -UseBasicParsing
    $size = $qrResponse.RawContentLength
    Write-Host "OK QR code received: Size=$size bytes"
} catch {
    Write-Host "FAIL QR code failed: $($_.Exception.Message)"
}

Write-Host "`n=== STEP 9: Log access (public endpoint) ==="
$logBody = '{"userAgent":"TestBrowser/1.0"}'
try {
    $logResult = Invoke-RestMethod -Uri "$base/emergency/$emergToken/log" -Method POST -Body $logBody -ContentType "application/json"
    Write-Host "OK Access logged: $($logResult.message)"
} catch {
    Write-Host "FAIL Access log failed: $($_.Exception.Message)"
}

Write-Host "`n=== STEP 10: Auto-refresh test ==="
$allergy2Body = '{"allergen":"Aspirin","severity":"moderate","reaction_description":"Rash"}'
$allergy2 = Invoke-RestMethod -Uri "$base/patients/$profileId/allergies" -Method POST -Body $allergy2Body -ContentType "application/json" -Headers $headers
Write-Host "OK Second allergy added: $($allergy2.allergen)"
Write-Host "   Waiting 3 seconds for auto-refresh..."
Start-Sleep -Seconds 3

$snapshot2 = Get-Content $snapshotPath | ConvertFrom-Json
if ($snapshot2.generatedAt -ne $firstGeneratedAt) {
    Write-Host "OK AUTO-REFRESH WORKS! Snapshot updated"
    Write-Host "   Old: $firstGeneratedAt"
    Write-Host "   New: $($snapshot2.generatedAt)"
    Write-Host "   Allergies count now: $($snapshot2.allergies.Count)"
} else {
    Write-Host "FAIL Auto-refresh did not update generatedAt"
}

Write-Host "`n=== STEP 11: Verify audit log ==="
$auditQuery = docker exec medicore-postgres psql -U medicore -d medicore -t -A -c "SELECT event_type FROM audit_log WHERE event_type = 'EMERGENCY_QR_SCAN' ORDER BY created_at DESC LIMIT 1"
if ("$auditQuery" -match "EMERGENCY_QR_SCAN") {
    Write-Host "OK Audit log contains EMERGENCY_QR_SCAN entry"
} else {
    Write-Host "FAIL No EMERGENCY_QR_SCAN in audit log"
}

Write-Host "`n=========================================="
Write-Host "  ALL TESTS COMPLETE"
Write-Host "=========================================="
