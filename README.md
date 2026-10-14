# Cafe Menu: Kubernetes Ingress Demo

A tiny app to learn **Kubernetes Ingress**. One NGINX Ingress sends each URL path to a different service:

| URL path   | Goes to        | What it is                         |
|------------|----------------|------------------------------------|
| `/`        | `cafe-ui`      | Static site on nginx               |
| `/menu`    | `cafe-menu`    | .NET 10 minimal API (2 pods)       |
| `/offers`  | `cafe-offers`  | .NET 10 minimal API (2 pods)       |

The UI calls `/menu` and `/offers` on the **same origin**, so every request goes through the Ingress.
Each API response includes the **pod name**. To see load balancing, open the hidden **Network calls** panel (small button at the bottom-right, or press `N`) and click **Send 6 requests**. Close it with `X` or `Esc`.

## Repo layout

```
cafe-ingress-demo/
├── k8s/ingress.yaml          # the one shared Ingress
├── ui/                       # nginx + index.html, style.css, app.js
│   └── k8s/                  # deployment.yaml, service.yaml
├── menu-service/             # .NET 10 API
│   └── k8s/
└── offers-service/           # .NET 10 API
    └── k8s/
```

Everything uses the `default` namespace. All names start with `cafe-`.

## Prerequisites

Docker, minikube (Docker driver), kubectl. The commands below are for PowerShell.

## Run it

**1. Start minikube and enable the Ingress controller**
```powershell
minikube start --driver=docker
minikube addons enable ingress
kubectl get pods -n ingress-nginx
```
Wait until the `ingress-nginx-controller` pod is `Running`.

**2. Build the three images and load them into minikube**
```powershell
cd menu-service
docker build -t cafe-menu:v1 .
minikube image load cafe-menu:v1
cd ..

cd offers-service
docker build -t cafe-offers:v1 .
minikube image load cafe-offers:v1
cd ..

cd ui
docker build -t cafe-ui:v1 .
minikube image load cafe-ui:v1
cd ..
```

**3. Deploy the services**
```powershell
kubectl apply -f menu-service/k8s
kubectl apply -f offers-service/k8s
kubectl apply -f ui/k8s
kubectl get pods
```
Wait until all 5 pods show `1/1 Running`.

**4. Create the Ingress**
```powershell
kubectl apply -f k8s/ingress.yaml
kubectl get ingress
```

**5. Open a tunnel (keep this window open)**
```powershell
minikube tunnel
```

**6. Browse to http://localhost**

## Try it

- Open the **Network calls** panel and click **Send 6 requests**. The pod names alternate between the two replicas.
- Delete one pod: `kubectl delete pod <cafe-menu-pod-name>`. Kubernetes starts a new one. Click again and see the new pod name.
- Scale up: `kubectl scale deployment cafe-menu --replicas=4`.

## Clean up

```powershell
kubectl delete -f k8s/ingress.yaml
kubectl delete -f ui/k8s
kubectl delete -f offers-service/k8s
kubectl delete -f menu-service/k8s
```

## Troubleshooting

- **Page does not open on Windows**: IIS may be holding port 80. Run `iisreset /stop` (as admin) before `minikube tunnel`, and `iisreset /start` when you are done.
- **`ErrImagePull` or `ImagePullBackOff`**: the image is not inside minikube. Run `minikube image load <name>:v1` again, then `kubectl rollout restart deployment <name>`.
- **`ERR_CONNECTION_REFUSED` after deleting the Ingress**: with minikube, the tunnel is tied to the Ingress resource, so you get a refused connection instead of a 404. On AKS you would get a real NGINX 404.
- **Pods are `Running` but not `Ready`**: the readiness probe on `/healthz` is failing. Check `kubectl logs <pod-name>`.
