# DataPulse — Documentation

## Structure

```
docs/
├── README.md                  ← You are here
├── ARCHITECTURE.md            # System architecture (Mermaid diagrams)
├── RUNBOOK.md                 # Operational runbook
├── GLOBAL_LESSONS.md          # Cross-project problem-solution log
├── disaster-recovery.md       # DR plan (RTO < 30min, RPO < 24h)
├── adr/                       # Architectural Decision Records (001-005)
├── audits/                    # Data & calculation audits (Bronze, Silver, logic)
├── plans/                     # Project plans (completed, active, future phases)
│   ├── README.md              #   Master index with navigation
│   ├── completed/             #   Completed phases & audits
│   └── project-expansion/     #   Future phases 5-10
├── reports/                   # Project reviews, analysis, enhancements
├── team-configs/              # Role-based Claude Code configs (6 roles)
├── pharma-expansion/          # Pharmacy domain expansion sessions
├── brain/                     # Session memory (auto-managed by hooks)
└── assets/                    # Presentations, diagrams
```

## Quick Links

- **[Plans Index](./plans/)** — All phase plans with sub-phase breakdowns
- **[Reports](./reports/)** — Project reviews, analysis, post-mortems
- **[Audits](./audits/)** — Data quality & calculation audits
- **[ADRs](./adr/)** — Architectural Decision Records
- **[Architecture](./ARCHITECTURE.md)** — System diagrams
- **[Runbook](./RUNBOOK.md)** — Operations guide
- **[CLAUDE.md](../CLAUDE.md)** — Full technical reference
- **[CONTRIBUTING.md](../CONTRIBUTING.md)** — Development guide
