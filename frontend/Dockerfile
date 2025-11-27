FROM node:18-alpine as build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
EXPOSE 8989
CMD ["npm", "run", "--", "--port", "5173"]
