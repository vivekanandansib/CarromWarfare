# =============================================================================
# Carrom Quiz Battle — Seed Question Bank
# Run AFTER CreateCarromLists.ps1. Idempotent: skips QuestionIds already present.
# NOTE: CorrectOption lives ONLY in SharePoint. The Canvas App decides whether
# to include it in the PCF QuestionsJson (v1 casual play) or hold it back for
# server-side validation (production upgrade path, see docs/architecture.md).
# =============================================================================

function Add-QuestionIfMissing(
    [string]$Id, [string]$Text, [string]$Category, [int]$Difficulty,
    [string]$A, [string]$B, [string]$C, [string]$D, [int]$Correct,
    [string]$Hint
) {
    $existing = Get-PnPListItem -List "CarromQuestions" -Query `
        "<View><Query><Where><Eq><FieldRef Name='QuestionId'/><Value Type='Text'>$Id</Value></Eq></Where></Query></View>" `
        -ErrorAction SilentlyContinue
    if ($null -ne $existing -and @($existing).Count -gt 0) {
        Write-Host "  skip $Id (exists)"
        return
    }
    Add-PnPListItem -List "CarromQuestions" -Values @{
        "Title" = $Id; "QuestionId" = $Id; "QuestionText" = $Text
        "Category" = $Category; "Difficulty" = $Difficulty
        "OptionA" = $A; "OptionB" = $B; "OptionC" = $C; "OptionD" = $D
        "CorrectOption" = $Correct; "Hint" = $Hint; "IsActive" = $true
    } | Out-Null
    Write-Host "  + $Id"
}

# --- Learning ---
Add-QuestionIfMissing "L-01" "Which gas do plants absorb for photosynthesis?" "Learning" 1 "Oxygen" "Carbon dioxide" "Nitrogen" "Hydrogen" 1 "It is what we exhale."
Add-QuestionIfMissing "L-02" "What is 12 x 8?" "Learning" 1 "84" "92" "96" "108" 2 "10x8 + 2x8."
Add-QuestionIfMissing "L-03" "Which planet is known as the Red Planet?" "Learning" 1 "Venus" "Mars" "Jupiter" "Mercury" 1 "Named after the god of war."
Add-QuestionIfMissing "L-04" "What is the largest ocean on Earth?" "Learning" 2 "Atlantic" "Indian" "Arctic" "Pacific" 3 "It covers a third of the surface."
Add-QuestionIfMissing "L-05" "Which element has the chemical symbol Fe?" "Learning" 2 "Fluorine" "Iron" "Lead" "Tin" 1 "From the Latin ferrum."
Add-QuestionIfMissing "L-06" "In which year did the first moon landing occur?" "Learning" 2 "1965" "1969" "1972" "1959" 1 "Apollo 11."
Add-QuestionIfMissing "L-07" "Which mathematician is credited with the laws of motion and gravity?" "Learning" 3 "Einstein" "Galileo" "Newton" "Kepler" 2 "The apple story."
Add-QuestionIfMissing "L-08" "What is the binary representation of decimal 13?" "Learning" 3 "1011" "1101" "1110" "1001" 1 "8 + 4 + 1."

# --- Carrom Strategy ---
Add-QuestionIfMissing "S-01" "In carrom, where must the striker be placed before a shot?" "Strategy" 1 "Anywhere on the board" "On the baseline within the circles" "In a pocket" "On the center spot" 1 "Think of the foul lines at each side."
Add-QuestionIfMissing "S-02" "What is a bank shot in carrom?" "Strategy" 2 "Hitting the coin directly" "Bouncing the striker off a cushion first" "Flicking with two fingers" "Pocketing two coins at once" 1 "Use the frame like a mirror."
Add-QuestionIfMissing "S-03" "When should you prefer a defensive shot?" "Strategy" 2 "When no safe pocket is available" "Always - it scores double" "Only on the first turn" "Never, it is a foul" 0 "Leave your opponent nothing easy."
Add-QuestionIfMissing "S-04" "After pocketing the queen, what must you do to keep her?" "Strategy" 2 "Nothing - she is yours" "Pocket another coin on your next turn (cover)" "Win the next two turns" "Answer three bonus questions" 1 "It is called the cover."
Add-QuestionIfMissing "S-05" "A striker rebounds off two cushions before hitting the coin. What is this called?" "Strategy" 3 "Straight shot" "Cut shot" "Double-bank shot" "Foul shot" 2 "Bank, twice."
Add-QuestionIfMissing "S-06" "Your opponent's coin blocks the pocket line. Which shot cuts around it with the finest angle?" "Strategy" 3 "Straight drive" "Fine cut shot" "Defensive block" "Center flick" 1 "Graze the edge, not the face."

Write-Host "Seed complete: 14 questions (8 Learning, 6 Strategy)." -ForegroundColor Green
