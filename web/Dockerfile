# Le build produit des fichiers statiques identiques quelle que soit l'architecture :
# on le fait sur la plateforme de la machine qui construit, ce qui évite d'émuler arm64 (très lent).
FROM --platform=$BUILDPLATFORM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:1.29-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
