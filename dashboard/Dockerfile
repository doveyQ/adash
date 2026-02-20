FROM node:25-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 3000

CMD ["sh", "-c", "npx drizzle-kit push && npm run dev -- -H 0.0.0.0"]
