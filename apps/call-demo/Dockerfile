# Built from the repo root (see deploy/k8s/up.sh) so the landing page can be served at /.
FROM node:22-alpine
WORKDIR /app
COPY apps/call-demo/package.json apps/call-demo/server.js ./
COPY apps/call-demo/public ./public
COPY apps/landing/index.html ./landing/index.html
ENV NODE_ENV=production DEMO_PORT=3000
USER node
EXPOSE 3000
CMD ["node", "server.js"]
