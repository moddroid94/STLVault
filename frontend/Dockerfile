FROM oven/bun:1-alpine

# Set env variable
ARG VITE_APP_API
ENV VITE_APP_API=$VITE_APP_API

ARG VITE_APP_TAG
ENV VITE_APP_TAG=$VITE_APP_TAG

WORKDIR /app

COPY package.json bun.lock .

RUN bun install --frozen-lockfile --production
COPY . .

RUN bun run build

EXPOSE 5173

CMD [ "bun", "run", "preview" ]
