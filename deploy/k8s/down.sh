#!/usr/bin/env bash
# Delete the local kind cluster (Milan, its saved state, and the NudgeBee agent if installed).
set -euo pipefail
kind delete cluster --name milan
