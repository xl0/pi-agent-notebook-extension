# Direct JSON notebook parsing; no nbformat dependency

Notebook files are parsed directly with local TypeScript types, not via the Python `@jupyterlab/nbformat` library. The subset of nbformat we support (v4, code/markdown/raw cells, outputs, attachments) is small enough that local parsing is trivial. Bridging to Python's nbformat from TypeScript would introduce significant runtime complexity for no meaningful benefit.
