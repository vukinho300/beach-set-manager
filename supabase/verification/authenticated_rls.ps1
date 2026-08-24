[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$ProjectName = 'Beach Set Manager'
$ProjectRef = 'uonovdnxfjqfjkhopxwg'
$KnoProjectRef = 'asrrkwyqerfkynhjypov'
$LocationId = '00000000-0000-4000-8000-000000000001'
$ApiBaseUrl = "https://$ProjectRef.supabase.co"
$ExpectedUserIds = [ordered]@{
  Vuk = 'b5771919-8ee9-49d5-b7f5-8e634ee1dcbf'
  Vito = '1723bcb9-6013-4aa7-821a-745859b3af87'
  Mark = 'e839a9e4-f86b-47d5-adaa-83779c4cd50f'
}

function Assert-Condition {
  param(
    [Parameter(Mandatory = $true)][bool]$Condition,
    [Parameter(Mandatory = $true)][string]$Message
  )

  if (-not $Condition) {
    throw $Message
  }
}

function Get-HttpStatusCode {
  param([Parameter(Mandatory = $true)]$ErrorRecord)

  try {
    return [int]$ErrorRecord.Exception.Response.StatusCode
  }
  catch {
    return $null
  }
}

function Invoke-ExpectedDenial {
  param(
    [Parameter(Mandatory = $true)][string]$Name,
    [Parameter(Mandatory = $true)][scriptblock]$Action
  )

  try {
    $null = & $Action
  }
  catch {
    return [ordered]@{
      name = $Name
      denied = $true
      httpStatus = Get-HttpStatusCode -ErrorRecord $_
    }
  }

  throw "Expected '$Name' to be denied, but it succeeded."
}

function Invoke-DataApi {
  param(
    [Parameter(Mandatory = $true)][ValidateSet('GET', 'POST', 'PATCH', 'DELETE')][string]$Method,
    [Parameter(Mandatory = $true)][string]$Path,
    [Parameter(Mandatory = $true)][string]$AccessToken,
    $Body,
    [string]$Prefer
  )

  $headers = @{
    apikey = $script:PublishableKey
    Authorization = "Bearer $AccessToken"
  }

  if ($Prefer) {
    $headers.Prefer = $Prefer
  }

  $request = @{
    Uri = "$ApiBaseUrl/rest/v1/$Path"
    Method = $Method
    Headers = $headers
    ContentType = 'application/json'
  }

  if ($null -ne $Body) {
    $request.Body = $Body | ConvertTo-Json -Depth 20 -Compress
  }

  return (Invoke-RestMethod @request)
}

function Get-Rows {
  param($Response)

  if ($null -eq $Response) {
    return @()
  }

  return @($Response)
}

function Get-LocationRows {
  param([Parameter(Mandatory = $true)]$Session)

  $response = Invoke-DataApi -Method GET -Path "locations?id=eq.$LocationId&select=id,name" -AccessToken $Session.AccessToken
  return Get-Rows -Response $response
}

function Get-MembershipRows {
  param([Parameter(Mandatory = $true)]$Session)

  $response = Invoke-DataApi -Method GET -Path "location_memberships?location_id=eq.$LocationId&user_id=eq.$($Session.UserId)&select=location_id,user_id,role,active" -AccessToken $Session.AccessToken
  return Get-Rows -Response $response
}

function Get-StateRows {
  param([Parameter(Mandatory = $true)]$Session)

  $response = Invoke-DataApi -Method GET -Path "location_state?location_id=eq.$LocationId&select=location_id,state,revision,updated_at,updated_by" -AccessToken $Session.AccessToken
  return Get-Rows -Response $response
}

function Set-State {
  param(
    [Parameter(Mandatory = $true)]$Session,
    [Parameter(Mandatory = $true)][long]$ExpectedRevision,
    [Parameter(Mandatory = $true)]$State
  )

  $response = Invoke-DataApi -Method PATCH -Path "location_state?location_id=eq.$LocationId&revision=eq.$ExpectedRevision&select=location_id,state,revision,updated_at,updated_by" -AccessToken $Session.AccessToken -Body @{ state = $State } -Prefer 'return=representation'
  return Get-Rows -Response $response
}

function Invoke-AdminSql {
  param([Parameter(Mandatory = $true)][string]$Sql)

  $previousErrorActionPreference = $ErrorActionPreference
  $output = @()
  $exitCode = $null

  try {
    # Windows PowerShell 5.1 surfaces native stderr as ErrorRecord objects.
    # Supabase writes connection progress there even when the command succeeds,
    # so capture both streams without letting informational stderr terminate us.
    $ErrorActionPreference = 'Continue'
    $output = @(& npx.cmd supabase db query --linked $Sql 2>&1)
    $exitCode = $LASTEXITCODE
  }
  finally {
    $ErrorActionPreference = $previousErrorActionPreference
  }

  if ($null -eq $exitCode -or $exitCode -ne 0) {
    throw "Trusted database command failed: $($output -join [Environment]::NewLine)"
  }
}

function Read-UserSession {
  param([Parameter(Mandatory = $true)][string]$Name)

  $email = (Read-Host "$Name email").Trim()
  Assert-Condition -Condition (-not [string]::IsNullOrWhiteSpace($email)) -Message "$Name email is required."

  $securePassword = Read-Host "$Name password" -AsSecureString
  $passwordPointer = [IntPtr]::Zero
  $plainPassword = $null

  try {
    $passwordPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)
    $plainPassword = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($passwordPointer)

    $response = Invoke-RestMethod -Uri "$ApiBaseUrl/auth/v1/token?grant_type=password" -Method POST -Headers @{ apikey = $script:PublishableKey } -ContentType 'application/json' -Body (@{ email = $email; password = $plainPassword } | ConvertTo-Json -Compress)
  }
  finally {
    $plainPassword = $null
    if ($passwordPointer -ne [IntPtr]::Zero) {
      [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($passwordPointer)
    }
    $securePassword.Dispose()
  }

  $parsedUserId = [Guid]::Empty
  Assert-Condition -Condition (-not [string]::IsNullOrWhiteSpace([string]$response.access_token)) -Message "$Name sign-in returned no access token."
  Assert-Condition -Condition ([Guid]::TryParse([string]$response.user.id, [ref]$parsedUserId)) -Message "$Name sign-in returned an invalid user UUID."
  Assert-Condition -Condition ([string]::Equals([string]$response.user.email, $email, [StringComparison]::OrdinalIgnoreCase)) -Message "$Name sign-in returned a different email identity."

  return [pscustomobject]@{
    Name = $Name
    Email = [string]$response.user.email
    UserId = [string]$response.user.id
    AccessToken = [string]$response.access_token
  }
}

function Test-ActiveMember {
  param(
    [Parameter(Mandatory = $true)]$Session,
    [Parameter(Mandatory = $true)][string]$ExpectedRole,
    [Parameter(Mandatory = $true)][int]$Sequence
  )

  $locations = @(Get-LocationRows -Session $Session)
  Assert-Condition -Condition ($locations.Count -eq 1) -Message "$($Session.Name) could not read Petalon."

  $memberships = @(Get-MembershipRows -Session $Session)
  Assert-Condition -Condition ($memberships.Count -eq 1) -Message "$($Session.Name) could not read their Petalon membership."
  Assert-Condition -Condition ([bool]$memberships[0].active) -Message "$($Session.Name) membership is not active."
  Assert-Condition -Condition ([string]$memberships[0].role -eq $ExpectedRole) -Message "$($Session.Name) role did not match $ExpectedRole."

  $before = @(Get-StateRows -Session $Session)
  Assert-Condition -Condition ($before.Count -eq 1) -Message "$($Session.Name) could not read Petalon state."

  $expectedRevision = [long]$before[0].revision
  $nextState = [ordered]@{
    verification = [ordered]@{
      step = 'active-member-write'
      actor = $Session.Name
      sequence = $Sequence
    }
  }
  $updated = @(Set-State -Session $Session -ExpectedRevision $expectedRevision -State $nextState)
  Assert-Condition -Condition ($updated.Count -eq 1) -Message "$($Session.Name) revision-safe state update was not accepted."
  Assert-Condition -Condition ([long]$updated[0].revision -eq ($expectedRevision + 1)) -Message "$($Session.Name) accepted update did not advance revision exactly once."
  Assert-Condition -Condition ([string]$updated[0].updated_by -eq $Session.UserId) -Message "$($Session.Name) accepted update has the wrong updated_by value."

  return [ordered]@{
    userId = $Session.UserId
    role = $ExpectedRole
    locationRead = $true
    ownMembershipRead = $true
    stateRead = $true
    stateUpdate = $true
    revisionBefore = $expectedRevision
    revisionAfter = [long]$updated[0].revision
    updatedBy = [string]$updated[0].updated_by
  }
}

$report = [ordered]@{
  target = [ordered]@{}
  users = [ordered]@{}
  memberships = [ordered]@{}
  initialState = $null
  activeRls = [ordered]@{}
  revisionTest = [ordered]@{}
  invariantDenials = @()
  revocationTest = [ordered]@{}
  privilegeEscalationDenials = @()
}

$script:PublishableKey = [Environment]::GetEnvironmentVariable('VITE_SUPABASE_PUBLISHABLE_KEY')
if ([string]::IsNullOrWhiteSpace($script:PublishableKey)) {
  $script:PublishableKey = (Read-Host 'Beach Set Manager Supabase publishable key').Trim()
}
Assert-Condition -Condition (-not [string]::IsNullOrWhiteSpace($script:PublishableKey)) -Message 'A publishable key is required.'

$projectOutput = & npx.cmd supabase projects list --output-format json 2>&1
if ($LASTEXITCODE -ne 0) {
  throw "Unable to list Supabase projects: $($projectOutput -join [Environment]::NewLine)"
}
$projects = (($projectOutput -join [Environment]::NewLine) | ConvertFrom-Json).projects
$linkedProject = @($projects | Where-Object { $_.linked })
Assert-Condition -Condition ($linkedProject.Count -eq 1) -Message 'Expected exactly one linked Supabase project.'
Assert-Condition -Condition ([string]$linkedProject[0].ref -eq $ProjectRef) -Message "Linked project is not $ProjectName ($ProjectRef)."
Assert-Condition -Condition ([string]$linkedProject[0].name -eq $ProjectName) -Message "Linked project ref has the unexpected name '$($linkedProject[0].name)'."
$knoProject = @($projects | Where-Object { $_.ref -eq $KnoProjectRef })
Assert-Condition -Condition ($knoProject.Count -eq 1) -Message 'KNO was not present in the project list for the safety check.'
Assert-Condition -Condition (-not [bool]$knoProject[0].linked) -Message 'KNO is linked. Refusing to continue.'
$report.target = [ordered]@{
  name = [string]$linkedProject[0].name
  ref = [string]$linkedProject[0].ref
  linked = $true
  knoRef = $KnoProjectRef
  knoLinked = $false
}

Write-Host 'Enter each real user credential locally. Passwords are masked and are not saved or reported.'
$vuk = Read-UserSession -Name 'Vuk'
$vito = Read-UserSession -Name 'Vito'
$mark = Read-UserSession -Name 'Mark'

Assert-Condition -Condition ($vuk.UserId -eq $ExpectedUserIds.Vuk) -Message 'Vuk sign-in did not match the previously verified Vuk Auth UUID.'
Assert-Condition -Condition ($vito.UserId -eq $ExpectedUserIds.Vito) -Message 'Vito sign-in did not match the previously verified Vito Auth UUID.'
Assert-Condition -Condition ($mark.UserId -eq $ExpectedUserIds.Mark) -Message 'Mark sign-in did not match the previously verified Mark Auth UUID.'

$userIds = @(@($vuk.UserId, $vito.UserId, $mark.UserId) | Select-Object -Unique)
Assert-Condition -Condition ($userIds.Count -eq 3) -Message 'The three sign-ins did not resolve to three distinct Auth users.'

$report.users = [ordered]@{
  Vuk = [ordered]@{ email = $vuk.Email; userId = $vuk.UserId }
  Vito = [ordered]@{ email = $vito.Email; userId = $vito.UserId }
  Mark = [ordered]@{ email = $mark.Email; userId = $mark.UserId }
}

$provisionSql = "begin; insert into public.location_memberships (location_id, user_id, role, active) values ('$LocationId', '$($vuk.UserId)', 'PLATFORM_OWNER', true), ('$LocationId', '$($vito.UserId)', 'WORKER', true), ('$LocationId', '$($mark.UserId)', 'WORKER', true) on conflict (location_id, user_id) do update set role = excluded.role, active = excluded.active, updated_at = now(); insert into public.location_state (location_id, state, revision) values ('$LocationId', jsonb_build_object('schemaVersion', 1, 'purpose', 'step-3-rls-verification', 'operationalDataSeeded', false), 0) on conflict (location_id) do nothing; commit;"
Invoke-AdminSql -Sql $provisionSql

$report.memberships = [ordered]@{
  Vuk = [ordered]@{ role = 'PLATFORM_OWNER'; active = $true; locationId = $LocationId }
  Vito = [ordered]@{ role = 'WORKER'; active = $true; locationId = $LocationId }
  Mark = [ordered]@{ role = 'WORKER'; active = $true; locationId = $LocationId }
}

$initialRows = @(Get-StateRows -Session $vuk)
Assert-Condition -Condition ($initialRows.Count -eq 1) -Message 'Vuk could not read the controlled initial location_state.'
$report.initialState = [ordered]@{
  state = $initialRows[0].state
  revision = [long]$initialRows[0].revision
}

$report.activeRls.Vuk = Test-ActiveMember -Session $vuk -ExpectedRole 'PLATFORM_OWNER' -Sequence 1
$report.activeRls.Vito = Test-ActiveMember -Session $vito -ExpectedRole 'WORKER' -Sequence 2
$report.activeRls.Mark = Test-ActiveMember -Session $mark -ExpectedRole 'WORKER' -Sequence 3

$revisionBeforeRows = @(Get-StateRows -Session $vuk)
$revisionN = [long]$revisionBeforeRows[0].revision
$stateA = [ordered]@{ verification = [ordered]@{ step = 'revision-write-a'; actor = 'Vuk'; baseRevision = $revisionN } }
$writeA = @(Set-State -Session $vuk -ExpectedRevision $revisionN -State $stateA)
Assert-Condition -Condition ($writeA.Count -eq 1) -Message 'Revision write A was not accepted.'
Assert-Condition -Condition ([long]$writeA[0].revision -eq ($revisionN + 1)) -Message 'Revision write A did not advance exactly once.'
Assert-Condition -Condition ([string]$writeA[0].updated_by -eq $vuk.UserId) -Message 'Revision write A did not stamp Vuk as updated_by.'

$stateB = [ordered]@{ verification = [ordered]@{ step = 'stale-revision-write-b'; actor = 'Vuk'; baseRevision = $revisionN } }
$writeB = @(Set-State -Session $vuk -ExpectedRevision $revisionN -State $stateB)
Assert-Condition -Condition ($writeB.Count -eq 0) -Message 'Stale revision write B unexpectedly succeeded.'

$revisionAfterRows = @(Get-StateRows -Session $vuk)
Assert-Condition -Condition ($revisionAfterRows.Count -eq 1) -Message 'Vuk could not read state after the revision test.'
Assert-Condition -Condition ([long]$revisionAfterRows[0].revision -eq ($revisionN + 1)) -Message 'Stale write changed the final revision.'
Assert-Condition -Condition ([string]$revisionAfterRows[0].state.verification.step -eq 'revision-write-a') -Message 'Stale write replaced state from write A.'
Assert-Condition -Condition ([string]$revisionAfterRows[0].updated_by -eq $vuk.UserId) -Message 'Final updated_by is not Vuk.'
$report.revisionTest = [ordered]@{
  startingRevision = $revisionN
  acceptedWriteRows = $writeA.Count
  acceptedRevision = [long]$writeA[0].revision
  staleWriteRows = $writeB.Count
  finalRevision = [long]$revisionAfterRows[0].revision
  finalStateStep = [string]$revisionAfterRows[0].state.verification.step
  updatedBy = [string]$revisionAfterRows[0].updated_by
}

$report.invariantDenials = @(
  Invoke-ExpectedDenial -Name 'manual revision update' -Action {
    Invoke-DataApi -Method PATCH -Path "location_state?location_id=eq.$LocationId" -AccessToken $vito.AccessToken -Body @{ revision = ([long]$revisionAfterRows[0].revision + 100) } -Prefer 'return=representation'
  }
  Invoke-ExpectedDenial -Name 'forged updated_by update' -Action {
    Invoke-DataApi -Method PATCH -Path "location_state?location_id=eq.$LocationId" -AccessToken $vito.AccessToken -Body @{ updated_by = $mark.UserId } -Prefer 'return=representation'
  }
  Invoke-ExpectedDenial -Name 'manual updated_at update' -Action {
    Invoke-DataApi -Method PATCH -Path "location_state?location_id=eq.$LocationId" -AccessToken $vito.AccessToken -Body @{ updated_at = '2000-01-01T00:00:00Z' } -Prefer 'return=representation'
  }
)

$testLocationId = [Guid]::NewGuid().ToString()
$report.privilegeEscalationDenials = @(
  Invoke-ExpectedDenial -Name 'membership insert' -Action {
    Invoke-DataApi -Method POST -Path 'location_memberships' -AccessToken $vito.AccessToken -Body @{ location_id = $LocationId; user_id = $vito.UserId; role = 'PLATFORM_OWNER'; active = $true } -Prefer 'return=representation'
  }
  Invoke-ExpectedDenial -Name 'membership role update' -Action {
    Invoke-DataApi -Method PATCH -Path "location_memberships?location_id=eq.$LocationId&user_id=eq.$($vito.UserId)" -AccessToken $vito.AccessToken -Body @{ role = 'PLATFORM_OWNER' } -Prefer 'return=representation'
  }
  Invoke-ExpectedDenial -Name 'membership active update' -Action {
    Invoke-DataApi -Method PATCH -Path "location_memberships?location_id=eq.$LocationId&user_id=eq.$($vito.UserId)" -AccessToken $vito.AccessToken -Body @{ active = $false } -Prefer 'return=representation'
  }
  Invoke-ExpectedDenial -Name 'membership delete' -Action {
    Invoke-DataApi -Method DELETE -Path "location_memberships?location_id=eq.$LocationId&user_id=eq.$($vito.UserId)" -AccessToken $vito.AccessToken -Prefer 'return=representation'
  }
  Invoke-ExpectedDenial -Name 'location insert' -Action {
    Invoke-DataApi -Method POST -Path 'locations' -AccessToken $vito.AccessToken -Body @{ id = $testLocationId; name = 'unauthorized-test' } -Prefer 'return=representation'
  }
  Invoke-ExpectedDenial -Name 'location delete' -Action {
    Invoke-DataApi -Method DELETE -Path "locations?id=eq.$LocationId" -AccessToken $vito.AccessToken -Prefer 'return=representation'
  }
)

$beforeRevocationLocation = @(Get-LocationRows -Session $vito)
$beforeRevocationState = @(Get-StateRows -Session $vito)
Assert-Condition -Condition ($beforeRevocationLocation.Count -eq 1 -and $beforeRevocationState.Count -eq 1) -Message 'Vito did not have access immediately before revocation.'
$revocationRevision = [long]$beforeRevocationState[0].revision
$revocationStateStep = [string]$beforeRevocationState[0].state.verification.step
$membershipReactivated = $false

try {
  Invoke-AdminSql -Sql "update public.location_memberships set active = false where location_id = '$LocationId' and user_id = '$($vito.UserId)';"

  $inactiveLocations = @(Get-LocationRows -Session $vito)
  $inactiveStates = @(Get-StateRows -Session $vito)
  $inactiveMemberships = @(Get-MembershipRows -Session $vito)
  $inactiveWrite = @(Set-State -Session $vito -ExpectedRevision $revocationRevision -State ([ordered]@{ verification = [ordered]@{ step = 'revoked-write-must-not-apply'; actor = 'Vito' } }))

  Assert-Condition -Condition ($inactiveLocations.Count -eq 0) -Message 'Revoked Vito could still read Petalon.'
  Assert-Condition -Condition ($inactiveStates.Count -eq 0) -Message 'Revoked Vito could still read Petalon state.'
  Assert-Condition -Condition ($inactiveWrite.Count -eq 0) -Message 'Revoked Vito could still update Petalon state.'
  Assert-Condition -Condition ($inactiveMemberships.Count -eq 1 -and -not [bool]$inactiveMemberships[0].active) -Message 'Vito could not read the expected inactive self-membership row.'
}
finally {
  Invoke-AdminSql -Sql "update public.location_memberships set active = true where location_id = '$LocationId' and user_id = '$($vito.UserId)';"
  $membershipReactivated = $true
}

$restoredLocations = @(Get-LocationRows -Session $vito)
$restoredStates = @(Get-StateRows -Session $vito)
Assert-Condition -Condition ($restoredLocations.Count -eq 1 -and $restoredStates.Count -eq 1) -Message 'Vito access was not restored after reactivation.'
Assert-Condition -Condition ([long]$restoredStates[0].revision -eq $revocationRevision) -Message 'Denied revoked write changed the revision.'
Assert-Condition -Condition ([string]$restoredStates[0].state.verification.step -eq $revocationStateStep) -Message 'Denied revoked write changed the state.'
$report.revocationTest = [ordered]@{
  user = 'Vito'
  userId = $vito.UserId
  sameSessionTokenUsed = $true
  activeLocationRead = $true
  activeStateRead = $true
  inactiveLocationRows = $inactiveLocations.Count
  inactiveStateRows = $inactiveStates.Count
  inactiveWriteRows = $inactiveWrite.Count
  inactiveSelfMembershipVisible = $true
  reactivated = $membershipReactivated
  restoredLocationRead = $true
  restoredStateRead = $true
  finalRevision = [long]$restoredStates[0].revision
}

$reportDirectory = Join-Path (Split-Path -Parent $PSScriptRoot) '.temp'
if (-not (Test-Path -LiteralPath $reportDirectory)) {
  $null = New-Item -ItemType Directory -Path $reportDirectory
}
$reportPath = Join-Path $reportDirectory 'step3-authenticated-rls-report.json'
$report | ConvertTo-Json -Depth 20 | Set-Content -LiteralPath $reportPath -Encoding UTF8

Write-Host "PASS: authenticated RLS, revision, revocation, and privilege-escalation checks completed."
Write-Host "Credential-free report: $reportPath"
