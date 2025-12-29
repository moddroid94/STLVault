FROM node:22-alpine

# Set env variable
ARG VITE_APP_API
ENV VITE_APP_API=$VITE_APP_API

ARG VITE_APP_TAG
ENV VITE_APP_TAG=$VITE_APP_TAG

WORKDIR /app

COPY package.json .

RUN npm install

COPY . .

RUN npm run build

EXPOSE 5173

CMD [ "npm", "run", "preview" ]
