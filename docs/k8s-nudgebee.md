# Kubernetes and NudgeBee: setup guide

This is the NudgeBee part of the Milan demo. You can do all of it on your own laptop, in parallel with everyone else. You don't need the phone calls working to start: the app runs on Kubernetes as soon as you have the two API keys.

**What you'll end up with**
1. Milan running on a local Kubernetes cluster (kind), at http://localhost:8080.
2. NudgeBee connected to that cluster.
3. A recorded demo: Milan breaks, NudgeBee's AI (NuBi) finds the root cause, and the wedding job survives.

**Time:** about 1 to 1.5 hours, most of it downloads.

---

## 1. Install the tools (15 min)

You need a Mac or Linux machine with **at least 16 GB of RAM**. The NudgeBee agent runs its own database and Prometheus, so it's heavy.

```bash
brew install kind kubectl helm
```

Install **Docker Desktop**. Then go to Settings → Resources and give it **at least 10 GB of memory and 4 CPUs**. With less, the NudgeBee pods sit in `Pending` or get OOM-killed. This is the most common failure in WeMakeDevs' own NudgeBee walkthrough.

Check:
```bash
docker info >/dev/null && echo docker ok
kind version && kubectl version --client && helm version   # helm must be 3.12+
```

## 2. Get the code and keys (5 min)

```bash
git clone https://github.com/815246227853/milan.git milan && cd milan
cp .env.example .env
```

In `.env`, fill in **`SARVAM_API_KEY`** and **`OPENAI_API_KEY`** (ask the team for them). Milan won't start without both, and that's on purpose: we use it in demo moment B.

## 3. Run Milan on Kubernetes (10 min)

```bash
./deploy/k8s/up.sh
```

This creates a kind cluster called `milan`, builds the app image, loads the `.env` keys as the `milan-env` secret, and deploys [`deploy/k8s/milan.yaml`](../deploy/k8s/milan.yaml). Re-run it any time you change code or `.env`.

Check:
```bash
kubectl get pods -l app=milan        # one pod, READY 1/1
open http://localhost:8080           # the job screen
```

**What's running:**
- One `milan` pod serves the job screen and the vendor call pages, and runs the calls (Sarvam speech plus the AI).
- Its state (the job, the call transcripts, the decision) is saved to a small persistent volume. That's why killing the pod doesn't lose the job.
- Port 8080 on your laptop goes to the Service, not to one pod, so the page keeps working after the pod is replaced.

**Optional: real vendor calls from a phone.** The vendor pages need HTTPS to use the microphone. Run a tunnel such as `cloudflared tunnel --url http://localhost:8080` (or `ngrok http 8080`), put the https URL in `.env` as `PUBLIC_URL=...`, and re-run `up.sh`. Vendor links are `<tunnel url>/vendor?v=sharma`, `?v=annapurna` and `?v=gupta`.

## 4. Connect NudgeBee Cloud (20 to 30 min)

Use the free **NudgeBee Cloud**. It needs no server of our own, and its AI (NuBi) comes with a model built in, so no LLM key is needed. The free tier covers two clusters.

1. **Sign up** at https://app.nudgebee.com. Login is by magic link: enter your email and click the link you get.
2. **Add the cluster:** **Admin → Integrations → Kubernetes Clusters → Add K8s Account**.
   - Name: `milan-local`
   - Type: **Non-production**
   - Click **Next**. The **Finish Setup** step shows your **auth key** and an install command (with Helm and Shell Script tabs).
