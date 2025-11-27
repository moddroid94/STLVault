FROM node:18-alpine
RUN mkdir -p /app
COPY . /app/
WORKDIR /app
RUN npm install
RUN npm run build
COPY . .
EXPOSE 5173
CMD ["npm", "run", "dev", "--", "--host"]
