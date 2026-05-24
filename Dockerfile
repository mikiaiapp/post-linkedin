# Usar una imagen base de Node.js ligera y optimizada
FROM node:20-alpine

# Definir el directorio de trabajo dentro del contenedor
WORKDIR /usr/src/app

# Copiar los manifiestos de dependencias
COPY package*.json ./

# Instalar solo las dependencias necesarias de producción
RUN npm ci --only=production

# Copiar el resto del código de la aplicación
COPY . .

# Exponer el puerto configurado de la aplicación
EXPOSE 3080

# Iniciar la aplicación
CMD ["node", "server.js"]
