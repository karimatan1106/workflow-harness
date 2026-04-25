# Workflow Harness Metrics Report
Generated: 2026-04-24T12:18:23.844Z
Tasks scanned: 12

## Overall
- Total phases executed: 372
- Total retries: 76
- Total DoD failures: 76
- Avg phases per task: 31.0

## Phase duration distribution (ms)
| Phase | Count | Mean | Median | P95 | Max |
|-------|-------|------|--------|-----|-----|
| acceptance_verification | 12 | 605833 | 160000 | 5524000 | 5524000 |
| build_check | 12 | 52750 | 34000 | 153000 | 153000 |
| ci_verification | 12 | 32917 | 10000 | 259000 | 259000 |
| code_review | 12 | 283417 | 197000 | 1506000 | 1506000 |
| commit | 12 | 659250 | 97000 | 6734000 | 6734000 |
| completed | 12 | 0 | 0 | 0 | 0 |
| deploy | 12 | 24167 | 10000 | 155000 | 155000 |
| design_review | 12 | 124500 | 109000 | 488000 | 488000 |
| docs_update | 12 | 91833 | 71000 | 241000 | 241000 |
| flowchart | 12 | 35583 | 41000 | 97000 | 97000 |
| health_observation | 12 | 113667 | 89000 | 399000 | 399000 |
| hearing | 12 | 2111000 | 761000 | 14582000 | 14582000 |
| impact_analysis | 12 | 75583 | 57000 | 178000 | 178000 |
| implementation | 12 | 389167 | 303000 | 1021000 | 1021000 |
| manual_test | 12 | 155750 | 143000 | 281000 | 281000 |
| performance_test | 12 | 131000 | 110000 | 345000 | 345000 |
| planning | 12 | 116167 | 83000 | 422000 | 422000 |
| push | 12 | 593500 | 11000 | 6899000 | 6899000 |
| refactoring | 12 | 159750 | 91000 | 1118000 | 1118000 |
| regression_test | 12 | 402083 | 46000 | 4081000 | 4081000 |
| requirements | 12 | 299167 | 294000 | 787000 | 787000 |
| research | 12 | 99167 | 86000 | 226000 | 226000 |
| scope_definition | 12 | 73833 | 85000 | 188000 | 188000 |
| security_scan | 12 | 127250 | 114000 | 193000 | 193000 |
| state_machine | 12 | 33500 | 45000 | 64000 | 64000 |
| test_design | 12 | 570750 | 218000 | 5019000 | 5019000 |
| test_impl | 12 | 1613000 | 236000 | 17202000 | 17202000 |
| test_selection | 12 | 98000 | 90000 | 231000 | 231000 |
| testing | 12 | 138667 | 53000 | 696000 | 696000 |
| threat_modeling | 12 | 59667 | 77000 | 136000 | 136000 |
| ui_design | 12 | 67250 | 68000 | 215000 | 215000 |

## Retry hotspots
| Phase | Total retries | Avg/task | Max/task |
|-------|---------------|----------|----------|
| test_design | 11 | 0.92 | 3 |
| requirements | 10 | 0.83 | 4 |
| code_review | 8 | 0.67 | 2 |
| test_impl | 8 | 0.67 | 2 |
| hearing | 7 | 0.58 | 2 |
| regression_test | 5 | 0.42 | 2 |
| design_review | 4 | 0.33 | 1 |
| manual_test | 4 | 0.33 | 2 |
| planning | 4 | 0.33 | 1 |
| security_scan | 4 | 0.33 | 1 |

