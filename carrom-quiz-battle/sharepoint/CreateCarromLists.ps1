# =============================================================================
# Carrom Quiz Battle — SharePoint List Setup Script
# Run in PowerShell after connecting to your SharePoint tenant.
# =============================================================================
# Prerequisites:
#   Install-Module -Name PnP.PowerShell -Force -AllowClobber
#   Connect-PnPOnline -Url "https://<your-tenant>.sharepoint.com/sites/CarromBattle" -Interactive
#   .\CreateCarromLists.ps1
# Idempotent: skips lists that already exist.
# =============================================================================

$siteUrl = "https://<your-tenant>.sharepoint.com/sites/CarromBattle"
Write-Host "Target site: $siteUrl" -ForegroundColor Cyan

function Ensure-List([string]$Title) {
    $existing = Get-PnPList -Identity $Title -ErrorAction SilentlyContinue
    if ($null -eq $existing) {
        New-PnPList -Title $Title -Template GenericList -EnableVersioning | Out-Null
        Write-Host "Created list: $Title" -ForegroundColor Green
    } else {
        Write-Host "List exists, skipping: $Title" -ForegroundColor Yellow
    }
}

function Add-FieldIfMissing([string]$List, [string]$InternalName, [string]$Type, [hashtable]$Extra = @{}) {
    $field = Get-PnPField -List $List -Identity $InternalName -ErrorAction SilentlyContinue
    if ($null -eq $field) {
        $params = @{
            List = $List; DisplayName = $InternalName; InternalName = $InternalName
            Type = $Type; AddToDefaultView = $true
        }
        foreach ($k in $Extra.Keys) { $params[$k] = $Extra[$k] }
        Add-PnPField @params | Out-Null
        Write-Host "  + field $List.$InternalName ($Type)"
    }
}

function Set-Indexed([string]$List, [string]$InternalName, [bool]$Unique = $false) {
    Set-PnPField -List $List -Identity $InternalName -Values @{ Indexed = $true; EnforceUnique = $Unique } | Out-Null
    Write-Host "  = indexed $List.$InternalName (Unique=$Unique)"
}

# ---------------------------------------------------------------------------
# 1. CarromQuestions
# ---------------------------------------------------------------------------
Ensure-List "CarromQuestions"
Add-FieldIfMissing "CarromQuestions" "QuestionId"    "Text"
Add-FieldIfMissing "CarromQuestions" "QuestionText"  "Note"
Add-FieldIfMissing "CarromQuestions" "Category"      "Choice" @{ Choices = @("Learning", "Strategy") }
Add-FieldIfMissing "CarromQuestions" "Difficulty"    "Number"
Add-FieldIfMissing "CarromQuestions" "OptionA"       "Text"
Add-FieldIfMissing "CarromQuestions" "OptionB"       "Text"
Add-FieldIfMissing "CarromQuestions" "OptionC"       "Text"
Add-FieldIfMissing "CarromQuestions" "OptionD"       "Text"
Add-FieldIfMissing "CarromQuestions" "CorrectOption" "Number"
Add-FieldIfMissing "CarromQuestions" "Hint"          "Text"
Add-FieldIfMissing "CarromQuestions" "IsActive"      "Boolean"
Set-Indexed "CarromQuestions" "QuestionId"
Set-Indexed "CarromQuestions" "IsActive"

# ---------------------------------------------------------------------------
# 2. CarromSessions
# ---------------------------------------------------------------------------
Ensure-List "CarromSessions"
Add-FieldIfMissing "CarromSessions" "SessionId"     "Text"
Add-FieldIfMissing "CarromSessions" "Player1Name"   "Text"
Add-FieldIfMissing "CarromSessions" "Player2Name"   "Text"
Add-FieldIfMissing "CarromSessions" "CurrentPlayer" "Number"
Add-FieldIfMissing "CarromSessions" "Player1Score"  "Number"
Add-FieldIfMissing "CarromSessions" "Player2Score"  "Number"
Add-FieldIfMissing "CarromSessions" "GameStatus"    "Choice" @{ Choices = @("inProgress", "completed") }
Add-FieldIfMissing "CarromSessions" "StartedAt"     "DateTime"
Add-FieldIfMissing "CarromSessions" "CompletedAt"   "DateTime"
Add-FieldIfMissing "CarromSessions" "Winner"        "Number"
Add-FieldIfMissing "CarromSessions" "WinnerComputed" "Boolean"
Add-FieldIfMissing "CarromSessions" "StateJson"     "Note"
Set-Indexed "CarromSessions" "SessionId" -Unique $true

# ---------------------------------------------------------------------------
# 3. CarromAttempts
# ---------------------------------------------------------------------------
Ensure-List "CarromAttempts"
Add-FieldIfMissing "CarromAttempts" "AttemptId"      "Text"
Add-FieldIfMissing "CarromAttempts" "SessionId"      "Text"
Add-FieldIfMissing "CarromAttempts" "QuestionId"     "Text"
Add-FieldIfMissing "CarromAttempts" "PlayerNumber"   "Number"
Add-FieldIfMissing "CarromAttempts" "CoinId"         "Text"
Add-FieldIfMissing "CarromAttempts" "SelectedOption" "Number"
Add-FieldIfMissing "CarromAttempts" "IsCorrect"      "Boolean"
Add-FieldIfMissing "CarromAttempts" "AttemptedAt"    "DateTime"
Set-Indexed "CarromAttempts" "SessionId"
Set-Indexed "CarromAttempts" "QuestionId"

# ---------------------------------------------------------------------------
# 4. CarromCoinEvents (EventKey unique => replays never double-score)
# ---------------------------------------------------------------------------
Ensure-List "CarromCoinEvents"
Add-FieldIfMissing "CarromCoinEvents" "EventKey"      "Text"
Add-FieldIfMissing "CarromCoinEvents" "SessionId"     "Text"
Add-FieldIfMissing "CarromCoinEvents" "CoinId"        "Text"
Add-FieldIfMissing "CarromCoinEvents" "PlayerNumber"  "Number"
Add-FieldIfMissing "CarromCoinEvents" "EventType"     "Choice" @{ Choices = @("coinPocketed", "coverSecured", "coverFailed") }
Add-FieldIfMissing "CarromCoinEvents" "PointsAwarded" "Number"
Add-FieldIfMissing "CarromCoinEvents" "EventAt"       "DateTime"
Set-Indexed "CarromCoinEvents" "EventKey" -Unique $true
Set-Indexed "CarromCoinEvents" "SessionId"

Write-Host "All 4 Carrom lists are ready. Next: .\SeedCarromQuestions.ps1" -ForegroundColor Green
