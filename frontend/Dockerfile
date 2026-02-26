FROM node:22-alpine

WORKDIR /app

COPY package.json .

RUN npm install

COPY . .

RUN npm run build

EXPOSE 5173

# Copy the runtime injection script into the container
COPY env.sh /docker-entrypoint.d/env.sh
RUN dos2unix /docker-entrypoint.d/env.sh
RUN chmod +x /docker-entrypoint.d/env.sh

# Let Docker run your script before starting Nginx
ENTRYPOINT ["/docker-entrypoint.d/env.sh"]
CMD [ "npm", "run", "preview" ]