## Top DoD failure patterns
| Check | Level | Count | Tasks | Phases |
|-------|-------|-------|-------|--------|
| content_validation | L4 | 31 | 7 | code_review, design_review, docs_update, hearing, manual_test, performance_test, planning, requirements, scope_definition, security_scan, test_design, threat_modeling |
| delta_entry_format | L4 | 20 | 7 | code_review, hearing, manual_test, performance_test, planning, scope_definition, security_scan, test_selection |
| artifact_quality | L3 | 13 | 6 | code_review, docs_update, hearing, manual_test, performance_test, planning, requirements, scope_definition, security_scan |
| artifact_drift | L4 | 13 | 7 | code_review, test_design |
| intent_consistency | L4 | 9 | 6 | requirements |
| rtm_required | L3 | 8 | 5 | requirements |
| tdd_red_evidence | L2 | 8 | 6 | test_impl |
| hearing_user_response | L2 | 7 | 6 | hearing |
| rtm_completeness | L3 | 6 | 6 | code_review |
| open_questions_section | L4 | 5 | 2 | requirements |
| ac_design_mapping | L4 | 4 | 4 | design_review |
| ac_tc_mapping | L4 | 4 | 3 | test_design |
| tc_coverage | L3 | 3 | 2 | test_design |
| baseline_required | L3 | 3 | 3 | regression_test |
| ac_format | L4 | 2 | 2 | requirements |

## Outlier phases (P95 > 2x median)
- push: P50=11000ms, P95=6899000ms (ratio 627.18x)
- regression_test: P50=46000ms, P95=4081000ms (ratio 88.72x)
- test_impl: P50=236000ms, P95=17202000ms (ratio 72.89x)
- commit: P50=97000ms, P95=6734000ms (ratio 69.42x)
- acceptance_verification: P50=160000ms, P95=5524000ms (ratio 34.52x)
- ci_verification: P50=10000ms, P95=259000ms (ratio 25.90x)
- test_design: P50=218000ms, P95=5019000ms (ratio 23.02x)
- hearing: P50=761000ms, P95=14582000ms (ratio 19.16x)
- deploy: P50=10000ms, P95=155000ms (ratio 15.50x)
- testing: P50=53000ms, P95=696000ms (ratio 13.13x)
- refactoring: P50=91000ms, P95=1118000ms (ratio 12.29x)
- code_review: P50=197000ms, P95=1506000ms (ratio 7.64x)
- planning: P50=83000ms, P95=422000ms (ratio 5.08x)
- build_check: P50=34000ms, P95=153000ms (ratio 4.50x)
- design_review: P50=109000ms, P95=488000ms (ratio 4.48x)
- health_observation: P50=89000ms, P95=399000ms (ratio 4.48x)
- docs_update: P50=71000ms, P95=241000ms (ratio 3.39x)
- implementation: P50=303000ms, P95=1021000ms (ratio 3.37x)
- ui_design: P50=68000ms, P95=215000ms (ratio 3.16x)
- performance_test: P50=110000ms, P95=345000ms (ratio 3.14x)
- impact_analysis: P50=57000ms, P95=178000ms (ratio 3.12x)
- requirements: P50=294000ms, P95=787000ms (ratio 2.68x)
- research: P50=86000ms, P95=226000ms (ratio 2.63x)
- test_selection: P50=90000ms, P95=231000ms (ratio 2.57x)
- flowchart: P50=41000ms, P95=97000ms (ratio 2.37x)
- scope_definition: P50=85000ms, P95=188000ms (ratio 2.21x)

## Recommendations
- Phase "test_design" retries avg 0.92/task — DoD may be too strict or template ambiguous
- Phase "requirements" retries avg 0.83/task — DoD may be too strict or template ambiguous
- Phase "code_review" retries avg 0.67/task — DoD may be too strict or template ambiguous
- DoD check "content_validation" (L4) fails in 7/12 tasks — review this validator
- DoD check "delta_entry_format" (L4) fails in 7/12 tasks — review this validator
- DoD check "artifact_quality" (L3) fails in 6/12 tasks — review this validator
- Phase "push" P95 is 627.18x median — investigate blocking behavior
- Phase "regression_test" P95 is 88.72x median — investigate blocking behavior
