# Prebuilt SUNHAUL runtime; no source assets or frontend build on the host.
FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=7860
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY server ./server
COPY shared ./shared
COPY maps ./maps
COPY assets ./assets
COPY dist ./dist
EXPOSE 7860
CMD ["node", "server/index.js"]
