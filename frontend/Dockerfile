FROM node:24-alpine

WORKDIR /app
COPY package*.json ./

RUN npm install -g npm@11.4.0 && \
npm install --legacy-peer-deps

COPY . .

ENV HOST=0.0.0.0

EXPOSE 5173
CMD ["npm", "run", "dev", "--", "--host"]