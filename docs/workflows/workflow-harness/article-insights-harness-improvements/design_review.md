# Design Review: article-insights-harness-improvements

## DR-005: flowchart.mmd Worker割当不一致

### issue

flowchart.mmdのWorker割当(W1-W5の担当改善項目)がplanning.mdと不一致だった。

### before (incorrect mapping)

| Worker | flowchart.mmd (誤) |
|--------|-------------------|
| W1 | P3 AI slop patterns |
| W2 | P3+P5 implementation |
| W3 | P4 code fence flag |
| W4 | P6+P7 implementation |
| W5 | Test and verification |

### after (correct mapping per planning.md)

| Worker | planning.md (正) | 改善項目 |
|--------|------------------|---------|
| W1 | P6-source | MIN_ACCEPTANCE_CRITERIA=5, 7 source + 6 guidance updates |
| W2 | P6-test | 4 test files, 13+ assertion updates |
| W3 | P3+P7 | AI slop detection + duplicate line filter |
| W4 | P4 | noCodeFences flag, code fence detection |
| W5 | P5 | pivot-advisor.ts, lifecycle-next.ts integration |

### execution-order (correct)

- Phase-A: W1(P6-source) + W3(P3+P7) parallel
- Phase-B: W2(P6-test) + W4(P4) parallel (after Phase-A)
- Phase-C: W5(P5) single (after Phase-B)

### resolution

flowchart.mmd を planning.md 準拠で全面再生成。全Worker割当と実行順序を正確に反映。

### status

resolved

### files-changed

- docs/workflows/article-insights-harness-improvements/flowchart.mmd
