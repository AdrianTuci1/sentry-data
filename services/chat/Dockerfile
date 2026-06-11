FROM node:22-slim

WORKDIR /app

COPY package.json ./
RUN npm install --production

COPY index.js ./

ENV PORT=8080
ENV NODE_ENV=production

EXPOSE 8080

CMD ["node", "index.js"]
