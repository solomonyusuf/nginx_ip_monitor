FROM node:18-alpine
WORKDIR /app
COPY package.json ./
RUN npm install --production
COPY app.js ./
RUN mkdir -p /var/log/ip_manager
VOLUME ["/etc/nginx/conf.d","/var/log/ip_manager"]
EXPOSE 3000
CMD ["node","app.js"]
