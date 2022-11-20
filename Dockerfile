FROM node:18

WORKDIR /app

COPY ./package.json ./package-lock.json ./tsconfig.json .eslintrc ./
COPY ./src ./src

RUN npm install typescript -g && npm install

RUN npm run generate

RUN tsc

CMD [ "node", "dist/src/index.js"]