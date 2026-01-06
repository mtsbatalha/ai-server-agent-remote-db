import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import * as net from 'net';

/**
 * Check if a port is available
 */
function isPortAvailable(port: number): Promise<boolean> {
    return new Promise((resolve) => {
        const server = net.createServer();
        server.once('error', () => resolve(false));
        server.once('listening', () => {
            server.close();
            resolve(true);
        });
        server.listen(port, '0.0.0.0');
    });
}

/**
 * Find an available port starting from the given port
 */
async function findAvailablePort(
    startPort: number,
    maxAttempts: number = 10,
): Promise<number> {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const port = startPort + attempt;
        if (await isPortAvailable(port)) {
            if (attempt > 0) {
                console.log(
                    `⚠️  Port ${startPort} was in use, using port ${port} instead`,
                );
            }
            return port;
        }
        console.log(`⚠️  Port ${port} is in use, trying ${port + 1}...`);
    }
    throw new Error(
        `❌ No available port found after ${maxAttempts} attempts starting from ${startPort}`,
    );
}

async function bootstrap() {
    const app = await NestFactory.create(AppModule);
    const configService = app.get(ConfigService);

    // CORS
    app.enableCors({
        origin: configService.get('CORS_ORIGIN', 'http://localhost:3000'),
        credentials: true,
    });

    // Validation
    app.useGlobalPipes(
        new ValidationPipe({
            whitelist: true,
            forbidNonWhitelisted: true,
            transform: true,
            transformOptions: {
                enableImplicitConversion: true,
            },
        }),
    );

    // API Prefix
    app.setGlobalPrefix('api');

    // Swagger
    const config = new DocumentBuilder()
        .setTitle('AI Server Admin API')
        .setDescription('API para administração de servidores Linux com IA')
        .setVersion('1.0')
        .addBearerAuth()
        .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document);

    // Port configuration with fallback
    const defaultPort = parseInt(configService.get('API_PORT', '3001'), 10);
    const enableFallback =
        configService.get('API_PORT_FALLBACK', 'true') === 'true';

    let port = defaultPort;
    if (enableFallback) {
        try {
            port = await findAvailablePort(defaultPort);
        } catch (error) {
            console.error(error.message);
            process.exit(1);
        }
    }

    await app.listen(port);
    console.log(`🚀 API running on http://localhost:${port}`);
    console.log(`📚 Swagger docs at http://localhost:${port}/api/docs`);

    // Update environment for child processes if port changed
    if (port !== defaultPort) {
        process.env.API_PORT = String(port);
    }
}

bootstrap();
