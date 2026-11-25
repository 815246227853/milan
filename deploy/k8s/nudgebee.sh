#!/usr/bin/env bash
# Connect the local kind cluster to NudgeBee Cloud.
# Needs NUDGEBEE_AUTH_KEY in .env (NudgeBee: Admin → Integrations → Kubernetes Clusters → Add K8s Account).
# kind can't run the eBPF node agent, so it's off. Write permissions are on so NuBi can run an approved fix
# (e.g. a rollback); this is a local throwaway cluster.
set -euo pipefail
cd "$(dirname "$0")/../.."

key=$(grep -E '^NUDGEBEE_AUTH_KEY=' .env 2>/dev/null | cut -d= -f2- | tr -d '"' || true)
[ -n "$key" ] || { echo "Add NUDGEBEE_AUTH_KEY=<your key> to .env first."; exit 1; }
kubectl config use-context kind-milan >/dev/null

helm repo add nudgebee-agent https://nudgebee.github.io/k8s-agent/helm >/dev/null 2>&1 || true
helm repo update nudgebee-agent >/dev/null
helm upgrade --install nudgebee-agent nudgebee-agent/nudgebee-agent \
  --namespace nudgebee-agent --create-namespace \
  --set runner.nudgebee.auth_secret_key="$key" \
  --set nodeAgent.enabled=false \
  --set runner.enableWritePermissions=true

echo
echo "Installed. Wait until everything is Running (a few minutes):"
echo "  kubectl get pods -n nudgebee-agent -w"
echo "Then check the runner connected:"
echo "  kubectl logs -n nudgebee-agent -l app=nudgebee-agent-runner --tail=50 | grep -iE 'relay connected|telemetry'"
