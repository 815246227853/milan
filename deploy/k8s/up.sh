#!/usr/bin/env bash
# Build Milan, run it on a local kind cluster, and open it on http://localhost:8080.
# Safe to re-run: it reuses the cluster, rebuilds the image and restarts the pod.
set -euo pipefail
cd "$(dirname "$0")/../.."

for tool in docker kind kubectl; do
  command -v "$tool" >/dev/null || { echo "Missing $tool. Install it first (see docs/k8s-nudgebee.md)."; exit 1; }
done
docker info >/dev/null 2>&1 || { echo "Docker is not running. Start Docker Desktop and try again."; exit 1; }
[ -f .env ] || { echo "No .env found. Run: cp .env.example .env  and add SARVAM_API_KEY and OPENAI_API_KEY."; exit 1; }

if ! kind get clusters | grep -qx milan; then
  echo "==> Creating kind cluster 'milan'"
  kind create cluster --config deploy/kind.yaml
fi
kubectl config use-context kind-milan >/dev/null

echo "==> Building image milan:dev"
docker build -t milan:dev -f apps/call-demo/Dockerfile .
kind load docker-image milan:dev --name milan

echo "==> Updating secret milan-env from .env"
# NUDGEBEE_AUTH_KEY is for the NudgeBee agent (nudgebee.sh), not for Milan, so leave it out.
grep -v '^NUDGEBEE_AUTH_KEY=' .env | kubectl create secret generic milan-env --from-env-file=/dev/stdin --dry-run=client -o yaml | kubectl apply -f -

# Behind a corporate TLS proxy (Netskope), pods can't reach OpenAI/Sarvam/Flagsmith unless they trust its certificate.
# Bundle the standard roots with Netskope's certs from the macOS keychain. (kubectl create, not apply: the bundle is too big.)
if command -v security >/dev/null && security find-certificate -a -c goskope -p /Library/Keychains/System.keychain >/dev/null 2>&1; then
  echo "==> Netskope found: giving Milan its certificate"
  bundle=$(mktemp)
  cat /etc/ssl/cert.pem > "$bundle"
  security find-certificate -a -c goskope -p /Library/Keychains/System.keychain >> "$bundle"
  kubectl delete configmap netskope-ca --ignore-not-found >/dev/null
  kubectl create configmap netskope-ca --from-file=ca.pem="$bundle" >/dev/null
  rm -f "$bundle"
fi

echo "==> Deploying"
kubectl apply -f deploy/k8s/
kubectl rollout restart deployment/milan >/dev/null # pick up the new image and secret
kubectl rollout status deployment/milan --timeout=120s

echo
echo "Milan is running on Kubernetes: http://localhost:8080"
echo "Watch it:  kubectl get pods -l app=milan -w"
