# Multi-stage build para Angular + Nginx
# Fase 1: Build da aplicação Angular
FROM node:20-alpine as build

WORKDIR /app

# Copiar package.json e package-lock.json para cache das dependências
COPY package*.json ./

# Instalar dependências (incluindo devDependencies para build)
RUN npm ci

# Copiar código fonte
COPY . .

# Build da aplicação Angular para produção
RUN npm run build

# Fase 2: Servir com Nginx
FROM nginx:alpine

# Copiar arquivos buildados da fase anterior (Angular 17+ usa /browser)
COPY --from=build /app/dist/kogui-frontend/browser /usr/share/nginx/html

# Copiar configuração personalizada do Nginx
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expor porta 80
EXPOSE 80

# Comando para iniciar Nginx
CMD ["nginx", "-g", "daemon off;"]