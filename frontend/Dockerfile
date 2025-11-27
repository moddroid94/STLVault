FROM node:18-alpine as build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm install
RUN npm run build
COPY . .
EXPOSE 5173
CMD ["npm", "start"]
