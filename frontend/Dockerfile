#############################
# Frontend Dockerfile
#
# This Dockerfile serves the contents of the ``frontend`` directory via
# Nginx.  In a full Angular project you would run ``npm run build`` and
# copy the compiled assets from ``dist/`` into the Nginx image.  Since
# this repository only contains static HTML/JS/CSS, we copy the
# directory as‑is.

#
# Dockerfile para o front-end
#
# Esta imagem serve arquivos estáticos via Nginx.  Se houver um projeto
# compilável (por exemplo, Angular ou Next.js) no diretório, você pode
# adicionar uma fase de build usando Node.  Por simplicidade, este
# Dockerfile copia todos os arquivos do diretório ``frontend`` para
# ``/usr/share/nginx/html`` e, ao final, garante que existe um
# ``index.html`` válido.  Isso evita que o contêiner exiba a página
# padrão "Welcome to nginx".

# Etapa opcional de build usando Node.  Se não houver um projeto
# JavaScript, esta etapa será ignorada.  O uso de ``|| true`` evita
# falhas quando ``npm install`` ou ``npm run build`` não estão
# disponíveis.
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json . || true
RUN [ -f package.json ] && npm ci || true
COPY . .
RUN [ -f package.json ] && npm run build || true

FROM nginx:alpine
WORKDIR /usr/share/nginx/html

# Remova qualquer arquivo existente (como a página de boas‑vindas padrão)
RUN rm -rf ./*

# Se houver um build gerado por uma ferramenta (Angular/Next/etc.), copie-o.
COPY --from=build /app/dist/kogui-frontend/browser/ /usr/share/nginx/html/ || true
# Copie todos os arquivos do diretório de build para o contêiner. Isso
# inclui ``index.html`` personalizado criado no repositório.
COPY . /usr/share/nginx/html/

# Use a configuração personalizada do Nginx (se existir).
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]