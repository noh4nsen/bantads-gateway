FROM node:lts-alpine3.15 AS build
COPY . /app
WORKDIR /app

RUN npm ci --omit=dev 

FROM gcr.io/distroless/nodejs:18
COPY --from=build /app /app 
WORKDIR /app
EXPOSE 5000
CMD ["index.js"]