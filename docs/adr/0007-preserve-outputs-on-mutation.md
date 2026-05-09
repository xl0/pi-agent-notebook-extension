# Preserve cell outputs on mutation

Write and edit operations preserve existing cell outputs. Outputs are only removed by the explicit `clear_outputs` tool. This matches Jupyter and VSCode behavior: editing a cell's source does not implicitly clear its output, even though the output may now be stale.
