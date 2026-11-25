# Not deployed yet

Manifests for the planned split into `apps/api` and `apps/call-worker`. Those services have no Dockerfile or server yet, so `deploy/k8s/up.sh` does not apply these (`kubectl apply -f deploy/k8s/` is not recursive). What runs on Kubernetes today is [`../milan.yaml`](../milan.yaml).
