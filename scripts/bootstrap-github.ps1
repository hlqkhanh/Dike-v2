[CmdletBinding()]
param(
    [string]$Repository = "hlqkhanh/Dike-v2"
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

function Invoke-Gh {
    param([Parameter(ValueFromRemainingArguments = $true)][string[]]$Arguments)

    & gh @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "gh command failed: gh $($Arguments -join ' ')"
    }
}

function Test-RemoteRepository {
    & gh api "repos/$Repository" --silent 2>$null
    return $LASTEXITCODE -eq 0
}

function Ensure-Label {
    param(
        [string]$Name,
        [string]$Color,
        [string]$Description
    )

    Invoke-Gh label create $Name --repo $Repository --color $Color --description $Description --force
}

function Ensure-Milestone {
    param([string]$Title)

    $milestones = Invoke-Gh api "repos/$Repository/milestones?state=all&per_page=100" | ConvertFrom-Json
    $milestoneTitles = @($milestones | ForEach-Object { $_.title })
    if ($milestoneTitles -notcontains $Title) {
        Invoke-Gh api --method POST "repos/$Repository/milestones" -f "title=$Title" | Out-Null
    }
}

function Test-IssueTitle {
    param([string]$Title)

    $encoded = [uri]::EscapeDataString("repo:$Repository is:issue in:title `"$Title`"")
    $count = Invoke-Gh api "search/issues?q=$encoded" --jq ".total_count"
    return [int]$count -gt 0
}

function Ensure-Issue {
    param(
        [string]$Title,
        [string]$Body,
        [string]$Milestone,
        [string[]]$Labels
    )

    if (Test-IssueTitle -Title $Title) {
        Write-Host "Issue already exists: $Title"
        return
    }

    $arguments = @(
        "issue", "create",
        "--repo", $Repository,
        "--title", $Title,
        "--body", $Body,
        "--milestone", $Milestone
    )
    foreach ($label in $Labels) {
        $arguments += @("--label", $label)
    }
    Invoke-Gh @arguments | Out-Null
}

Invoke-Gh auth status -h github.com

$localRoot = (& git rev-parse --show-toplevel 2>$null)
if ($LASTEXITCODE -ne 0 -or -not $localRoot) {
    throw "Run this script from the Dike Git repository."
}

& git rev-parse --verify HEAD *> $null
if ($LASTEXITCODE -ne 0) {
    throw "Create and verify the greenfield baseline commit before provisioning GitHub."
}

$repositoryExists = Test-RemoteRepository
if ($repositoryExists) {
    $isEmpty = Invoke-Gh repo view $Repository --json isEmpty --jq ".isEmpty"
    if ($isEmpty.Trim().ToLowerInvariant() -ne "true") {
        $remoteHead = Invoke-Gh api "repos/$Repository/commits/main" --jq ".sha"
        $localHead = (& git rev-parse HEAD).Trim()
        if ($remoteHead.Trim() -ne $localHead) {
            throw "Remote $Repository contains history that does not match local HEAD. Refusing to overwrite it."
        }
    }

    $remotes = @(& git remote)
    if ($remotes -notcontains "origin") {
        & git remote add origin "https://github.com/$Repository.git"
        if ($LASTEXITCODE -ne 0) {
            throw "Unable to add origin."
        }
    }
} else {
    Invoke-Gh repo create $Repository --private --source . --remote origin
}

& git push --set-upstream origin main
if ($LASTEXITCODE -ne 0) {
    throw "Initial push failed; repository settings were not changed."
}

Invoke-Gh repo edit $Repository --visibility private --accept-visibility-change-consequences --enable-issues --enable-wiki=false --delete-branch-on-merge --enable-squash-merge --enable-merge-commit=false --enable-rebase-merge=false
Invoke-Gh api --method PUT "repos/$Repository/actions/permissions" -F "enabled=true" -f "allowed_actions=all" | Out-Null

foreach ($collaborator in @("chithong17", "longfptaka3011", "nguyenhat3105")) {
    Invoke-Gh api --method PUT "repos/$Repository/collaborators/$collaborator" -f "permission=push" | Out-Null
}

$rulesetSupported = $true
try {
    $existingRulesetsJson = & gh api "repos/$Repository/rulesets" 2>$null
    if ($LASTEXITCODE -ne 0) {
        $rulesetSupported = $false
    }
} catch {
    $rulesetSupported = $false
}

if ($rulesetSupported -and (($existingRulesetsJson | ConvertFrom-Json).name -notcontains "main-safety")) {
    $ruleset = @{
        name          = "main-safety"
        target        = "branch"
        enforcement   = "active"
        bypass_actors = @(
            @{
                actor_id    = 5
                actor_type  = "RepositoryRole"
                bypass_mode = "always"
            }
        )
        conditions    = @{
            ref_name = @{
                include = @("~DEFAULT_BRANCH")
                exclude = @()
            }
        }
        rules         = @(
            @{ type = "deletion" },
            @{ type = "non_fast_forward" }
        )
    }
    try {
        $ruleset | ConvertTo-Json -Depth 10 | gh api --method POST "repos/$Repository/rulesets" --input - | Out-Null
        if ($LASTEXITCODE -ne 0) {
            $rulesetSupported = $false
        }
    } catch {
        $rulesetSupported = $false
    }
}

if (-not $rulesetSupported) {
    Write-Warning "The current GitHub plan does not support rulesets on this private repository. main-safety remains a required pending setting."
}

$securitySettings = @{
    security_and_analysis = @{
        secret_scanning = @{ status = "enabled" }
        secret_scanning_push_protection = @{ status = "enabled" }
    }
}
$securityEnabled = $true
try {
    $securitySettings | ConvertTo-Json -Depth 5 | gh api --method PATCH "repos/$Repository" --input - *> $null
    if ($LASTEXITCODE -ne 0) {
        $securityEnabled = $false
    }
} catch {
    $securityEnabled = $false
}
if (-not $securityEnabled) {
    Write-Warning "Secret scanning/push protection is unavailable for this private repository plan; CI scanning remains mandatory."
}

$labels = @(
    @("type:feature", "1f883d", "New product capability"),
    @("type:bug", "d73a4a", "Defect or regression"),
    @("type:chore", "6f42c1", "Repository or maintenance work"),
    @("type:docs", "0075ca", "Documentation change"),
    @("type:test", "5319e7", "Test or verification work"),
    @("type:security", "b60205", "Security or privacy work"),
    @("area:web", "0e8a16", "Web application"),
    @("area:backend", "0052cc", "Spring backend"),
    @("area:mobile", "3e4b9e", "Flutter mobile application"),
    @("area:infra", "c5def5", "Infrastructure and CI"),
    @("area:architecture", "7057ff", "Architecture and ADR"),
    @("area:docs", "bfdadc", "Project documentation"),
    @("priority:p0", "8b0000", "Critical priority"),
    @("priority:p1", "d93f0b", "High priority"),
    @("priority:p2", "fbca04", "Normal priority"),
    @("priority:p3", "c2e0c6", "Low priority"),
    @("needs-owner", "ededed", "Admin must assign owner and reviewer"),
    @("blocked", "000000", "Blocked by a dependency or decision")
)
foreach ($label in $labels) {
    Ensure-Label -Name $label[0] -Color $label[1] -Description $label[2]
}

0..17 | ForEach-Object { Ensure-Milestone -Title "Stage $_" }

$stageTitles = @(
    "Repository and scope baseline",
    "Backend foundation and local infrastructure",
    "Google authentication and sessions",
    "Identity, vehicle and community verification",
    "Profiles, friends and sharing permissions",
    "Personal schedules and travel intents",
    "Maps, places and routing",
    "Community posts and feed",
    "Search and matching",
    "Trips and seat management",
    "Ride proposals and booking transactions",
    "Realtime notifications and presence",
    "Direct and booking chat",
    "Active rides and cost sharing",
    "Reviews, reports and trust",
    "Web production completion",
    "Mobile Flutter",
    "Production hardening and pilot"
)

for ($stage = 0; $stage -le 17; $stage++) {
    $title = "[Stage $stage] $($stageTitles[$stage])"
    $body = @"
## Context

Umbrella issue for Stage $stage. The specification, objective and completion gate are in [PLAN_MASTER.md](../blob/main/plan/PLAN_MASTER.md).

## In scope

- Track child issues for Stage $stage.
- Record evidence for the completion gate in the master plan.

## Out of scope

- Changing requirements only in an issue without updating the master plan.

## Dependencies

- Completion gate of the previous stage, except for Stage 0.

## Acceptance criteria

- [ ] All required child issues are closed or have a documented scope decision.
- [ ] The `PLAN_MASTER.md` completion gate has verifiable evidence.

## Test and verification

- Record commands, CI runs and evidence in child issues.

## Security and privacy impact

- Assess each child issue separately; never attach secrets or PII.

## Documentation impact

- Update `PLAN_MASTER.md` and ADRs when a decision changes.

## Owner / reviewer

- Owner: Unassigned
- Reviewer: Unassigned
"@
    Ensure-Issue -Title $title -Body $body -Milestone "Stage $stage" -Labels @("type:feature", "needs-owner", "priority:p2")
}

$stageZeroItems = @(
    @("S0-00", "Synchronize the source of truth", "type:docs", "area:docs"),
    @("S0-01", "Initialize the Git baseline", "type:chore", "area:infra"),
    @("S0-02", "Root pnpm workspace", "type:chore", "area:infra"),
    @("S0-03", "Maven baseline", "type:chore", "area:backend"),
    @("S0-04", "Git hooks and working conventions", "type:chore", "area:infra"),
    @("S0-05", "Repository documentation", "type:docs", "area:docs"),
    @("S0-06", "Architecture Decision Records", "type:docs", "area:architecture"),
    @("S0-07", "GitHub repository and permissions", "type:chore", "area:infra"),
    @("S0-08", "CI and security baseline", "type:security", "area:infra"),
    @("S0-09", "GitHub Issues backlog", "type:chore", "area:docs"),
    @("S0-10", "Acceptance and handoff", "type:test", "area:infra")
)

foreach ($item in $stageZeroItems) {
    $body = @"
## Context

Work item $($item[0]) from [STAGE_0.md](../blob/main/plan/STAGE_0.md); the source specification is [PLAN_MASTER.md](../blob/main/plan/PLAN_MASTER.md).

## In scope

- Implement the deliverables and acceptance criteria for $($item[0]) in the runbook.

## Out of scope

- Application scaffolding or Stage 1 runtime infrastructure.

## Dependencies

- Follow the dependencies documented in `plan/STAGE_0.md`.

## Acceptance criteria

- [ ] Runbook deliverables are complete.
- [ ] Acceptance evidence is attached.

## Test and verification

- Run the relevant quality gates and record results.

## Security and privacy impact

- Do not commit secrets, PII, dumps, uploads or prototype artifacts.

## Documentation impact

- Update the runbook, master plan and ADRs when a decision changes.

## Owner / reviewer

- Owner: Unassigned
- Reviewer: Unassigned
"@
    Ensure-Issue -Title "[$($item[0])] $($item[1])" -Body $body -Milestone "Stage 0" -Labels @($item[2], $item[3], "needs-owner", "priority:p1")
}

Write-Host "GitHub repository, governance and backlog bootstrap completed for $Repository."
