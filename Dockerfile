# docker build -t air-server .

FROM ubuntu:focal
# ubuntu 20.04
# ostree 2020.3
# nodejs v18.13.0
# npm 8.19.3


# https://github.com/docker/for-mac/issues/5831
RUN set NODE_OPTIONS=--max-old-space-size=10240000

RUN apt -y update \
    && apt -y install curl  \
    && curl -sL https://deb.nodesource.com/setup_18.x -o setup.sh \
    && bash setup.sh \
    && DEBIAN_FRONTEND=noninteractive apt -y install ostree nodejs

WORKDIR /app

COPY ./package.json ./package-lock.json ./tsconfig.json .eslintrc ./
COPY ./src ./src

RUN npm install typescript tsc-alias -g && npm install

RUN npm run generate

# RUN npm run build
RUN tsc && tsc-alias

ENTRYPOINT [ "node", "dist/index.js" ]