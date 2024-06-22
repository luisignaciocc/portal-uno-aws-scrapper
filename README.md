# portal-uno-aws-scrapper

Este repositorio contiene una configuración de Serverless para un servicio que incluye dos funciones principales: una API para consultar cotizaciones almacenadas en DynamoDB y un scraper que extrae información de un portal web y almacena los datos en DynamoDB.

## Estructura del Proyecto

- `serverless.yml`: Archivo de configuración de Serverless.
- `handler.js`: Controlador para la API.
- `scraper.js`: Script del scraper para extraer información del portal web.
- `package.json`: Archivo de configuración de npm con las dependencias del proyecto.

## Configuración de Serverless

### serverless.yml

Define la configuración de Serverless, incluyendo el proveedor de servicios (AWS), el runtime (Node.js 18.x), las funciones Lambda, las políticas de IAM y los recursos de DynamoDB. Incluye una función `api` para manejar solicitudes HTTP y una función `scraper` que se ejecuta periódicamente para extraer datos del portal web.

### handler.js

Este archivo contiene el código para una API que consulta la última cotización registrada en la tabla de DynamoDB y la devuelve en formato JSON.

### scraper.js

Este archivo contiene el código del scraper que utiliza Puppeteer y Chrome en AWS Lambda para extraer información del portal web, procesar los datos y almacenarlos en la tabla de DynamoDB.

### package.json

Contiene las dependencias del proyecto, incluyendo las bibliotecas AWS SDK, Puppeteer, Chromium, dotenv, express y serverless-http.

## Despliegue

Para desplegar el proyecto, asegúrate de tener configuradas las credenciales de AWS y ejecuta:

```bash
serverless deploy
```

## Variables de Entorno

Configura las siguientes variables de entorno en tu entorno de desarrollo y producción:

- `USERNAME_SCRAPER`: Nombre de usuario para el scraper.
- `PASSWORD_SCRAPER`: Contraseña para el scraper.

## Uso

- **API**: La API expone un endpoint `/cotization/latest` que devuelve la última cotización registrada en la tabla de DynamoDB.
- **Scraper**: El scraper se ejecuta según una programación definida en el archivo `serverless.yml` y extrae información del portal web, almacenando los datos en DynamoDB.

## Exclusiones

El archivo `serverless.yml` excluye los siguientes directorios y archivos del paquete de despliegue:

- `node_modules/@aws-sdk/**`
- `.git/**`
- `README.md`
- `package-lock.json`
