# nbformat v4 only; no legacy format support

The extension only supports `nbformat === 4`. Older formats (v1–v3, pre-2015 IPython notebook era) are rejected with a clear error. Users with legacy notebooks can convert them with external tools like `jupyter nbconvert`. Supporting pre-v4 formats would add parsing complexity for files that are effectively extinct.
