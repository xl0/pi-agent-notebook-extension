# Mutation tools wrapped in Pi's per-file mutation queue

All notebook mutation tools wrap their read-modify-write logic in `withFileMutationQueue(normalizedPath, ...)`. Pi executes sibling tool calls in parallel by default; without queueing, two concurrent mutations to the same `.ipynb` file could interleave reads and writes, losing one set of changes. The queue serializes by canonicalized file path, so mutations to different notebooks still run in parallel.
