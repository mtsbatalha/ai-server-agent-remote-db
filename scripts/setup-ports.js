const fs = require('fs');
const path = require('path');
const net = require('net');
const { execSync } = require('child_process');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const ENV_FILE = path.join(PROJECT_ROOT, '.env');
const ENV_EXAMPLE_FILE = path.join(PROJECT_ROOT, '.env.example');

// Default ports we want to use
const DEFAULT_PORTS = {
    WEB: 3000,
    API: 3001,
    REDIS: 6380, // Non-default to avoid conflict with other projects (e.g., Grammarly)
    OLLAMA: 11434
};

// Check if a port is in use
function isPortInUse(port) {
    return new Promise((resolve) => {
        const server = net.createServer();
        server.once('error', (err) => {
            if (err.code === 'EADDRINUSE') {
                resolve(true);
            } else {
                resolve(false);
            }
        });
        server.once('listening', () => {
            server.close();
            resolve(false);
        });
        server.listen(port);
    });
}

// Find an available port starting from startPort
async function findAvailablePort(startPort, name) {
    let port = startPort;
    while (await isPortInUse(port)) {
        console.log(`⚠️  Port ${port} (${name}) is in use.`);
        port++;
    }
    if (port !== startPort) {
        console.log(`✅ Found available alternative for ${name}: ${port}`);
    } else {
        console.log(`✅ Port ${port} (${name}) is available.`);
    }
    return port;
}

// Read .env file or create from example
function loadEnv() {
    if (fs.existsSync(ENV_FILE)) {
        return fs.readFileSync(ENV_FILE, 'utf8');
    } else if (fs.existsSync(ENV_EXAMPLE_FILE)) {
        console.log('📝 Creating .env from .env.example');
        return fs.readFileSync(ENV_EXAMPLE_FILE, 'utf8');
    }
    return '';
}

// Update .env content with new port
function updateEnvContent(content, key, value) {
    const regex = new RegExp(`^#?\\s*${key}=.*`, 'm');
    if (regex.test(content)) {
        return content.replace(regex, `${key}=${value}`);
    } else {
        return content + `\n${key}=${value}`;
    }
}

async function main() {
    console.log('🔍 Checking ports for AI Server Agent...');

    let envContent = loadEnv();

    // 1. Check WEB Port
    const webPort = await findAvailablePort(DEFAULT_PORTS.WEB, 'WEB Interface');
    envContent = updateEnvContent(envContent, 'WEB_PORT', webPort);
    envContent = updateEnvContent(envContent, 'PORT', webPort); // For Next.js

    // 2. Check API Port
    const apiPort = await findAvailablePort(DEFAULT_PORTS.API, 'API Server');
    envContent = updateEnvContent(envContent, 'API_HOST_PORT', apiPort);

    // 3. Check Redis Port
    const redisPort = await findAvailablePort(DEFAULT_PORTS.REDIS, 'Redis');
    envContent = updateEnvContent(envContent, 'REDIS_PORT', redisPort);

    // Write updated .env
    fs.writeFileSync(ENV_FILE, envContent);
    console.log(`\n💾 Environment configuration saved to .env`);

    // Update Dockerfile and socket.ts if API port changed from default 3003
    // Note: We only need to update these if the desired HOST port is different from 
    // what is configured in the codebase (which we just set to 3003).
    // If the user's "3003" is ALSO taken, we found an alternative (e.g. 3004).

    if (apiPort !== 3001) {
        console.log(`\n⚠️  API Port is ${apiPort} (not default 3001). Updating configuration files...`);

        // Update Web Dockerfile
        const webDockerfile = path.join(PROJECT_ROOT, 'apps/web/Dockerfile');
        if (fs.existsSync(webDockerfile)) {
            let content = fs.readFileSync(webDockerfile, 'utf8');
            content = content.replace(/ENV NEXT_PUBLIC_API_PORT=\d+/g, `ENV NEXT_PUBLIC_API_PORT=${apiPort}`);
            fs.writeFileSync(webDockerfile, content);
            console.log(`  UPDATED: apps/web/Dockerfile`);
        }

        // Update socket.ts
        const socketFile = path.join(PROJECT_ROOT, 'apps/web/src/lib/socket.ts');
        if (fs.existsSync(socketFile)) {
            let content = fs.readFileSync(socketFile, 'utf8');
            content = content.replace(/const WS_API_PORT = '\d+';/g, `const WS_API_PORT = '${apiPort}';`);
            fs.writeFileSync(socketFile, content);
            console.log(`  UPDATED: apps/web/src/lib/socket.ts`);
        }

        console.log(`\n❗ IMPORTANT: You must rebuild the web image:`);
        console.log(`  docker compose -f docker/docker-compose.yml build web --no-cache`);
    }

    console.log('\n🚀 Configuration complete! You can now start the server with:');
    console.log('  ./scripts/linux/start.sh');
}

main().catch(console.error);