3. **Install the agent.** Don't paste the UI command as it is: kind can't run NudgeBee's eBPF node agent, so it has to be switched off. Use one of these two:

   **Option 1: install script** (what WeMakeDevs' [walkthrough](https://github.com/WeMakeDevs/blogs/blob/f41b47b61128a0d9ed8c0496439b0f8c1b48fa7c/posts/how-to-root-cause-a-kubernetes-incident-with-nudgebee.md) used on kind). `-d true` turns off the node agent. Read the script before running it.
   ```bash
   kubectl config use-context kind-milan
   curl -sSLo nudgebee-install.sh https://raw.githubusercontent.com/nudgebee/k8s-agent/main/installation.sh
   less nudgebee-install.sh
   bash nudgebee-install.sh -a "<AUTH_KEY>" -d true
   ```

   **Option 2: Helm** (the docs' "Local Kind / Minikube" tab). Use this one if you want NuBi to be able to *run* the fix (see step 5).
   ```bash
   helm repo add nudgebee-agent https://nudgebee.github.io/k8s-agent/helm && helm repo update
   helm upgrade --install nudgebee-agent nudgebee-agent/nudgebee-agent \
     --namespace nudgebee-agent --create-namespace \
     --set runner.nudgebee.auth_secret_key="<AUTH_KEY>" \
     --set nodeAgent.enabled=false \
     --set runner.enableWritePermissions=true
   ```
   The agent only connects **out** to NudgeBee (port 443), so no tunnel is needed. Keep the auth key out of git.
4. **Check that it connected.** This takes about 4 to 10 minutes.
   ```bash
   kubectl get pods -n nudgebee-agent                 # all Running
   kubectl logs -n nudgebee-agent -l app=nudgebee-agent-runner --tail=50
   #   look for "relay connected" and "starting telemetry poster"
   ```
   In the app, the cluster under **Kubernetes** shows a **Connected** badge, and the inventory lists the `milan` deployment in `default`.
5. **Sanity check NuBi.** Open the **NuBi** drawer (right side of the dashboard) and ask: *"List the namespaces and the workloads in the default namespace."* It should mention `milan`.

**Read-only by default.** Out of the box, NuBi can investigate but not change anything. Even if you approve a fix in chat, the agent refuses commands like `kubectl rollout undo` unless it was installed with `runner.enableWritePermissions=true` (Helm option 2). This is a local throwaway cluster, so turning that on is fine, and it makes for a better demo: NuBi finds the cause, proposes the fix, you approve, and it runs.

## 5. The demo: break Milan, let NuBi find out why

Keep three windows side by side:
1. The Milan job screen (http://localhost:8080)
2. `kubectl get pods -l app=milan -w`
3. NudgeBee: **Troubleshoot** (the Triage Inbox and All Events) and the NuBi drawer

First start a job on the job screen (for example *"Find me a vegetarian caterer for 250 guests, within ₹1,000 per plate"*), so there's something to lose.

### Moment 1 (main): a bad config push crash-loops Milan

Someone ships a config with an empty Sarvam key, so Milan can't make calls:
```bash
kubectl set env deployment/milan SARVAM_API_KEY=""
```
- **Kubernetes:** the new pod exits on start and goes into **CrashLoopBackOff**. Milan is down, in the middle of wedding season.
- **NudgeBee:** a CrashLoopBackOff event shows up under **Troubleshoot**. Click **Investigate** (or ask NuBi: *"Why is the milan deployment in the default namespace crash-looping?"*). It should trace the cause to the log line `Missing settings: SARVAM_API_KEY` and the env change on the deployment, and show a **Causality Chain** (5 Whys) with evidence. **Record this on camera.**
- **The fix:** if you installed with write permissions, ask NuBi to roll back, approve it, and let it run `kubectl rollout undo deployment/milan`. Otherwise run that command yourself.
- **Milan:** comes back with the same job and calls, because state lives on a persistent volume.

### Moment 2 (backup): an out-of-memory crash

OOM kills are one of NudgeBee's headline detections. Use this one if moment 1 doesn't surface well:
```bash
kubectl set resources deployment/milan --limits=memory=20Mi   # Node can't start in 20 MiB
# NudgeBee: OOMKilled (exit 137), then CrashLoopBackOff, grouped under one alert
kubectl rollout undo deployment/milan
```

### Moment 3 (quick, resilience): a pod dies mid-call

```bash
kubectl delete pod -l app=milan --wait=false
```
Kubernetes replaces the pod in about 5 to 10 seconds, and the job screen comes back unchanged. If a vendor was speaking at that moment, their page shows "Problem… tap to try again"; they tap and the call carries on. NudgeBee may not flag a clean delete-and-replace (its docs don't say), so treat this as a Kubernetes moment, not a NudgeBee one.

**If an event doesn't appear in NudgeBee:** alerts arrive through Prometheus Alertmanager. Ask NuBi directly instead: *"Which workloads in this cluster have restarted, entered CrashLoopBackOff, or experienced OOMKills in the last hour?"* That counts on camera too. If it's still empty, check that the agent pods are healthy, and ask at the NudgeBee booth: they're sponsors at the venue.

### Record

Screen-record moment 1 (and 2 if you use it), about 60 seconds each: the job screen, the pod watch, and NudgeBee side by side. Take screenshots of the Investigation Summary and the Causality Chain; they go in the demo video and the README.

## 6. What to send back to the team

- [ ] Recordings and screenshots
- [ ] What NuBi said the root cause was, in its own words (we'll quote it)
- [ ] Anything in this guide that was wrong, with the fix

## Troubleshooting

| Symptom | Fix |
|---|---|
| `up.sh`: Docker is not running | Start Docker Desktop. |
| Milan pod in `CrashLoopBackOff` right after `up.sh` | `kubectl logs deploy/milan`. Usually a missing key in `.env`; fix it and re-run `up.sh`. |
| Milan pod in `ErrImageNeverPull` | The image wasn't loaded into kind. Re-run `up.sh`. |
| `localhost:8080` refused | The cluster was created without the port mapping. Run `./deploy/k8s/down.sh`, then `./deploy/k8s/up.sh`. |
| NudgeBee pods `Pending` or OOMKilled | Not enough memory. Give Docker Desktop 10 GB or more (Settings → Resources), then delete the stuck pods. |
| NudgeBee pods in `Pending` on a PVC | `kubectl get sc` must show a `(default)` StorageClass. kind ships one called `standard`. |
| Cluster not **Connected** in NudgeBee | `kubectl logs -n nudgebee-agent -l app=nudgebee-agent-runner`. A 401 or invalid key means the key is wrong; re-copy it from Admin → Integrations → Kubernetes Clusters. |
| NuBi refuses `rollout undo` even after you approve it | The agent is read-only. Reinstall with Helm option 2 (`runner.enableWritePermissions=true`), or run the command yourself. |
| Port 8080 already in use | Change `hostPort` in `deploy/kind.yaml`, then run `down.sh` and `up.sh`. |

## Clean up

```bash
helm uninstall nudgebee-agent -n nudgebee-agent   # just NudgeBee (if you used the script, also: kubectl delete ns nudgebee-agent)
./deploy/k8s/down.sh                               # everything: deletes the cluster
```
